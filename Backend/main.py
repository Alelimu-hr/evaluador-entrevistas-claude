import io
import json
import os
import re
import struct
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

from fastapi import FastAPI, Header, Form, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from google import genai
from google.genai import types

from pypdf import PdfReader
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

import imageio_ffmpeg

try:
    from json_repair import repair_json
except ImportError:
    # Si por lo que sea la librería no está instalada (ej: falló el deploy de
    # una dependencia nueva), no queremos que el servidor entero deje de
    # arrancar por esto — seguimos sin el fallback extra de reparación.
    repair_json = None

# Binario de ffmpeg (bundleado por imageio-ffmpeg, no depende de que el
# sistema operativo lo tenga instalado). Lo usamos directo por subprocess
# en vez de pasar por pydub, porque pydub todavía no está arreglado para
# Python 3.13+ (le sacaron el módulo audioop a la librería estándar).
FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()

# Para leer PDFs de CV en un hilo aparte: si el PDF viene raro/pesado y
# pypdf se cuelga leyéndolo, no queremos que se frene TODO el servidor
# (y todas las demás peticiones de otros participantes) con él.
#
# OJO memoria: bajado de 4 a 2 después de que la instancia de Render se
# quedó sin RAM y se reinició sola (ver aviso de "exceeded its memory
# limit"). Con 4 hilos, hasta 4 PDFs pesados se podían estar parseando en
# simultáneo, cada uno con su propia copia del texto extraído en memoria,
# justo al mismo tiempo que la instancia también procesa audio (que ya de
# por sí usa bastante RAM — ver convertir_audio_a_wav). Esto NO es la causa
# raíz (no hay un leak: nada queda creciendo entre pedidos), es solo bajar
# el techo de cuánto puede picar en simultáneo. El fix de fondo es más
# memoria en el plan de Render — ver la conversación sobre capacidad.
_pdf_executor = ThreadPoolExecutor(max_workers=2)
PDF_TIMEOUT_SEGUNDOS = 15

# Cuántas entrevistas tuvo la persona en su vida (NO el seniority del
# puesto): lo elige en el formulario del simulador y se usa para calibrar
# tanto la dificultad de las preguntas como el tono del feedback final, para
# que no sea igual de duro con alguien que nunca se entrevistó que con
# alguien con mucho rodaje. Si llega un valor que no está acá (o vacío), se
# usa el de "1 a 5" como punto medio razonable.
NIVELES_EXPERIENCIA = {
    "Ninguna": (
        "Es la primera entrevista de su vida. Sé especialmente contenedor: "
        "preguntas claras, sin trampas ni ambigüedad innecesaria, y en el "
        "feedback priorizá la contención y el ánimo por sobre la exigencia "
        "técnica, aunque sigas siendo honesto."
    ),
    "1 a 5": (
        "Tiene poca experiencia entrevistándose (entre 1 y 5 entrevistas en "
        "su vida). Mantené un tono ameno y alentador, pero ya podés dar "
        "feedback concreto y señalar con claridad qué mejorar."
    ),
    "6 a 15": (
        "Tiene experiencia moderada entrevistándose (entre 6 y 15 "
        "entrevistas en su vida). Podés ser moderadamente crítico: exigile "
        "precisión y profundidad en las respuestas, sin golpes de más."
    ),
    "Más de 15": (
        "Tiene mucha experiencia entrevistándose (más de 15 entrevistas en "
        "su vida). Podés ser exigente y directo al evaluar técnicamente, "
        "como un headhunter real evaluando a alguien con rodaje."
    ),
}
NIVEL_EXPERIENCIA_DEFAULT = NIVELES_EXPERIENCIA["1 a 5"]

app = FastAPI(title="Evaluador de Entrevistas API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lista de modelos a probar en orden. Si el primero falla o está saturado,
# se intenta con el siguiente.
#
# IMPORTANTE (lección aprendida a las malas): NO agregar modelos "pro" acá
# sin confirmar antes que tienen cupo en el plan GRATUITO. Tanto
# gemini-2.5-pro como gemini-3.1-pro-preview requieren facturación paga
# habilitada — en el plan gratis su límite es directamente 0, así que
# cualquier pedido que llegue a probarlos falla siempre y ensucia el mensaje
# de error. Nos quedamos solo con modelos "flash", que sí están disponibles
# gratis (gemini-1.5-flash y gemini-2.0-flash ya fueron discontinuados por
# Google, por eso no están en esta lista).
# OJO: "gemini-2.5-flash" y "gemini-2.5-flash-lite" quedaron discontinuados
# para keys/proyectos nuevos (Google devuelve 404 NOT_FOUND y en el mensaje
# de error indica directamente el reemplazo). Actualizado a la generación
# vigente. Si vuelve a pasar en el futuro, el mensaje 404 de Google siempre
# dice el nombre correcto al que migrar.
MODELOS_FALLBACK = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite"]


def obtener_modelos_disponibles(client: genai.Client) -> list[str]:
    """Descubre EN VIVO qué modelos 'flash' están realmente disponibles para
    esta cuenta/key en este momento, en vez de depender ciegamente de la
    lista fija de arriba (que se desactualiza cada vez que Google cambia su
    catálogo — ya nos pasó dos veces: gemini-2.5-pro dejó de estar
    disponible para cuentas nuevas, y gemini-3.1-pro-preview resultó tener
    cupo 0 en el plan gratis). Es el mismo enfoque que usa el prototipo de
    Streamlit (obtener_modelos_multimodales_activos), que viene resultando
    más resistente que nuestra lista hardcodeada.

    client.models.list() es solo metadata: NO consume cuota de
    generate_content (la que tiene el límite de 20/día), así que es seguro
    llamarlo en cada pedido. Si la llamada falla por lo que sea, no
    rompemos nada: caemos de vuelta a MODELOS_FALLBACK como red de
    seguridad.
    """
    try:
        modelos_google = list(client.models.list())
    except Exception:
        return MODELOS_FALLBACK

    # OJO — lección aprendida en producción: filtrar por "contiene 'flash' y
    # no contiene 'pro'" es demasiado laxo. "gemini-3.1-flash-lite-image"
    # pasó ese filtro (tiene "flash", no tiene "pro") pero es un modelo
    # especializado en IMÁGENES con límite 0 en el free tier, y nos rompió
    # /api/evaluar-respuesta en pleno taller de prueba. En vez de ir
    # bloqueando palabra por palabra cada variante rara que vamos
    # descubriendo a las malas, usamos una ALLOWLIST estricta por patrón:
    # solo "gemini-<versión>-flash" o "gemini-<versión>-flash-lite", sin
    # ningún sufijo extra (-image, -tts, -live, -embedding, etc.). Cualquier
    # variante de propósito especial que Google saque en el futuro queda
    # afuera por default, en vez de colarse hasta que la descubramos rota.
    PATRON_MODELO_VALIDO = re.compile(r"^gemini-\d+(?:\.\d+)?-flash(?:-lite)?$")

    candidatos = []
    for m in modelos_google:
        nombre = (getattr(m, "name", "") or "").replace("models/", "")
        if not nombre:
            continue
        metodos = getattr(m, "supported_actions", None) or getattr(m, "supported_generation_methods", None) or []
        acepta_generacion = any("generateContent" in str(x) for x in metodos) if metodos else True
        if PATRON_MODELO_VALIDO.match(nombre.lower()) and acepta_generacion:
            candidatos.append(nombre)

    if not candidatos:
        return MODELOS_FALLBACK

    def prioridad(nombre: str) -> int:
        # Preferimos, en este orden: los que ya veníamos usando manualmente
        # (probados y confiables) > modelos estables > modelos preview/exp
        # (más nuevos, pero menos probados y más propensos a saturarse).
        if nombre in MODELOS_FALLBACK:
            return MODELOS_FALLBACK.index(nombre)
        if "preview" in nombre.lower() or "exp" in nombre.lower():
            return 100
        return 50

    # OJO: dedup con dict.fromkeys() en vez de set() para no perder el orden
    # en que Google los devolvió — con set() el orden es no-determinístico
    # entre corridas para los que empatan en prioridad.
    candidatos_unicos = list(dict.fromkeys(candidatos))
    candidatos_ordenados = sorted(candidatos_unicos, key=prioridad)
    return candidatos_ordenados[:4]  # tope de seguridad: no probar decenas de modelos en cadena


# OJO: a propósito NO usamos response_mime_type="application/json" (modo JSON
# estricto). Los pedidos que fuerzan a Gemini a devolver JSON validado usan un
# camino de procesamiento más pesado en los servidores de Google, y durante
# picos de demanda son de los primeros en recibir un 503. En cambio, le
# pedimos el JSON por texto en el prompt (ver más abajo) y lo parseamos de
# forma tolerante con extraer_json_seguro() — mismo patrón que ya veníamos
# usando en el prototipo de Streamlit, que resultó más resistente a estos
# picos.
JSON_CONFIG = types.GenerateContentConfig(
    temperature=0.2,
)

# Config aparte para el análisis de LinkedIn, con temperatura más baja
# (0.1 en vez de 0.2) para que la redacción varíe menos entre corridas del
# mismo perfil. No la reutilizamos para el simulador de entrevistas a
# propósito, para no tocar ese comportamiento sin que haga falta — ahí la
# variedad entre preguntas/feedback es parte de la gracia.
#
# OJO: esto reduce la variación, no la elimina. Sigue habiendo dos fuentes de
# "me dice cosas distintas cada vez" que ninguna config de temperatura arregla
# del todo:
# 1. El fallback entre modelos (MODELOS_FALLBACK): si el primer modelo está
#    ocupado/con cuota agotada, se prueba el siguiente, y cada modelo tiene su
#    propio "estilo" de redacción — un cambio de modelo entre corridas explica
#    buena parte de las diferencias grandes. Probar la MISMA key muchas veces
#    seguidas (como al testear) agota la cuota por minuto más rápido que un
#    usuario real haciendo un solo análisis, así que quien más fallbacks ve
#    somos nosotros probando, no necesariamente la gente real usándolo.
# 2. Ningún modelo de LLM es 100% determinístico incluso a la misma
#    temperatura — hay algo de azar en el muestreo de cada palabra.
JSON_CONFIG_LINKEDIN = types.GenerateContentConfig(
    temperature=0.1,
)

# Mismo criterio que JSON_CONFIG_LINKEDIN (temperatura baja para que la
# redacción varíe poco entre corridas del mismo CV) — ver el comentario de
# arriba para el detalle de por qué igual puede variar un poco.
JSON_CONFIG_CV = types.GenerateContentConfig(
    temperature=0.1,
)

# Mismo criterio que las de arriba.
JSON_CONFIG_PLAN_CARRERA = types.GenerateContentConfig(
    temperature=0.1,
)

# Mismo criterio que las de arriba.
JSON_CONFIG_NEGOCIACION = types.GenerateContentConfig(
    temperature=0.1,
)

# Temperatura un poco más alta que las de diagnóstico/puntaje de arriba: esto
# genera IDEAS de contenido, no un puntaje, así que un poco más de variedad
# entre corridas está bien (y hasta es deseable) en vez de ser un problema.
JSON_CONFIG_CONTENIDO_LINKEDIN = types.GenerateContentConfig(
    temperature=0.4,
)


def get_client(api_key: str, timeout_ms: int = 45000) -> genai.Client:
    if not api_key or not api_key.strip():
        raise HTTPException(status_code=400, detail="Falta la API Key de Gemini en los headers.")
    # OJO: sin timeout explícito, el cliente puede quedarse colgado
    # indefinidamente si la conexión con Google se cuelga (no falla, no tira
    # excepción, simplemente nunca responde). Eso deja al usuario mirando el
    # spinner de "Analizando..." para siempre, sin caer nunca en nuestra
    # lógica de fallback/reintento porque técnicamente no hubo ninguna
    # excepción que atrapar. Con este timeout, se corta solo, se lanza una
    # excepción real, y ahí sí entra el fallback al próximo modelo.
    # /api/informe-final manda TODOS los audios de la entrevista de una
    # (payload más pesado, análisis más largo) y le pasamos un timeout mayor
    # a propósito para no cortarlo antes de tiempo en un pedido legítimamente
    # más lento, distinto del resto de los endpoints que son livianos.
    return genai.Client(api_key=api_key.strip(), http_options={"timeout": timeout_ms})


def _es_error_de_cuota(e: Exception) -> bool:
    texto = str(e)
    return "429" in texto or "RESOURCE_EXHAUSTED" in texto or "quota" in texto.lower()


def _es_error_de_cuota_por_minuto(e: Exception) -> bool:
    # Google devuelve 429/RESOURCE_EXHAUSTED tanto cuando se agota la cuota
    # DIARIA como cuando se supera el límite de pedidos POR MINUTO (un límite
    # mucho más corto, pensado para frenar ráfagas). Son cosas muy distintas:
    # una se resuelve esperando un minuto, la otra recién al día siguiente. El
    # texto del error de Google suele indicar cuál de las dos es mirando el
    # nombre de la métrica de cuota (contiene "PerMinute" vs "PerDay").
    texto = str(e).lower()
    return "perminute" in texto.replace(" ", "") or "requests per minute" in texto


def _es_error_temporal(e: Exception) -> bool:
    # OJO: al principio solo reconocíamos 503/UNAVAILABLE como "temporal".
    # Pero un 504 DEADLINE_EXCEEDED (el gateway de Google se cansó de
    # esperar) y un timeout de nuestro propio cliente ("read operation
    # timed out") son la MISMA situación de fondo — Google respondiendo
    # lento por demanda alta — solo que se manifiestan con otro texto. Sin
    # esto, esos casos caían en el mensaje genérico de error en vez del
    # mensaje claro de "es transitorio, reintentá".
    texto = str(e).lower()
    return (
        "503" in texto
        or "504" in texto
        or "unavailable" in texto
        or "deadline_exceeded" in texto
        or "deadline exceeded" in texto
        or "timed out" in texto
        or "timeout" in texto
        or "overloaded" in texto
        or "high demand" in texto
    )


def llamar_gemini_con_fallback(client: genai.Client, contents, config=None, modelos=None):
    # Si no nos pasaron una lista explícita de modelos, la descubrimos en
    # vivo (ver obtener_modelos_disponibles) en vez de usar directo la lista
    # fija — así nos adaptamos solos a cambios en el catálogo de Google.
    modelos = modelos or obtener_modelos_disponibles(client)
    ultimo_error = None
    errores_por_modelo = {}  # para poder mostrar qué pasó con CADA modelo, no solo el último
    for modelo in modelos:
        # OJO: un solo intento por modelo, sin reintento interno. Antes
        # hacíamos hasta 2 intentos por modelo (hasta 6 pedidos reales en
        # total para /api/informe-final, cada uno reenviando TODOS los audios
        # de nuevo), lo cual multiplicaba el tiempo de espera y el consumo de
        # cuota sin mejorar la tasa de éxito. El prototipo de Streamlit —que
        # sí funciona de forma consistente para este mismo paso pesado—
        # prueba cada modelo candidato UNA sola vez y pasa rápido al
        # siguiente si falla. Alineamos el comportamiento a ese patrón.
        try:
            kwargs = {"model": modelo, "contents": contents}
            if config is not None:
                kwargs["config"] = config
            res = client.models.generate_content(**kwargs)
            if res and res.text:
                return res.text, modelo
        except Exception as e:
            ultimo_error = e
            errores_por_modelo[modelo] = str(e)[:200]
            # OJO: esto es lo único que nos deja ver qué pasó REALMENTE en
            # cada intento. Antes no había ningún print/log acá, así que los
            # logs de Render no mostraban nada útil sobre estos fallos —
            # estábamos debugueando solo con el mensaje traducido que ve el
            # usuario, que no siempre refleja el error real de Google.
            print(f"[gemini] fallo con modelo={modelo}: {type(e).__name__}: {e}", flush=True)
            if _es_error_temporal(e):
                time.sleep(1.5)  # pequeña pausa antes de probar el próximo modelo
    if ultimo_error is not None and _es_error_de_cuota(ultimo_error):
        if _es_error_de_cuota_por_minuto(ultimo_error):
            raise HTTPException(
                status_code=429,
                detail=(
                    "Se hicieron demasiados pedidos seguidos en poco tiempo (límite por minuto, "
                    "no por día). No es que se haya agotado la cuota del día — esperá unos 60 "
                    f"segundos y volvé a intentar. (Detalle: {str(ultimo_error)})"
                ),
            )
        raise HTTPException(
            status_code=429,
            detail=(
                "Se agotó la cuota gratuita de Gemini para esta API Key por hoy "
                f"(probamos {modelos}). El plan gratuito permite 20 pedidos por día por modelo. "
                f"Esperá a que se resetee mañana o usá otra API Key. (Detalle: {str(ultimo_error)})"
            ),
        )
    if ultimo_error is not None and _es_error_temporal(ultimo_error):
        raise HTTPException(
            status_code=503,
            detail=(
                "Los servidores de Google están momentáneamente saturados por alta demanda "
                "(no es un problema de tu cuenta ni de tu cuota). Esperá unos segundos y volvé a "
                "intentar — normalmente se resuelve solo. "
                f"(Detalle técnico: {str(ultimo_error)})"
            ),
        )
    detalle_por_modelo = " | ".join(f"{m}: {e}" for m, e in errores_por_modelo.items())
    raise HTTPException(
        status_code=502,
        detail=f"No se pudo obtener respuesta de Gemini. Detalle por modelo -> {detalle_por_modelo}",
    )


def _intentar_parsear_json(candidato: str):
    """Prueba json.loads en modo estricto y, si falla, en modo no estricto.
    OJO — bug real detectado en producción con el informe de LinkedIn (que
    trae un 'informe_markdown' largo): Gemini a veces devuelve saltos de
    línea "crudos" dentro del valor string del JSON en vez de escapados como
    \\n. Eso es inválido para JSON en modo estricto (json.loads tira
    "Invalid control character"), aunque el JSON es perfectamente
    recuperable. strict=False le permite a json.loads aceptar caracteres de
    control sueltos dentro de un string sin romper el parseo, así que lo
    probamos como segunda opción antes de rendirnos."""
    for strict in (True, False):
        try:
            return json.loads(candidato, strict=strict)
        except json.JSONDecodeError:
            continue

    # Último recurso: json_repair está pensado justo para esto — arregla
    # comillas sin escapar, comas colgantes, JSON cortado a la mitad, etc.,
    # cosas que un LLM comete de vez en cuando y que strict=False NO arregla
    # (ese solo tolera caracteres de control sueltos, no un JSON realmente
    # mal formado). Si tampoco puede, devolvemos None y seguimos con el resto
    # de los intentos/el error final, nunca dejamos que reviente acá.
    if repair_json is not None:
        try:
            reparado = repair_json(candidato)
            if reparado:
                return json.loads(reparado)
        except Exception:
            pass
    return None


def extraer_json_seguro(texto: str):
    if not texto or not texto.strip():
        raise HTTPException(status_code=500, detail="Gemini devolvió una respuesta vacía.")

    limpio = texto.strip().replace("```json", "").replace("```", "")

    resultado = _intentar_parsear_json(limpio)
    if resultado is not None:
        return resultado

    match = re.search(r"\{.*\}", limpio, re.DOTALL)
    if match:
        resultado = _intentar_parsear_json(match.group(0))
        if resultado is not None:
            return resultado

    # Ningún intento funcionó: dejamos el texto COMPLETO en los logs de
    # Render (para poder diagnosticar la próxima vez sin depender de que el
    # mensaje corto que ve el usuario alcance) y le mostramos un poco más de
    # contexto que antes (era muy poco, 150 caracteres, para diagnosticar algo).
    print(f"[extraer_json_seguro] no se pudo parsear ni reparar. Texto completo:\n{texto}", flush=True)
    raise HTTPException(
        status_code=500,
        detail=f"La API no devolvió un JSON válido. Texto recibido: '{texto[:400]}...'",
    )


def extraer_texto_cv(file: UploadFile, content: bytes) -> str:
    if file and file.filename and file.filename.lower().endswith(".pdf"):
        try:
            pdf_reader = PdfReader(io.BytesIO(content))
            # Un CV no debería tener más de un puñado de páginas; limitamos
            # por las dudas para no tardar una eternidad con un PDF raro.
            paginas = pdf_reader.pages[:10]
            texto = "".join([page.extract_text() or "" for page in paginas])
            return texto.strip()
        except Exception:
            return ""
    else:
        try:
            return content.decode("utf-8", errors="ignore")
        except Exception:
            return ""


def _duracion_desde_wav(wav_bytes: bytes) -> float:
    """Lee la duración de un WAV parseando su header RIFF a mano, sin
    depender de módulos de audio de la librería estándar."""
    try:
        if wav_bytes[:4] != b"RIFF" or wav_bytes[8:12] != b"WAVE":
            return 0.0
        pos = 12
        channels, sample_rate, bits_per_sample, data_size = 1, 16000, 16, 0
        while pos + 8 <= len(wav_bytes):
            chunk_id = wav_bytes[pos:pos + 4]
            chunk_size = struct.unpack("<I", wav_bytes[pos + 4:pos + 8])[0]
            body = wav_bytes[pos + 8:pos + 8 + chunk_size]
            if chunk_id == b"fmt " and len(body) >= 16:
                channels = struct.unpack("<H", body[2:4])[0] or 1
                sample_rate = struct.unpack("<I", body[4:8])[0] or 16000
                bits_per_sample = struct.unpack("<H", body[14:16])[0] or 16
            elif chunk_id == b"data":
                data_size = chunk_size
            pos += 8 + chunk_size + (chunk_size % 2)
        bytes_per_sample = max(bits_per_sample // 8, 1)
        return round(data_size / (channels * bytes_per_sample * sample_rate), 1)
    except Exception:
        return 0.0


def convertir_audio_a_wav(contenido: bytes, filename: str | None):
    """Convierte cualquier audio que mande el navegador (webm/ogg/mp4) a WAV,
    que es el formato que mejor soporta la API de Gemini, usando ffmpeg
    directamente. Devuelve (bytes_wav, duracion_en_segundos)."""
    if not contenido:
        raise HTTPException(status_code=400, detail="No se recibió audio.")

    sufijo = ""
    if filename and "." in filename:
        sufijo = "." + filename.rsplit(".", 1)[-1].lower()

    in_path = out_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=sufijo or ".webm", delete=False) as f_in:
            f_in.write(contenido)
            in_path = f_in.name
        out_path = in_path + ".wav"

        resultado = subprocess.run(
            [
                FFMPEG_PATH, "-y", "-loglevel", "error",
                "-i", in_path,
                "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
                out_path,
            ],
            capture_output=True,
            timeout=30,
        )

        if resultado.returncode != 0 or not os.path.exists(out_path):
            error_msg = resultado.stderr.decode(errors="ignore")[:300]
            raise HTTPException(status_code=400, detail=f"No se pudo procesar el audio grabado: {error_msg}")

        with open(out_path, "rb") as f:
            wav_bytes = f.read()

        return wav_bytes, _duracion_desde_wav(wav_bytes)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=400, detail="El procesamiento del audio tardó demasiado.")
    finally:
        for p in (in_path, out_path):
            if p and os.path.exists(p):
                os.remove(p)


@app.get("/api/salud")
async def salud():
    return {"status": "ok"}


@app.get("/api/debug-modelos")
async def debug_modelos():
    """Endpoint temporal de diagnóstico: muestra qué lista de modelos está
    usando realmente el servidor corriendo en este momento, para descartar
    problemas de despliegue/caché sin tener que adivinar."""
    return {"modelos_fallback": MODELOS_FALLBACK}


@app.get("/api/validar-key")
async def validar_key(x_gemini_api_key: str = Header(None, alias="x-gemini-api-key")):
    """Chequea que la API Key sea válida listando modelos (no gasta cuota
    de generate_content, que es la que tiene el límite diario)."""
    if not x_gemini_api_key or not x_gemini_api_key.strip():
        return {"valido": False, "detalle": "Falta la API Key."}
    try:
        client = genai.Client(api_key=x_gemini_api_key.strip(), http_options={"timeout": 15000})
        modelos = list(client.models.list())
        if not modelos:
            return {"valido": False, "detalle": "La API Key no devolvió modelos disponibles."}
        return {"valido": True}
    except Exception as e:
        return {"valido": False, "detalle": str(e)[:200]}


@app.post("/api/generar-pregunta")
async def generar_pregunta(
    x_gemini_api_key: str = Header(None, alias="x-gemini-api-key"),
    rol: str = Form(...),
    seniority: str = Form(""),
    experiencia_entrevistas: str = Form(""),
    historial_entrevistas: str = Form(""),
    enfoque: str = Form("Liderazgo y Estrategia"),
    cantidad_preguntas: str = Form("3"),
    idioma: str = Form("Español"),
    jd: str = Form(None),
    cv: UploadFile = File(None),
):
    client = get_client(x_gemini_api_key)

    cv_texto = ""
    if cv and hasattr(cv, "filename") and cv.filename:
        cv_bytes = await cv.read()
        if cv_bytes:
            future = _pdf_executor.submit(extraer_texto_cv, cv, cv_bytes)
            try:
                cv_texto = future.result(timeout=PDF_TIMEOUT_SEGUNDOS)
            except FutureTimeoutError:
                # Seguimos sin el CV en vez de colgar la petición para siempre.
                cv_texto = ""

    # OJO: pedimos "cantidad_preguntas" + una reserva chica de más. Esas
    # preguntas extra no se muestran de entrada: el frontend las guarda
    # aparte y las usa para el botón "Cambiar pregunta" (swap in-place si a
    # alguien le toca una pregunta muy específica/técnica que no sabe
    # responder). Van todas en la MISMA llamada a Gemini, así que esto no
    # consume cuota extra.
    try:
        cantidad_int = max(1, int(cantidad_preguntas))
    except (TypeError, ValueError):
        cantidad_int = 3
    reserva_extra = 2
    total_a_generar = cantidad_int + reserva_extra

    # El seniority es opcional (algunos roles — líder de un área, CFO, etc. —
    # no siempre tienen un nivel claro, o la JD no lo especifica). Si no se
    # eligió ninguno, no lo mencionamos y dejamos que Gemini calibre la
    # dificultad con el rol y la JD, en vez de forzar un nivel arbitrario.
    linea_seniority = f"Seniority: {seniority.strip()}\n    " if seniority and seniority.strip() else ""
    nivel_experiencia = NIVELES_EXPERIENCIA.get(experiencia_entrevistas, NIVEL_EXPERIENCIA_DEFAULT)

    # Memoria entre sesiones: el frontend manda un resumen de las sesiones
    # anteriores de esta persona EN ESTE simulador (sacado de la tabla
    # "simulaciones" en Supabase), cuando existen. Es un dato real, más
    # confiable que el autoreporte de "experiencia_entrevistas" de arriba —
    # por eso, si hay contradicción entre los dos, le decimos a Gemini que
    # priorice este.
    bloque_historial = ""
    if historial_entrevistas and historial_entrevistas.strip():
        bloque_historial = f"""
    Historial REAL de esta persona en este mismo simulador (más confiable
    que la auto-declaración de arriba si hay contradicción entre los dos):
    tiene sesiones anteriores registradas acá. Usalo para calibrar la
    dificultad y, cuando tenga sentido, generar alguna pregunta que retome
    o profundice un punto débil mencionado ahí, en vez de ignorar que ya
    practicó antes en esta plataforma:

    {historial_entrevistas.strip()[:3000]}
    """

    prompt = f"""
    Actúa como un reclutador exigente.
    Genera exactamente {total_a_generar} preguntas de entrevista en idioma {idioma}.
    Rol objetivo: {rol}
    {linea_seniority}Enfoque: {enfoque}
    JD: {jd if jd else 'No provista'}
    CV: {cv_texto if cv_texto else 'No provisto'}

    Experiencia previa de la persona entrevistándose (ajustá la dificultad
    y el estilo de las preguntas en base a esto): {nivel_experiencia}
    {bloque_historial}

    Las primeras {cantidad_int} preguntas son las que se van a usar en la
    entrevista. Las últimas {reserva_extra} son preguntas "de repuesto":
    deben cubrir los mismos temas/enfoque pero NO ser reformulaciones triviales
    de las primeras, para que sirvan como alternativa real si el candidato
    pide cambiar una pregunta.

    Cada pregunta debe ser abierta, natural y de máximo 2 oraciones.

    Responde EXCLUSIVAMENTE con un JSON que tenga este formato exacto y nada más:
    {{
      "preguntas": [
        "Pregunta 1...",
        "Pregunta 2..."
      ]
    }}
    """

    texto, _modelo = llamar_gemini_con_fallback(client, prompt, config=JSON_CONFIG)
    return extraer_json_seguro(texto)


@app.post("/api/evaluar-respuesta")
async def evaluar_respuesta(
    x_gemini_api_key: str = Header(None, alias="x-gemini-api-key"),
    pregunta: str = Form(...),
    idioma: str = Form("Español"),
    audio: UploadFile = File(...),
):
    """Feedback rápido de oratoria/tono apenas el candidato graba una
    respuesta (no evalúa el contenido a fondo, eso pasa en /api/informe-final
    al terminar todas las preguntas)."""
    client = get_client(x_gemini_api_key)

    audio_bytes = await audio.read()
    wav_bytes, duracion = convertir_audio_a_wav(audio_bytes, audio.filename)

    if duracion <= 0:
        return {
            "duracion_segundos": duracion,
            "ppm": 0,
            "palabras_aprox": 0,
            "evaluacion_ritmo": "N/A",
            "tono_emocional": "Sin audio",
            "consejo_oratoria": "No se detectó audio en la grabación. Intentá grabar de nuevo.",
            "transcripcion": "",
        }

    prompt = f"""
    Analiza este audio de una respuesta a la pregunta de entrevista: "{pregunta}"

    Proporcioná un diagnóstico breve sobre la oratoria y la emocionalidad de
    la voz (no evalúes el contenido técnico todavía, solo la forma de hablar).

    Respondé en idioma {idioma}, EXCLUSIVAMENTE con un JSON con este formato
    exacto y nada más:
    {{
      "transcripcion": "transcripción resumida de lo que dijo el candidato",
      "palabras_aprox": 120,
      "evaluacion_ritmo": "Adecuado / Muy Rápido / Lento",
      "tono_emocional": "Confiado y Seguro / Apagado y Desinteresado / Monótono / Entusiasta / Nervioso",
      "consejo_oratoria": "Un consejo de 1 frase sobre la energía, entonación o actitud detectada en la voz."
    }}
    """

    contents = [prompt, types.Part.from_bytes(data=wav_bytes, mime_type="audio/wav")]
    try:
        texto, _modelo = llamar_gemini_con_fallback(client, contents, config=JSON_CONFIG)
        data = extraer_json_seguro(texto)
    except HTTPException as he:
        # No bloqueamos la simulación si falla el análisis de oratoria de UNA
        # respuesta puntual; seguimos igual, pero avisamos claro si fue por
        # cuota agotada (para que no parezca que la app está rota).
        if he.status_code == 429:
            aviso = f"{he.detail} Tu respuesta quedó guardada igual."
        elif he.status_code == 503:
            aviso = (
                "Google está con mucha demanda en este momento (no es un problema tuyo ni de tu "
                "cuota). Tu respuesta quedó guardada igual."
            )
        else:
            # Antes esto tapaba CUALQUIER otro motivo de fallo (JSON mal formado,
            # error 502, etc.) con un mensaje genérico que no decía nada. Ahora
            # mostramos el detalle real para poder diagnosticar sin depender de
            # mirar los logs de Render cada vez.
            aviso = (
                "No se pudo analizar el audio en detalle, pero tu respuesta quedó guardada. "
                f"(Detalle: {str(he.detail)[:200]})"
            )
        data = {
            "transcripcion": "",
            "palabras_aprox": 0,
            "evaluacion_ritmo": "Normal",
            "tono_emocional": "Equilibrado",
            "consejo_oratoria": aviso,
        }

    palabras = data.get("palabras_aprox", 0) or 0
    ppm = round(palabras / (duracion / 60)) if duracion > 0 else 0

    data["ppm"] = ppm
    data["duracion_segundos"] = duracion
    data.setdefault("evaluacion_ritmo", "Normal")
    data.setdefault("tono_emocional", "Equilibrado")
    data.setdefault("consejo_oratoria", "")
    return data


@app.post("/api/informe-final")
async def informe_final(
    x_gemini_api_key: str = Header(None, alias="x-gemini-api-key"),
    rol: str = Form(...),
    seniority: str = Form(""),
    experiencia_entrevistas: str = Form(""),
    historial_entrevistas: str = Form(""),
    idioma: str = Form("Español"),
    jd: str = Form(None),
    preguntas_meta: str = Form(...),
    audios: list[UploadFile] = File(...),
):
    """Genera el informe final completo escuchando TODAS las respuestas
    grabadas de la simulación (no solo su transcripción)."""
    client = get_client(x_gemini_api_key, timeout_ms=90000)

    try:
        meta = json.loads(preguntas_meta)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="preguntas_meta no es un JSON válido.")

    if len(meta) != len(audios):
        raise HTTPException(
            status_code=400,
            detail=f"La cantidad de preguntas ({len(meta)}) no coincide con la de audios ({len(audios)}).",
        )

    # Igual que en /api/generar-pregunta: seniority es opcional. Si no se
    # especificó, no lo mencionamos en el título (ej. un CFO no necesita que
    # le agreguemos un nivel al lado del cargo).
    clausula_seniority = f" con nivel '{seniority.strip()}'" if seniority and seniority.strip() else ""
    nivel_experiencia = NIVELES_EXPERIENCIA.get(experiencia_entrevistas, NIVEL_EXPERIENCIA_DEFAULT)

    # Mismo mecanismo de memoria que en /api/generar-pregunta: si el
    # frontend manda historial real de sesiones anteriores, se lo pasamos a
    # Gemini para que el informe compare explícitamente contra la vez
    # pasada, en vez de evaluar esta sesión en el vacío.
    bloque_historial = ""
    if historial_entrevistas and historial_entrevistas.strip():
        bloque_historial = f"""
    Historial REAL de sesiones anteriores de esta persona en este mismo
    simulador (más confiable que la auto-declaración de arriba si hay
    contradicción entre los dos):

    {historial_entrevistas.strip()[:3000]}
    """

    contents = [f"""
    Sos un Reclutador Executive / Headhunter con mucha calle, evaluando una
    simulación de entrevista para el puesto '{rol}'{clausula_seniority}.
    Job Description: {jd if jd else 'No provista'}.

    Experiencia previa de la persona entrevistándose (usala para calibrar tu
    nivel de exigencia en el informe, ver más abajo): {nivel_experiencia}
    {bloque_historial}

    A continuación vas a escuchar, pregunta por pregunta, los audios reales con las
    respuestas del candidato (te indico también la duración y el ritmo de habla medidos
    de cada una). Evaluá el CONTENIDO de las respuestas (no solo la forma) usando la
    metodología STAR (Situación/Contexto, Tarea, Acción, Resultado), buscando gaps
    técnicos y de competencias para el rol, y el tono/emocionalidad de la voz.

    DIRECTIVAS DE ESTILO PARA EL INFORME (campo "informe_markdown"):
    - Escribilo 100% en idioma {idioma}, en Markdown.
    - Usá SIEMPRE la técnica del sándwich, sin importar el nivel de exigencia que
      te toque aplicar: arrancá reconociendo algo concreto que estuvo bien,
      después marcá los puntos débiles con total honestidad y ejemplos
      concretos (sin suavizarlos ni esconderlos), y cerrá con un mensaje que
      motive a seguir mejorando. Nunca un párrafo que sea solo crítica dura de
      punta a punta — el objetivo es que la persona se vaya con ganas de
      mejorar, no devastada, incluso cuando la entrevista haya sido floja.
    - Calibrá qué tan exigente sos (tanto en las notas como en el texto) según
      la experiencia previa de la persona entrevistándose, indicada arriba:
      con alguien que nunca se entrevistó, priorizá la contención por sobre
      la dureza técnica; con alguien con mucho rodaje, podés ser más directo
      y exigente, siempre dentro de la técnica del sándwich.
    - Si hay un historial REAL de sesiones anteriores (indicado arriba),
      mencioná explícitamente en el párrafo de apertura cómo se compara
      ESTA sesión con la anterior: qué mejoró de forma concreta y qué
      punto débil sigue costando igual, en vez de evaluar esta sesión en
      el vacío como si fuera la primera vez. Si no hay historial (primera
      sesión de la persona en la plataforma), no inventes una comparación.
    - Usá EXACTAMENTE esta estructura y estos títulos (podés ajustar el contenido,
      no el formato ni los emojis).
    - MUY IMPORTANTE, formato Markdown real (esto es lo que hace que se lea bien,
      no lo saltees):
      * Cada uno de los 7 títulos numerados de abajo va precedido por "## "
        (encabezado Markdown nivel 2), solo en su propia línea.
      * SIEMPRE dejá una línea en blanco entre un título y el texto que le sigue
        (nunca escribas el título pegado al párrafo en la misma línea).
      * Para listas DENTRO de una sección (el desglose de notas, los 3 consejos,
        etc.) usá SIEMPRE viñetas con guion "- ", nunca numeración tipo "1. 2. 3."
        — si numerás los ítems internos, se confunden visualmente con la
        numeración de las 7 secciones principales y arruinan la lectura.
      * El párrafo de apertura después del título "📊 Informe Final de Selección"
        también va separado por una línea en blanco, como un párrafo propio.

    ## 📊 Informe Final de Selección

    (un párrafo de apertura directo, sin filtros, con el veredicto general)

    ## 1. 🎯 DESGLOSE DE NOTAS

    (lista con guiones "- " de NOTA_GLOBAL, NOTA_TECNICA, NOTA_STAR, NOTA_ORATORIA,
    NOTA_TONO, cada una en x/10 con una breve justificación entre paréntesis)

    ## 2. ⏱️ ANÁLISIS DE SÍNTESIS, TIEMPO Y RITMO POR RESPUESTA

    (un ítem con guion "- " por cada pregunta, citando su duración y PPM reales,
    con crítica concreta de qué le faltó o qué estuvo bien en el contenido de esa
    respuesta puntual)

    ## 3. 💡 EVALUACIÓN TÉCNICA Y GAP ANALYSIS

    (qué se espera para ese rol/seniority y qué gap concreto mostró el candidato)

    ## 4. 🌟 ANÁLISIS METODOLOGÍA S.T.A.R. Y DETALLE

    (Contexto, Tarea, Acción y Resultado, cada uno como ítem con guion "- " y con
    ✅ o ❌ según si estuvo presente en las respuestas, y una explicación breve)

    ## 5. 🎭 ANÁLISIS DE EMOCIONALIDAD Y TONO VOCAL

    (párrafo sobre seguridad, energía y profesionalismo percibido en la voz)

    ## 6. 🚀 3 CONSEJOS CLAVE DE MEJORA CRÍTICOS

    (3 consejos como ítems con guion "- ", concretos y accionables — NO uses
    numeración acá)

    ## 7. 📌 RESPUESTAS MODELO SUGERIDAS (EJEMPLOS IDEALES)

    (para cada pregunta, un ítem con guion "- " con una respuesta ideal completa
    redactada en primera persona siguiendo STAR, marcando entre paréntesis qué
    parte es Contexto/Tarea/Acción/Resultado)

    Respondé EXCLUSIVAMENTE con un JSON con este formato exacto y nada más
    (sin bloques de código, sin texto fuera del JSON):
    {{
      "notas": {{
        "global": 7.0,
        "tecnica": 7.5,
        "star": 6.0,
        "oratoria": 7.0,
        "tono": 8.0
      }},
      "informe_markdown": "el informe completo en markdown, con la estructura de arriba"
    }}

    A continuación, las preguntas con sus audios:
    """]

    for item, audio in zip(meta, audios):
        audio_bytes = await audio.read()
        wav_bytes, duracion = convertir_audio_a_wav(audio_bytes, audio.filename)
        pregunta = item.get("pregunta", "")
        ppm = item.get("ppm", 0)
        tono = item.get("tono_emocional", "N/A")
        contents.append(
            f"\nPregunta: {pregunta}\n(Duración medida: {duracion} segs, Velocidad medida: {ppm} PPM, "
            f"Tono detectado: {tono})"
        )
        contents.append(types.Part.from_bytes(data=wav_bytes, mime_type="audio/wav"))

    texto, _modelo = llamar_gemini_con_fallback(client, contents, config=JSON_CONFIG)
    data = extraer_json_seguro(texto)
    data.setdefault("notas", {})
    data.setdefault("informe_markdown", texto)
    return data


@app.post("/api/analizar-perfil-linkedin")
async def analizar_perfil_linkedin(
    x_gemini_api_key: str = Header(None, alias="x-gemini-api-key"),
    rol_objetivo: str = Form(None),
    idioma: str = Form("Español"),
    objetivo_libre: str = Form(None),
    perfil: UploadFile = File(...),
):
    """Analiza el PDF que LinkedIn genera al exportar el PROPIO perfil del
    usuario (Perfil > botón 'Más' > 'Guardar en PDF') y devuelve sugerencias
    concretas de mejora. Reutiliza extraer_texto_cv porque la extracción de
    texto de un PDF es la misma lógica, sea CV o perfil de LinkedIn."""
    client = get_client(x_gemini_api_key)

    perfil_bytes = await perfil.read()
    if not perfil_bytes:
        raise HTTPException(status_code=400, detail="El archivo llegó vacío.")

    future = _pdf_executor.submit(extraer_texto_cv, perfil, perfil_bytes)
    try:
        perfil_texto = future.result(timeout=PDF_TIMEOUT_SEGUNDOS)
    except FutureTimeoutError:
        raise HTTPException(
            status_code=400,
            detail="El PDF tardó demasiado en procesarse. Probá con otro archivo.",
        )

    if not perfil_texto or len(perfil_texto.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail=(
                "No pudimos leer texto de ese PDF. Asegurate de subir el PDF que "
                "exporta LinkedIn desde tu propio perfil (botón 'Más' > 'Guardar en "
                "PDF'), no una captura de pantalla ni otro tipo de archivo."
            ),
        )

    # Modo "dirigido" (con rol objetivo) vs. "objetivo" (sin rol — evaluar el
    # perfil tal como está, con criterios universales, sin comparar contra
    # ninguna vacante puntual). Esto cambia varias partes del prompt, así que
    # armamos los bloques de texto por separado en vez de meter un "if" gigante
    # dentro del f-string.
    tiene_rol = bool(rol_objetivo and rol_objetivo.strip())

    if tiene_rol:
        bloque_contexto = f"""
    Rol/puesto al que apunta esta persona: {rol_objetivo}

    Contexto adicional que la persona escribió con sus propias palabras sobre lo
    que busca lograr (puede matizar, combinar roles, o explicar una situación
    particular — ej. "quiero pasar a role de gestión de personas pero todavía no
    tengo tanto seniority, así que busco algo intermedio"). Si está presente,
    dale prioridad por sobre el campo de rol solo, y hacé que el headline, el
    "acerca de" y las palabras clave sugeridas reflejen ese matiz real, no un
    único título genérico: {objetivo_libre if objetivo_libre and objetivo_libre.strip() else 'No provisto'}
    """
        instruccion_apertura = "pensando en el rol objetivo indicado arriba"
        instruccion_headline = "pensadas específicamente para el rol objetivo"
        instruccion_palabras_clave = (
            "que le faltan al perfil para EL ROL OBJETIVO indicado, que un reclutador "
            "buscando ese rol puntual buscaría en LinkedIn"
        )
        instruccion_booleano = (
            "que un reclutador escribiría para encontrar a alguien con el ROL OBJETIVO "
            "de esta persona (el que indicó, no necesariamente el que tiene hoy)"
        )
    else:
        bloque_contexto = """
    Esta persona NO indicó ningún rol objetivo puntual: quiere un análisis
    OBJETIVO de su perfil tal como está, sin compararlo contra ninguna vacante
    específica. Evaluá con criterios universales de un buen perfil de LinkedIn
    (claridad, estructura, logros concretos vs. tareas genéricas, densidad de
    palabras clave), e inferí vos mismo cuál es su área/campo profesional a
    partir de su propia experiencia real — NO le asignes un objetivo o
    aspiración que la persona no expresó.
    """
        instruccion_apertura = (
            "sobre la calidad y claridad general del perfil — SIN apuntar a un rol "
            "específico, ya que la persona no indicó ninguno"
        )
        instruccion_headline = (
            "que reflejen con más claridad y fuerza su trayectoria y área profesional "
            "REAL actual (inferida de su experiencia), sin inventarle un objetivo que "
            "no expresó"
        )
        instruccion_palabras_clave = (
            "que son estándar en SU PROPIO campo profesional (inferido de su "
            "experiencia real, no de un rol aspiracional) y le faltan para que el "
            "perfil sea más encontrable en general"
        )
        instruccion_booleano = (
            "que un reclutador escribiría para encontrar a alguien con la EXPERIENCIA "
            "Y EL PUESTO ACTUAL de esta persona (no un objetivo aspiracional, porque no "
            "indicó ninguno)"
        )

    prompt = f"""
    Actuá como un consultor experto en LinkedIn y reclutamiento. Tu OBJETIVO
    PRINCIPAL, casi excluyente, es maximizar las chances de que esta persona
    sea ENCONTRADA por reclutadores y headhunters en LinkedIn (que la
    "hunteen") — más gente encontrando este perfil en una búsqueda es la
    métrica de éxito de todo tu análisis. La redacción, el storytelling y la
    prolijidad del perfil NO son un fin en sí mismos: son un medio para ese
    objetivo (un perfil se lee bien y además dice las palabras que un
    reclutador escribe en su buscador). Ante cualquier disyuntiva entre "esto
    suena más elegante" y "esto tiene más términos de búsqueda reales que un
    reclutador usaría", elegí siempre la segunda opción.

    Basá tu análisis en marcos y prácticas reconocidas del rubro, aplicándolos
    con criterio. IMPORTANTE: son para guiar TU razonamiento interno, NUNCA
    los nombres ni los mencionás en el texto del informe que lee la persona
    (nunca escribas "framework AIDA", "método STAR", "según el SSI", etc. —
    el informe tiene que sonar 100% a vos como consultor, no a una lista de
    metodologías):
    - Las mejores prácticas de LinkedIn Talent Solutions sobre cómo indexan y
      priorizan los reclutadores un perfil en sus búsquedas (relevancia de
      palabras clave EXACTAS en título/experiencia/aptitudes, completitud del
      perfil) — este es el criterio más importante de todos.
    - El SSI (Social Selling Index) de LinkedIn, para pensar el perfil en
      términos de qué tan ENCONTRABLE es y qué tan bien conecta con las
      personas correctas — no solo como una lista de datos prolija.
    - El framework AIDA (Atención, Interés, Deseo, Acción) para que el
      titular y las primeras líneas del "Acerca de" retengan la atención del
      reclutador el tiempo suficiente para que note las palabras clave — no
      como un objetivo de redacción aislado.
    - Estándares de Talent Acquisition (en línea con SHRM) para diferenciar
      tareas de logros: todo logro fuerte responde qué se hizo, para qué, y
      con qué resultado, usando los términos exactos que un selector busca —
      no alcanza con listar responsabilidades.
    - El método STAR (Situación, Tarea, Acción, Resultado) para estructurar
      las reescrituras de experiencia laboral de la sección 4, siempre
      priorizando que el texto incluya las palabras clave reales del rol.
    {bloque_contexto}
    A continuación, el texto extraído del PDF que la persona exportó de su propio
    perfil de LinkedIn:
    ---
    {perfil_texto[:12000]}
    ---

    DIRECTIVAS DE ESTILO PARA EL INFORME:
    - Escribilo 100% en idioma {idioma}, en Markdown.
    - Tono directo y constructivo, como un consultor de carrera real: señalá lo que
      no funciona sin filtros, pero siempre con sugerencias concretas y accionables,
      no solo críticas.
    - Usá EXACTAMENTE esta estructura y estos títulos (podés ajustar el contenido,
      no el formato ni los emojis).
    - MUY IMPORTANTE, formato Markdown real:
      * Cada título numerado de abajo va precedido por "## " (encabezado Markdown
        nivel 2), solo en su propia línea.
      * SIEMPRE dejá una línea en blanco entre un título y el texto que le sigue.
      * Para listas DENTRO de una sección usá SIEMPRE viñetas con guion "- ", nunca
        numeración tipo "1. 2. 3.".
      * El párrafo de apertura después del título "📈 Informe de tu Perfil de
        LinkedIn" también va separado por una línea en blanco, como un párrafo propio.
    - MUY IMPORTANTE, el informe entero NO va en un solo campo: lo partimos en 6
      campos de markdown independientes (ver el JSON de más abajo), uno por bloque
      de secciones. Esto es a propósito, para que el frontend pueda ubicar los
      botones de "copiar y pegar" siempre en el lugar correcto sin tener que
      adivinar dónde empieza o termina cada sección buscando texto. Cada campo
      tiene que ser markdown válido y autocontenido (con sus propios títulos "## "),
      de forma que si los concatenamos en orden con una línea en blanco en el medio,
      el resultado sea el informe completo y coherente.

    CAMPO "intro_markdown" — contiene:

    ## 📈 Informe de tu Perfil de LinkedIn

    (un párrafo de apertura directo con el veredicto general, {instruccion_apertura})

    ## 1. 🎯 DESGLOSE DE PUNTAJES

    (lista con guiones "- " de PUNTAJE_GLOBAL, PUNTAJE_HEADLINE, PUNTAJE_ACERCA_DE,
    PUNTAJE_EXPERIENCIA, PUNTAJE_PALABRAS_CLAVE, cada uno en x/10 con una breve
    justificación entre paréntesis)

    CAMPO "titular_markdown" — contiene:

    ## 2. 🖋️ TITULAR (HEADLINE)

    (crítica del titular actual priorizando cuántos términos de búsqueda reales
    tiene hoy, y 2-3 alternativas concretas ya redactadas, listas para copiar y
    pegar, {instruccion_headline}. Cada alternativa tiene que maximizar la
    cantidad de palabras clave exactas que un reclutador buscaría, dentro del
    límite de caracteres del titular de LinkedIn — priorizá esto por sobre que
    "suene lindo".)

    REGLA IMPORTANTE para las alternativas de titular: nunca le asignes a la persona
    un título de seniority/liderazgo (Leader, Head, Manager, Director, Sr., etc.) que
    su experiencia en el perfil no respalde todavía. Si el rol objetivo o el contexto
    adicional (cuando la persona los indicó) muestran una ASPIRACIÓN por encima de su nivel actual, reflejá esa
    dirección de crecimiento sin inventar un título que no tiene (por ejemplo, usando
    las áreas de expertise sin el título de liderazgo, o frases como "con foco en" /
    "en camino a", en vez de directamente "Leader" o "Manager"). Un titular inflado
    genera desconfianza cuando el reclutador lo compara con la experiencia real.

    CAMPO "acerca_de_markdown" — contiene:

    ## 3. 📝 SECCIÓN "ACERCA DE"

    (qué falla en la sección actual —si no está, decilo—, evaluando ante todo
    cuántos términos de búsqueda reales de su campo aparecen hoy escritos de
    forma literal. Después, una versión reescrita completa sugerida, en primera
    persona, de 3-4 párrafos, priorizando meter la mayor cantidad posible de
    palabras clave reales de forma natural. Cerrala SIEMPRE con un bloque corto
    tipo "Áreas de expertise:" con esas palabras clave en formato de lista o
    separadas por "|" — es el lugar más efectivo para sumar términos exactos de
    búsqueda sin que la prosa se sienta forzada.)

    CAMPO "experiencia_markdown" — contiene:

    ## 4. 💼 EXPERIENCIA LABORAL

    (para CADA rol relevante del perfil — no solo el primero o uno al azar, todos
    los que aporten — un bloque así:
    - "**[Empresa — Puesto]**" en negrita como encabezado del ítem.
    - Un párrafo corto señalando si la descripción actual muestra logros medibles
      o solo tareas genéricas.
    - "❌ Antes:" seguido de un párrafo entre comillas con la descripción actual
      (o una paráfrasis fiel si el texto original es muy pobre o inexistente).
    - "✅ Después:" seguido de un párrafo entre comillas con la descripción
      reescrita completa para ese rol, lista para pegar directo en LinkedIn.
    Repetí este bloque completo para cada experiencia relevante.)

    REGLA IMPORTANTE para las versiones "✅ Después" — el "Después" NO puede ser
    el mismo texto del "Antes" solo cortado en viñetas o reordenado: eso NO
    cuenta como reescritura. Cada punto del "Después" tiene que:
    1. Empezar con un verbo de acción fuerte (ej. "Diseñé", "Lideré", "Reduje",
       "Implementé" — nunca sustantivos sueltos tipo "Dirección de..." o
       "Gestión de...").
    2. Mostrar el IMPACTO o el PARA QUÉ de esa tarea (qué mejoró, a quién le
       sirvió, qué problema resolvió), no solo repetir qué se hizo.
    3. Incluir los términos de búsqueda EXACTOS y reales de ese rol/industria
       (los mismos que un reclutador escribiría) — si el "Antes" ya los tiene,
       conservalos; si los dice de forma indirecta o con sinónimos, en el
       "Después" usá el término literal que se busca en LinkedIn.
    Y nunca inventes una métrica, porcentaje o resultado numérico que la
    persona no mencionó (ej. "aumenté las ventas un 35%" si ese número no está
    en el texto original). Si el perfil ya trae un número o resultado
    concreto, usalo. Si NO lo trae, el punto reescrito TIENE que incluir un
    placeholder explícito donde iría ese dato — no es opcional, no lo dejes
    pasar (ej. "reduje el tiempo de onboarding en [completar con tu %/cifra
    real]"), en vez de inventarle un resultado falso que podría quedar mal si
    un reclutador se lo pregunta.

    CAMPO "palabras_clave_markdown" — contiene:

    ## 5. 🔑 PALABRAS CLAVE PARA RECLUTADORES

    (Esta es la sección más importante de todo el informe — el objetivo número
    uno de este análisis es que más reclutadores encuentren este perfil, y acá
    es donde eso se juega. Sé generoso/a: mejor pecar de dar más términos útiles
    que de quedarte corto/a. Dividí esta sección en dos partes con estos
    subtítulos exactos:

    ### ✅ Podés sumar ya

    Con guion "- ", entre 6 y 8 palabras clave {instruccion_palabras_clave} que
    además tengan ALGO concreto en la experiencia real de la persona donde
    apoyarse (una tarea, logro o responsabilidad que ya tuvo, aunque no la haya
    descripto con ese término exacto). NO inventes tareas que la persona no hizo.
    Para cada una:
    - La palabra clave en negrita.
    - "📍 Dónde sumarla:" indicando el lugar puntual y real (ej. "en tu experiencia
      en [Empresa], en la línea donde contás [tarea]", o "en el Acerca de").
    - "📋 Lista para copiar y pegar ahí:" con una frase ya redactada que incorpora
      el término naturalmente en ese contexto real.

    REGLA IMPORTANTE para esas frases de "📋 Lista para copiar y pegar ahí": nunca
    hagas que la persona se atribuya, en primera persona, un cargo o rol de
    seniority/liderazgo que no tuvo (ej. "Actué como HR Lead...", "Como Team
    Leader...", "Fui la Head de..." si eso no figura en su experiencia real) — es
    el mismo problema de inflar un título que ya evitamos en el titular, y acá es
    igual de grave porque la persona lo pegaría tal cual en su experiencia laboral.
    La palabra clave tiene que entrar en la frase describiendo una TAREA, herramienta
    o responsabilidad real que la persona ya tuvo, no un título que se apropia. Si la
    única forma natural de meter el término implica un cargo que no tuvo, replanteá
    la frase para que hable de la función o tarea en vez del cargo (ej. en vez de
    "Actué como HR Lead estructurando el área de personas", mejor "Estructuré el área
    de personas desde cero, cubriendo tareas propias de un rol de HR Lead" o directamente
    dejar solo la tarea con el término de búsqueda, sin adjudicarse el título).

    ### 🔲 Todavía no están respaldadas en tu perfil

    Un párrafo breve aclarando que estos términos son búsquedas frecuentes en su
    campo pero no aparecen respaldados por nada concreto en su perfil actual, y
    que NO hay que sumarlos si no los hizo — pero que si en algún momento tuvo ese
    tipo de responsabilidad y no la detalló, valdría la pena agregarla. Después,
    con guion "- ", la lista de esos términos.)

    CAMPO "cierre_markdown" — contiene:

    ## 6. 🔎 TIPS: CÓMO TE ENCUENTRAN LOS RECLUTADORES (BÚSQUEDA BOOLEANA)

    (Esta sección es nueva y muy importante — seguí exactamente esta lógica:
    1. Un párrafo breve explicando que los reclutadores (sobre todo con LinkedIn
       Recruiter) no leen perfiles uno por uno: escriben búsquedas con operadores
       booleanos (AND, OR, NOT, comillas para frase exacta) y el sistema solo
       muestra perfiles que contienen esas palabras EXACTAS en algún lugar
       (titular, "Acerca de", experiencia o aptitudes) — no entiende sinónimos ni
       contexto como una IA.
    2. Con guion "- ", 1 o 2 ejemplos REALISTAS de búsqueda booleana {instruccion_booleano},
       usando el formato real de LinkedIn Recruiter (paréntesis, AND, OR,
       comillas). Basate en las palabras clave de la sección 5.
    3. Un párrafo evaluando honestamente si el perfil ACTUAL (tal como está hoy,
       antes de los cambios sugeridos) matchearía o no esas búsquedas, y por qué
       (casi siempre NO va a matchear si el titular/palabras clave no están
       escritos literalmente en el perfil actual — decilo explícito).
    4. Un párrafo mostrando que, aplicando el titular/"Acerca de" sugeridos en las
       secciones 2 y 3, el perfil SÍ empezaría a matchear esas búsquedas, citando
       qué término exacto ahora aparece.
    5. Cerrá con un ítem con guion "- " remarcando la idea clave: no alcanza con
       tener la experiencia relevante, el término EXACTO que buscaría un
       reclutador tiene que estar escrito palabra por palabra en el perfil.)

    ## 7. 🚀 3 ACCIONES PRIORITARIAS PARA ESTA SEMANA

    (3 acciones como ítems con guion "- ", concretas y accionables — NO uses
    numeración acá)

    Respondé EXCLUSIVAMENTE con un JSON con este formato exacto y nada más (sin
    bloques de código, sin texto fuera del JSON):
    {{
      "puntajes": {{
        "global": 7.0,
        "headline": 6.5,
        "acerca_de": 7.0,
        "experiencia": 7.5,
        "palabras_clave": 6.0
      }},
      "intro_markdown": "## 📈 Informe...\\n\\n...\\n\\n## 1. 🎯 DESGLOSE DE PUNTAJES\\n\\n...",
      "titular_markdown": "## 2. 🖋️ TITULAR (HEADLINE)\\n\\n...",
      "acerca_de_markdown": "## 3. 📝 SECCIÓN \\"ACERCA DE\\"\\n\\n...",
      "experiencia_markdown": "## 4. 💼 EXPERIENCIA LABORAL\\n\\n...",
      "palabras_clave_markdown": "## 5. 🔑 PALABRAS CLAVE PARA RECLUTADORES\\n\\n...",
      "cierre_markdown": "## 6. 🔎 TIPS...\\n\\n...\\n\\n## 7. 🚀 3 ACCIONES PRIORITARIAS PARA ESTA SEMANA\\n\\n..."
    }}
    """

    texto, modelo_usado = llamar_gemini_con_fallback(client, prompt, config=JSON_CONFIG_LINKEDIN)
    data = extraer_json_seguro(texto)
    data.setdefault("puntajes", {})
    for campo in (
        "intro_markdown",
        "titular_markdown",
        "acerca_de_markdown",
        "experiencia_markdown",
        "palabras_clave_markdown",
        "cierre_markdown",
    ):
        data.setdefault(campo, "")

    # Devolvemos qué modelo respondió esta vez (no se muestra en la UI, pero
    # queda visible en la respuesta de red / consola del navegador). Sirve
    # para diagnosticar si dos análisis "distintos" del mismo perfil se deben
    # a que cada uno lo resolvió un modelo diferente del fallback.
    data["modelo_usado"] = modelo_usado

    # El "informe_markdown" completo lo arma el backend concatenando los 6
    # campos, en vez de pedírselo a Gemini como un campo aparte: así garantizamos
    # que el texto que se descarga en PDF sea EXACTAMENTE la suma de las partes
    # que ya validamos/usamos en pantalla, sin una segunda versión que se pueda
    # desincronizar.
    data["informe_markdown"] = "\n\n".join(
        parte
        for parte in (
            data["intro_markdown"],
            data["titular_markdown"],
            data["acerca_de_markdown"],
            data["experiencia_markdown"],
            data["palabras_clave_markdown"],
            data["cierre_markdown"],
        )
        if parte
    ).strip()
    return data


@app.post("/api/linkedin-estrategia-contenido")
async def linkedin_estrategia_contenido(
    x_gemini_api_key: str = Header(None, alias="x-gemini-api-key"),
    objetivo_linkedin: str = Form(""),
    rol_objetivo: str = Form(None),
    idioma: str = Form("Español"),
    objetivo_libre: str = Form(None),
    perfil: UploadFile = File(...),
):
    """Genera una estrategia de contenido para LinkedIn (pilares + banco de
    ideas de posteos) pensada específicamente para alguien en BÚSQUEDA
    LABORAL — no para un creador de contenido o marketer que vende una
    audiencia, que es el público al que apuntan herramientas como Taplio o
    Supergrow. Reutiliza el mismo PDF de perfil que ya se sube en
    /api/analizar-perfil-linkedin (mismo patrón de extracción), para no
    pedírselo de nuevo a la persona."""
    client = get_client(x_gemini_api_key)

    perfil_bytes = await perfil.read()
    if not perfil_bytes:
        raise HTTPException(status_code=400, detail="El archivo llegó vacío.")

    future = _pdf_executor.submit(extraer_texto_cv, perfil, perfil_bytes)
    try:
        perfil_texto = future.result(timeout=PDF_TIMEOUT_SEGUNDOS)
    except FutureTimeoutError:
        raise HTTPException(
            status_code=400,
            detail="El PDF tardó demasiado en procesarse. Probá con otro archivo.",
        )

    if not perfil_texto or len(perfil_texto.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail=(
                "No pudimos leer texto de ese PDF. Asegurate de subir el PDF que "
                "exporta LinkedIn desde tu propio perfil (botón 'Más' > 'Guardar en "
                "PDF'), no una captura de pantalla ni otro tipo de archivo."
            ),
        )

    # Mismo patrón "dirigido" vs. "objetivo" que en /api/analizar-perfil-linkedin.
    tiene_rol = bool(rol_objetivo and rol_objetivo.strip())
    if tiene_rol:
        bloque_objetivo = f"""
    Rol/puesto al que apunta esta persona: {rol_objetivo}

    Contexto adicional que la persona escribió con sus propias palabras:
    {objetivo_libre if objetivo_libre and objetivo_libre.strip() else 'No provisto'}
    """
    else:
        bloque_objetivo = """
    Esta persona NO indicó ningún rol objetivo puntual: inferí vos mismo su
    área/campo profesional a partir de su propia experiencia real en el
    perfil, y pensá los pilares para esa área, sin asignarle una aspiración
    que no expresó.
    """

    # Objetivo elegido en la pestaña (vender / generar interacciones / que la
    # encuentren reclutadores) — a diferencia del rol objetivo, este campo
    # SÍ es obligatorio desde el frontend, pero igual se cubre el caso de
    # que llegue vacío (ej. llamadas directas a la API sin pasar por la UI).
    objetivo_linkedin_texto = (
        objetivo_linkedin.strip()
        if objetivo_linkedin and objetivo_linkedin.strip()
        else "No especificado — priorizá aumentar su empleabilidad general."
    )

    prompt = f"""
    Actuá como un consultor de marca personal en LinkedIn especializado en
    BUSCADORES DE EMPLEO — no en creadores de contenido ni en marketers que
    venden una audiencia (ese es el público de herramientas como Taplio o
    Supergrow, pero NO es el objetivo acá). Tu tarea es proponerle a esta
    persona una estrategia de contenido realista para generar visibilidad
    mientras busca trabajo, no para "hacerse conocido" en abstracto.

    Objetivo principal que esta persona busca con su estrategia de contenido
    (priorizá los pilares, las ideas y el cierre para ESTO por sobre
    cualquier otra cosa — es la variable más importante de todo el prompt):
    {objetivo_linkedin_texto}
    {bloque_objetivo}

    Perfil de LinkedIn real de esta persona (extraído de su propio PDF —
    usalo como la fuente de verdad de su trayectoria real, NUNCA inventes
    experiencia, logros o proyectos que no estén acá):
    \"\"\"
    {perfil_texto[:10000]}
    \"\"\"

    Dirigite a la persona en segunda persona ("vos"), en {idioma}, con un
    tono cercano y práctico, nunca genérico de curso de marketing.

    Generá entre 3 y 5 PILARES DE CONTENIDO personalizados a su trayectoria
    real y a su objetivo. Un pilar es un tema recurrente sobre el que puede
    postear repetidamente sin quedarse sin ideas — NO son temas genéricos de
    marketing ("liderazgo", "productividad") sino anclados en SU experiencia
    concreta y su situación actual: pensalos entre cosas como compartir el
    proceso de búsqueda con honestidad, aprendizajes concretos de su área,
    opiniones informadas sobre su industria, logros propios sin sonar
    autobombo, o comentar contenido de empresas/personas objetivo de forma
    genuina — pero SIEMPRE adaptado a SU caso real y a su objetivo elegido
    arriba, nunca repitiendo esta lista tal cual.

    Para cada pilar, generá entre 3 y 4 IDEAS DE POSTEOS concretas (el
    título/tema y el ángulo), ancladas en algo real de su perfil cuando sea
    posible (un logro, un proyecto, una situación de su propia experiencia)
    — nunca ideas genéricas tipo "5 tips para..." que podrían aplicarle a
    cualquiera. Para UNA de esas ideas por pilar (la más fuerte), además
    escribí el POSTEO COMPLETO de ejemplo (3-6 líneas, tono humano y
    conversacional, nunca corporativo ni con hashtags en exceso) — es para
    mostrar el formato, no para que lo copien tal cual.

    MUY IMPORTANTE — es CLAVE que menciones esto explícitamente en el cierre
    (campo "cierre_markdown"): postear no alcanza solo, hay que hacer crecer
    la red de forma deliberada conectando activamente con reclutadores,
    gente de Talent Acquisition y selectores/as de personal de su industria
    — son quienes más impactan sus chances reales de conseguir entrevistas,
    y sin una red que los incluya, hasta el mejor posteo tiene alcance
    limitado. Dale una acción concreta para esto (ej. "mandale una solicitud
    con una nota corta y genuina a X reclutadores de tu industria por
    semana", nunca un pedido de conexión vacío tipo "hola, te agrego").

    Respondé EXCLUSIVAMENTE con un JSON con este formato exacto y nada más
    (sin bloques de código, sin texto fuera del JSON):
    {{
      "intro_markdown": "## 📣 Tu estrategia de contenido en LinkedIn\\n\\n(2-3 párrafos: por qué esto importa para alguien buscando trabajo —no es \\"hacerse influencer\\", es que te vean antes de aplicar— y un resumen de por qué elegiste estos pilares puntuales para esta persona y su objetivo, anclado en su perfil real)",
      "pilares": [
        {{
          "nombre": "Nombre corto del pilar",
          "descripcion": "1-2 oraciones de qué trata este pilar y por qué le sirve a esta persona puntual",
          "ideas": [
            {{"titulo": "Título/tema del posteo", "angulo": "1 oración: el ángulo concreto, anclado en su experiencia real"}}
          ],
          "ejemplo_post": "el posteo completo de ejemplo para la idea más fuerte de este pilar, 3-6 líneas, tono humano"
        }}
      ],
      "cierre_markdown": "## 🗓️ Cómo arrancar\\n\\n(con guion \\"- \\", 4-5 acciones concretas: cadencia sugerida —2-3 veces por semana—, mezclar formatos, Y OBLIGATORIO la acción de conectar activamente con reclutadores/Talent Acquisition/selectores de su industria explicada arriba — siempre aplicado a ESTA persona y su objetivo, no genérico)"
    }}
    """

    texto, modelo_usado = llamar_gemini_con_fallback(client, prompt, config=JSON_CONFIG_CONTENIDO_LINKEDIN)
    data = extraer_json_seguro(texto)
    data.setdefault("intro_markdown", "")
    data.setdefault("cierre_markdown", "")
    data.setdefault("pilares", [])
    data["modelo_usado"] = modelo_usado
    return data


@app.post("/api/analizar-cv")
async def analizar_cv(
    x_gemini_api_key: str = Header(None, alias="x-gemini-api-key"),
    puesto_objetivo: str = Form(None),
    idioma: str = Form("Español"),
    cv: UploadFile = File(...),
):
    """Analiza un CV (PDF) y devuelve un informe de compatibilidad ATS +
    sugerencias de reescritura, comparado contra un puesto puntual (la
    descripción se pega como texto, no un link — para no meternos en temas de
    scraping). El frontend ahora siempre manda puesto_objetivo (se sacó el
    modo "general" de la UI, Ale pidió que la herramienta sea siempre
    dirigida), pero el endpoint deja la rama sin puesto funcionando por las
    dudas — no hace falta tocarla para este cambio."""
    client = get_client(x_gemini_api_key)

    cv_bytes = await cv.read()
    if not cv_bytes:
        raise HTTPException(status_code=400, detail="El archivo llegó vacío.")

    future = _pdf_executor.submit(extraer_texto_cv, cv, cv_bytes)
    try:
        cv_texto = future.result(timeout=PDF_TIMEOUT_SEGUNDOS)
    except FutureTimeoutError:
        raise HTTPException(
            status_code=400,
            detail="El PDF tardó demasiado en procesarse. Probá con otro archivo.",
        )

    if not cv_texto or len(cv_texto.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail=(
                "No pudimos leer texto de ese PDF. Asegurate de subir tu CV como PDF "
                "con texto real (no una imagen escaneada ni una captura de pantalla)."
            ),
        )

    # Modo "dirigido" (con descripción de puesto pegada) vs. "general" (sin
    # puesto — chequeo de salud del CV con criterios universales). Mismo
    # patrón que en analizar_perfil_linkedin.
    tiene_puesto = bool(puesto_objetivo and puesto_objetivo.strip())

    if tiene_puesto:
        bloque_contexto = f"""
    Descripción del puesto al que esta persona quiere postularse (pegada por
    ella misma, puede ser parcial o venir en cualquier formato — tratala como
    la fuente de verdad de qué palabras clave y requisitos busca ese puesto
    puntual):

    {puesto_objetivo.strip()}
    """
        instruccion_apertura = "comparando el CV específicamente contra ESTE puesto"
        instruccion_puntaje_match = (
            "un PUNTAJE DE MATCH real contra el puesto pegado arriba — qué tan cerca "
            "está este CV, en su estado actual, de pasar el filtro ATS y la lectura "
            "humana para ESTA búsqueda puntual"
        )
        instruccion_palabras_clave = (
            "que aparecen en la descripción del puesto pegada arriba y le faltan al "
            "CV actual, redactadas tal cual las escribió quien publicó el aviso"
        )
        instruccion_puntaje_palabras_clave = "qué tan bien matchea el CV contra el puesto pegado"
    else:
        bloque_contexto = """
    Esta persona NO pegó ninguna descripción de puesto puntual: quiere un
    chequeo GENERAL de la salud de su CV — estructura, logros medibles vs.
    tareas genéricas, y compatibilidad con sistemas ATS en general. Inferí vos
    mismo su área/campo profesional a partir de su propia experiencia real.
    """
        instruccion_apertura = (
            "sobre la salud general del CV — sin comparar contra un puesto específico, "
            "ya que la persona no pegó ninguno"
        )
        instruccion_puntaje_match = (
            "un PUNTAJE GENERAL de qué tan listo está este CV para pasar un filtro ATS "
            "típico de su industria (inferida de su propia experiencia), sin comparar "
            "contra ningún puesto puntual"
        )
        instruccion_palabras_clave = (
            "que son estándar para SU PROPIO campo profesional (inferido de su "
            "experiencia) y hoy no aparecen literalmente en el CV"
        )
        instruccion_puntaje_palabras_clave = "qué tan presente está la terminología estándar de su campo"

    prompt = f"""
    Actuá como un consultor experto en reclutamiento técnico y en cómo
    funcionan los sistemas ATS (Applicant Tracking Systems) que usan la
    mayoría de las empresas medianas/grandes para filtrar CVs antes de que los
    vea un humano. Tu objetivo es ayudar a esta persona a que su CV pase ese
    primer filtro automático Y además se lea bien si llega a un reclutador —
    ambas cosas, no solo una.
    {bloque_contexto}

    MUY IMPORTANTE sobre el diagnóstico de formato: a continuación te paso el
    texto que se extrajo de este CV con una herramienta de extracción simple y
    genérica — el mismo tipo de proceso que usa un ATS real para leer un PDF
    (ignora diseño, columnas, tablas e imágenes; solo saca el texto plano en
    el orden en que lo encuentra). Si el texto extraído se ve desordenado, con
    contenido mezclado fuera de secuencia, secciones que parecen faltar, o
    texto que no tiene sentido en el orden en que aparece, ESO ES EN SÍ MISMO
    evidencia de que el formato original (probablemente con columnas, tablas,
    cuadros de texto o un diseño gráfico complejo) es riesgoso para un ATS
    real — señalalo explícitamente como hallazgo, incluso si no podés ver el
    diseño original. Si en cambio el texto se lee ordenado y coherente de
    principio a fin, es una señal de que el formato es razonablemente seguro.

    Texto extraído del CV:
    \"\"\"
    {cv_texto[:12000]}
    \"\"\"

    - Dirigite a la persona en segunda persona ("vos"), en {idioma}, con un
      tono profesional pero cercano — honesto, sin vueltas, pero constructivo.
    - Usá EXACTAMENTE esta estructura y estos títulos (podés ajustar el
      contenido, no el formato ni los emojis).
    - MUY IMPORTANTE, formato Markdown real:
      * Cada título numerado va precedido por "## ", solo en su propia línea.
      * SIEMPRE dejá una línea en blanco entre un título y el texto que le sigue.
      * Para listas DENTRO de una sección usá SIEMPRE viñetas con guion "- ".
    - MUY IMPORTANTE: el informe se parte en 5 campos de markdown
      independientes (ver el JSON de más abajo), mismo motivo que en la
      herramienta de LinkedIn — que el frontend ubique cada sección sin tener
      que adivinar dónde empieza o termina buscando texto.

    CAMPO "intro_markdown" — contiene:

    ## 📄 Informe de tu CV

    (dos o tres párrafos de apertura, {instruccion_apertura}:
    1. El veredicto general.
    2. Una explicación breve y clara, en términos simples, de cómo funciona
       realmente un sistema ATS — que la mayoría de las empresas medianas/
       grandes filtran los CVs automáticamente ANTES de que los vea un
       humano, buscando coincidencias literales de palabras clave y
       penalizando formatos que no pueden leer bien — para que la persona
       entienda el POR QUÉ de las recomendaciones, no solo el qué.
    3. Un resumen concreto de qué le cambiamos a su CV en la versión
       reescrita de abajo (sección "🧾 Tu CV optimizado") y por qué — ej.
       "reordenamos tu experiencia para que las palabras clave aparezcan en
       las primeras líneas de cada puesto, sumamos cifras donde era posible
       y reescribimos 6 viñetas que eran tareas genéricas", de forma que la
       persona entienda exactamente qué cambió antes de mandarlo.)

    ## 1. 🎯 PUNTAJE Y DIAGNÓSTICO

    - **COMPATIBILIDAD GLOBAL:** x% — {instruccion_puntaje_match}, con una breve justificación. Expresalo SIEMPRE como porcentaje (0 a 100), nunca como nota sobre 10.
    - **FORMATO ATS:** x% — basado específicamente en el diagnóstico del texto extraído explicado arriba.
    - **LOGROS CUANTIFICABLES:** x% — qué proporción de las responsabilidades descriptas tienen un resultado medible (número, %, cifra) vs. cuántas son tareas genéricas sin impacto demostrado.
    - **PALABRAS CLAVE:** x% — {instruccion_puntaje_palabras_clave}.

    CAMPO "formato_markdown" — contiene:

    ## 2. 🛠️ FORMATO Y COMPATIBILIDAD ATS

    (explicá con el diagnóstico del texto extraído qué tan seguro es el
    formato actual para un ATS, qué elementos probablemente lo complican si
    los hay — columnas, tablas, texto en imágenes, encabezados/pies de
    página, íconos en vez de texto, fuentes no estándar — y 3-4
    recomendaciones concretas y accionables de formato, aunque no puedas ver
    el diseño exacto del documento.)

    CAMPO "logros_markdown" — contiene:

    ## 3. 📈 LOGROS CUANTIFICABLES

    (para CADA experiencia laboral relevante del CV — todas las que aporten,
    no solo la primera — un bloque así:
    - "**[Empresa — Puesto]**" en negrita como encabezado del ítem.
    - "❌ Antes:" con la descripción actual tal cual aparece (o una paráfrasis
      fiel si el texto extraído vino incompleto).
    - "✅ Después:" con una reescritura que empieza con un verbo de acción
      fuerte y muestra impacto/resultado.
    Repetí para cada experiencia relevante.)

    REGLA IMPORTANTE para las versiones "✅ Después" — el "Después" NO puede
    ser el mismo texto del "Antes" solo cortado en viñetas o reordenado: eso
    NO cuenta como reescritura. Cada punto del "Después" tiene que:
    1. Empezar con un verbo de acción fuerte, nunca un sustantivo suelto.
    2. Mostrar el IMPACTO o el PARA QUÉ de esa tarea, no solo repetir qué se hizo.
    3. Si el CV ya trae un número o resultado concreto, usalo tal cual. Si NO
       lo trae, el punto reescrito TIENE que incluir un placeholder explícito
       donde iría ese dato — no es opcional, no lo dejes pasar (ej. "reduje el
       tiempo de onboarding en [completar con tu %/cifra real]") — en vez de
       inventarle un resultado falso.
    Y nunca inventes ni le asignes a la persona un cargo o título de
    seniority/liderazgo que el CV no respalda.

    CAMPO "palabras_clave_markdown" — contiene:

    ## 4. 🔑 PALABRAS CLAVE

    (Dividí en dos partes con estos subtítulos exactos:

    ### ✅ Podés sumar ya

    Con guion "- ", entre 6 y 8 palabras clave {instruccion_palabras_clave}
    que además tengan algo concreto en la experiencia real del CV donde
    apoyarse. NO inventes tareas que la persona no hizo. Para cada una:
    - La palabra clave en negrita.
    - "📍 Dónde sumarla:" el lugar puntual y real del CV.
    - "📋 Lista para copiar y pegar ahí:" una frase ya redactada que incorpora
      el término naturalmente en ese contexto real. Nunca le hagas atribuirse,
      en primera persona, un cargo o rol de seniority que no tuvo — la palabra
      clave tiene que describir una tarea o herramienta real, no un título.

    ### 🔲 Todavía no están respaldadas en el CV

    Un párrafo breve aclarando que son términos frecuentes en su campo pero no
    aparecen respaldados por nada concreto hoy, y que solo hay que sumarlos si
    efectivamente los hizo. Después, con guion "- ", la lista de esos términos.)

    CAMPO "cierre_markdown" — contiene:

    ## 5. 🚀 3 ACCIONES PRIORITARIAS PARA ESTA SEMANA

    (ANTES de listar las acciones, una línea en negrita, sola, tipo:
    "**📈 Si aplicás estas 3 acciones, tu compatibilidad podría subir de
    X% a Y% aprox.**" — donde X% es EXACTAMENTE el mismo número que pusiste
    en "COMPATIBILIDAD GLOBAL" arriba, e Y% es tu estimación realista y
    CONSERVADORA de a dónde llegaría si la persona aplica las 3 acciones de
    abajo. Importante: esas acciones ya están ancladas en la experiencia
    real de la persona (son las mismas palabras clave de la sección 4 que
    SÍ tienen respaldo en su CV, más los logros reescritos de la sección 3),
    así que la proyección tiene que sonar alcanzable y honesta, nunca una
    promesa vacía — nunca proyectes más de 90-95%, y si el CV ya está muy
    bien armado (compatibilidad global ya alta), el salto proyectado tiene
    que ser chico y decirlo así.

    Después de esa línea, las 3 acciones concretas y priorizadas, en orden
    de impacto, basadas en todo lo de arriba.)

    CAMPO "cv_reescrito_markdown" — contiene EL CV COMPLETO reescrito, listo
    para exportar y adjuntar directo en una postulación real (no son ejemplos
    sueltos como en la sección de logros — es el documento entero armado).
    Reglas para este campo:
    - Usá TODA la información real del CV original: nombre, datos de
      contacto, cada experiencia laboral, educación, certificaciones,
      idiomas. NUNCA inventes un dato que no esté en el CV original (ni
      fechas, ni empresas, ni títulos, ni cursos).
    - Reescribí cada viñeta de experiencia con el mismo criterio ya aplicado
      en "logros_markdown" (verbo de acción + impacto + placeholder si falta
      una cifra real) — tienen que ser LAS MISMAS reescrituras, no versiones
      nuevas distintas.
    - Sumá naturalmente, donde haya respaldo real, las palabras clave ya
      identificadas en "palabras_clave_markdown" — nunca una que no esté
      respaldada en la experiencia real de la persona.
    - Formato simple y 100% seguro para ATS: sin columnas, sin tablas, todo
      en una sola columna lineal, en este orden: nombre y datos de contacto
      → resumen profesional (2-3 líneas con palabras clave reales, nuevo,
      vos lo escribís) → experiencia laboral (reescrita) → educación →
      certificaciones/idiomas si los hay → habilidades/palabras clave.
    - Formato Markdown real: "## " para cada sección, "- " para viñetas,
      línea en blanco entre título y contenido.
    - Nunca le asignes a la persona un cargo o título de seniority que el CV
      original no respalda (misma regla que en el resto del informe).

    IMPORTANTE sobre "puntajes.proyectado": tiene que ser EXACTAMENTE el
    mismo número Y% que usaste en la línea "📈 Si aplicás estas 3 acciones..."
    dentro de "cierre_markdown" — nunca pueden quedar dos números distintos
    para la misma proyección.

    Devolvé ÚNICAMENTE un JSON válido con esta forma exacta (sin texto antes
    ni después, sin bloques de código):

    {{
      "puntajes": {{
        "global": numero_del_0_al_100,
        "formato_ats": numero_del_0_al_100,
        "logros": numero_del_0_al_100,
        "palabras_clave": numero_del_0_al_100,
        "proyectado": numero_del_0_al_100
      }},
      "intro_markdown": "## 📄 Informe de tu CV\\n\\n...",
      "formato_markdown": "## 2. 🛠️ FORMATO Y COMPATIBILIDAD ATS\\n\\n...",
      "logros_markdown": "## 3. 📈 LOGROS CUANTIFICABLES\\n\\n...",
      "palabras_clave_markdown": "## 4. 🔑 PALABRAS CLAVE\\n\\n...",
      "cierre_markdown": "## 5. 🚀 3 ACCIONES PRIORITARIAS PARA ESTA SEMANA\\n\\n...",
      "cv_reescrito_markdown": "## Juan Pérez\\n\\n...(CV completo reescrito)..."
    }}
    """

    texto, modelo_usado = llamar_gemini_con_fallback(client, prompt, config=JSON_CONFIG_CV)
    data = extraer_json_seguro(texto)
    data.setdefault("puntajes", {})
    for campo in (
        "intro_markdown",
        "formato_markdown",
        "logros_markdown",
        "palabras_clave_markdown",
        "cierre_markdown",
        "cv_reescrito_markdown",
    ):
        data.setdefault(campo, "")

    data["modelo_usado"] = modelo_usado
    # "cv_reescrito_markdown" queda AFUERA de esta concatenación a propósito:
    # es un documento aparte (el CV listo para adjuntar), no una sección más
    # del informe de diagnóstico — el frontend lo ofrece como una descarga
    # separada en vez de mezclarlo con el informe.
    data["informe_markdown"] = "\n\n".join(
        parte
        for parte in (
            data["intro_markdown"],
            data["formato_markdown"],
            data["logros_markdown"],
            data["palabras_clave_markdown"],
            data["cierre_markdown"],
        )
        if parte
    ).strip()
    return data


@app.post("/api/armar-cv-desde-cero")
async def armar_cv_desde_cero(
    x_gemini_api_key: str = Header(None, alias="x-gemini-api-key"),
    idioma: str = Form("Español"),
    rol_objetivo: str = Form(...),
    puesto_descripcion: str = Form(""),
    datos_personales: str = Form("{}"),
    experiencia: str = Form("[]"),
    educacion: str = Form("[]"),
    habilidades: str = Form(""),
    idiomas_hablados: str = Form(""),
    certificaciones: str = Form(""),
    resumen_libre: str = Form(""),
):
    """Segundo modo del Optimizador de CV — para alguien que todavía NO
    tiene un CV armado (primer empleo, o quiere rehacerlo desde cero; pedido
    explícito de Ale: "no está la opción de empezá de cero tu CV"). En vez
    de subir un PDF para comparar contra un puesto, la persona responde un
    formulario guiado (datos personales, experiencia, educación,
    habilidades — mandados como JSON en los campos de abajo) y la IA le
    arma el CV completo de cero. El target es gente que "no tiene idea de
    cómo armar un CV" — por eso el prompt explica los porqués, no solo tira
    el resultado. Mismas reglas anti-inventar que analizar_cv: nunca le
    sumamos a la persona experiencia, logros, cifras o títulos que no puso
    ella misma."""
    client = get_client(x_gemini_api_key)

    def _parsear_json(valor: str, default):
        try:
            parsed = json.loads(valor) if valor and valor.strip() else default
        except (json.JSONDecodeError, TypeError):
            return default
        return parsed if isinstance(parsed, type(default)) else default

    datos = _parsear_json(datos_personales, {})
    lista_experiencia = _parsear_json(experiencia, [])
    lista_educacion = _parsear_json(educacion, [])

    if not lista_experiencia and not lista_educacion:
        raise HTTPException(
            status_code=400,
            detail=(
                "Contanos al menos una experiencia (puede ser informal, "
                "pasantía, voluntariado o un proyecto propio) o un dato de "
                "educación para poder armar el CV."
            ),
        )

    nombre = (datos.get("nombre") or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Falta tu nombre completo.")

    bloque_datos = f"""
Nombre completo: {nombre}
Email: {(datos.get('email') or '').strip() or '[sin especificar]'}
Teléfono: {(datos.get('telefono') or '').strip() or '[sin especificar]'}
Ubicación: {(datos.get('ubicacion') or '').strip() or '[sin especificar]'}
LinkedIn: {(datos.get('linkedin') or '').strip() or '[sin especificar]'}
"""

    if lista_experiencia:
        bloques_exp = []
        for i, exp in enumerate(lista_experiencia, start=1):
            empresa = (exp.get("empresa") or "").strip() or "[empresa sin especificar]"
            puesto = (exp.get("puesto") or "").strip() or "[puesto sin especificar]"
            periodo = (exp.get("periodo") or "").strip() or "[período sin especificar]"
            tareas = (exp.get("tareas") or "").strip() or "(no describió tareas)"
            bloques_exp.append(
                f"{i}. {puesto} en {empresa} ({periodo})\n   Qué hacía, en sus palabras: {tareas}"
            )
        bloque_experiencia = "\n".join(bloques_exp)
    else:
        bloque_experiencia = (
            "La persona no tiene experiencia laboral formal para listar "
            "(puede ser su primer CV). NO inventes experiencia — armá el CV "
            "apoyándote en su educación, habilidades y lo que haya contado "
            "en el resumen libre (proyectos propios, voluntariado, "
            "facultad, etc.)."
        )

    if lista_educacion:
        bloques_edu = []
        for edu in lista_educacion:
            institucion = (edu.get("institucion") or "").strip() or "[institución sin especificar]"
            titulo = (edu.get("titulo") or "").strip() or "[título/carrera sin especificar]"
            estado = (edu.get("estado") or "").strip() or "[estado sin especificar]"
            bloques_edu.append(f"- {titulo} — {institucion} ({estado})")
        bloque_educacion = "\n".join(bloques_edu)
    else:
        bloque_educacion = "No especificó educación formal."

    bloque_habilidades = habilidades.strip() or "No especificó."
    bloque_idiomas = idiomas_hablados.strip() or "No especificó."
    bloque_certificaciones = certificaciones.strip() or "No especificó."
    bloque_resumen_libre = (
        f"\nAlgo más que quiso contar sobre sí misma/o:\n{resumen_libre.strip()}\n"
        if resumen_libre.strip()
        else ""
    )

    tiene_puesto = bool(puesto_descripcion and puesto_descripcion.strip())
    bloque_puesto = (
        f"""
Descripción del puesto al que quiere apuntar este CV (pegada por la
persona, tratala como contexto para elegir qué palabras clave y qué
logros destacar primero — pero NUNCA para inventarle experiencia que no
tiene):

{puesto_descripcion.strip()}
"""
        if tiene_puesto
        else "No pegó ninguna descripción de puesto puntual — orientá el CV de forma general hacia el tipo de rol indicado arriba."
    )

    prompt = f"""
    Actuá como un consultor experto en reclutamiento y en cómo armar un CV
    efectivo para sistemas ATS, ayudando a alguien que está armando su CV DE
    CERO — probablemente nunca armó uno, o no tiene ni idea de por dónde
    empezar. Tu trabajo es tomar la información real que esta persona
    completó en un formulario guiado y devolverle un CV completo,
    profesional y listo para usar — sin que ella tenga que saber nada de
    formato ni de ATS.

    ROL AL QUE APUNTA ESTE CV: {rol_objetivo.strip()}
    {bloque_puesto}

    DATOS PERSONALES:
    {bloque_datos}

    EXPERIENCIA (en las propias palabras de la persona):
    {bloque_experiencia}

    EDUCACIÓN:
    {bloque_educacion}

    HABILIDADES / HERRAMIENTAS QUE MENCIONÓ:
    {bloque_habilidades}

    IDIOMAS:
    {bloque_idiomas}

    CERTIFICACIONES / CURSOS:
    {bloque_certificaciones}
    {bloque_resumen_libre}

    REGLA ANTI-INVENTAR (la más importante de todas): usá ÚNICAMENTE la
    información de arriba. Nunca le agregues a la persona una experiencia,
    empresa, cargo, logro, cifra, certificación o años de experiencia que
    no haya puesto ella misma. Si algo es necesario para un CV completo
    pero la persona no lo dio (ej. un resultado numérico de una tarea), usá
    un placeholder explícito entre corchetes (ej. "[completar con tu
    cifra/% real]") en vez de inventarlo — igual que hacemos siempre en
    esta herramienta.

    - Dirigite a la persona en segunda persona ("vos") fuera del CV mismo
      (en los campos de explicación), en {idioma}, con un tono cálido,
      claro y sin tecnicismos — pensá que probablemente es la primera vez
      que arma un CV y puede sentirse perdida/o con todo esto.
    - MUY IMPORTANTE, formato Markdown real: "## " para títulos en su
      propia línea, línea en blanco entre título y contenido, viñetas con
      "- ".
    - El resultado se parte en 3 campos de markdown independientes (ver el
      JSON de abajo).

    CAMPO "intro_markdown" — contiene:

    ## ✨ Tu primer CV, armado

    (dos o tres párrafos breves y simples:
    1. Un mensaje alentador y concreto — nada de "veredicto" tipo
       diagnóstico, esto es algo nuevo que estás creando con ella/él, no
       una corrección.
    2. Una explicación en términos MUY simples de qué es un sistema ATS y
       por qué el formato de este CV (una sola columna, sin tablas ni
       diseños raros) importa — para que entienda el por qué, no solo el
       qué.
    3. Qué criterio usamos para armar el CV con lo que ella/él contó.)

    CAMPO "consejos_markdown" — contiene:

    ## 💡 3 cosas para tener en cuenta antes de mandarlo

    (3 consejos concretos y priorizados, pensados para alguien sin
    experiencia previa armando CVs. Si hay datos marcados como "[sin
    especificar]" o placeholders sin completar en el CV de abajo, al menos
    uno de los 3 consejos tiene que señalar explícitamente cuáles son y
    pedirle que los complete antes de mandarlo. Si corresponde (la persona
    tiene poca o ninguna experiencia laboral formal), sumá un consejo sobre
    cómo compensar eso — ej. destacar proyectos propios, voluntariado,
    estudios o certificaciones — sin nunca sugerirle que mienta o exagere.)

    CAMPO "cv_armado_markdown" — contiene EL CV COMPLETO, listo para
    exportar y usar en una postulación real. Reglas:
    - Orden: nombre y datos de contacto → resumen profesional (2-3 líneas,
      nuevo, lo escribís vos en base a todo lo de arriba, mencionando el
      rol objetivo) → experiencia laboral (si tiene) → educación →
      certificaciones/idiomas si hay → habilidades.
    - Para cada experiencia, reescribí lo que contó en sus propias
      palabras como viñetas profesionales: verbo de acción fuerte + qué
      hizo + impacto si lo mencionó, o un placeholder entre corchetes si
      el impacto no está pero el tipo de tarea sugiere que debería tener
      uno medible.
    - Si la persona casi no tiene experiencia laboral, el CV igual tiene
      que quedar sólido: apoyate en educación, habilidades, certificaciones
      y lo que contó en el resumen libre (proyectos, voluntariado, etc.) —
      nunca inventes experiencia laboral que no tiene para "rellenar".
    - Nunca le asignes un cargo, título o años de seniority que no surgen
      de lo que puso.
    - Formato 100% seguro para ATS: sin columnas, sin tablas, una sola
      columna lineal. "## " para cada sección, "- " para viñetas, línea en
      blanco entre título y contenido.

    Devolvé ÚNICAMENTE un JSON válido con esta forma exacta (sin texto
    antes ni después, sin bloques de código):

    {{
      "intro_markdown": "## ✨ Tu primer CV, armado\\n\\n...",
      "consejos_markdown": "## 💡 3 cosas para tener en cuenta antes de mandarlo\\n\\n...",
      "cv_armado_markdown": "## {nombre}\\n\\n...(CV completo)..."
    }}
    """

    texto, modelo_usado = llamar_gemini_con_fallback(client, prompt, config=JSON_CONFIG_CV)
    data = extraer_json_seguro(texto)
    for campo in ("intro_markdown", "consejos_markdown", "cv_armado_markdown"):
        data.setdefault(campo, "")

    data["modelo_usado"] = modelo_usado
    data["informe_markdown"] = "\n\n".join(
        parte for parte in (data["intro_markdown"], data["consejos_markdown"]) if parte
    ).strip()
    return data


@app.post("/api/plan-transicion-carrera")
async def plan_transicion_carrera(
    x_gemini_api_key: str = Header(None, alias="x-gemini-api-key"),
    rol_objetivo: str = Form(...),
    descripcion_rol: str = Form(...),
    herramientas_rol: str = Form(...),
    situacion_actual: str = Form(...),
    idioma: str = Form("Español"),
    cv: UploadFile = File(None),
):
    """Capa de IA personalizada de la Guía de Salida Laboral: dado un rol
    objetivo (de los 44 roles estáticos de Frontend/lib/contenidoCarrera.ts —
    el frontend manda nombre/descripcion/herramientas de ese archivo como
    contexto, así el contenido fáctico sigue viviendo en un solo lugar) y la
    situación actual de la persona (texto libre, más un CV en PDF opcional
    para un diagnóstico más preciso), devuelve un plan concreto de cómo
    transicionar a ese rol. Reutiliza extraer_texto_cv/_pdf_executor igual
    que los otros dos endpoints que procesan PDF."""
    client = get_client(x_gemini_api_key)

    cv_texto = ""
    if cv is not None:
        cv_bytes = await cv.read()
        if cv_bytes:
            future = _pdf_executor.submit(extraer_texto_cv, cv, cv_bytes)
            try:
                cv_texto = future.result(timeout=PDF_TIMEOUT_SEGUNDOS)
            except FutureTimeoutError:
                raise HTTPException(
                    status_code=400,
                    detail="El PDF tardó demasiado en procesarse. Probá sin adjuntarlo, o con otro archivo.",
                )
            if not cv_texto or len(cv_texto.strip()) < 50:
                # A diferencia de analizar-cv, acá el CV es un plus opcional,
                # no el centro del análisis — si no se pudo leer, seguimos
                # solo con lo que la persona escribió a mano en vez de cortar
                # el flujo con un error.
                cv_texto = ""

    bloque_cv = (
        f"""
    Además, la persona adjuntó su CV actual. Usalo como la fuente MÁS
    confiable de su experiencia real (por sobre lo que escribió a mano arriba
    si hay contradicciones) para el diagnóstico de brecha:
    ---
    {cv_texto[:12000]}
    ---
    """
        if cv_texto
        else """
    La persona no adjuntó un CV — basá el diagnóstico únicamente en lo que
    escribió a mano arriba sobre su situación actual. Si es poco específico,
    trabajá igual con lo que hay, sin inventarle experiencia que no mencionó.
    """
    )

    prompt = f"""
    Actuá como un consultor de carrera experto en transiciones profesionales,
    asesorando a alguien que quiere pasar a trabajar en un rol específico
    distinto del que tiene hoy (o entrar por primera vez a ese rol).

    ROL OBJETIVO: {rol_objetivo}

    Descripción de ese rol (contenido de referencia fijo, no lo cuestiones ni
    lo reescribas, es contexto): {descripcion_rol}

    Herramientas/skills habituales de ese rol (mismo criterio, es contexto):
    {herramientas_rol}

    Situación actual de la persona, en sus propias palabras (rol actual,
    años de experiencia, skills que ya tiene, por qué le interesa este rol
    objetivo):
    ---
    {situacion_actual.strip()}
    ---
    {bloque_cv}

    REGLA ANTI-INFLACIÓN (igual que en las otras herramientas de este
    sistema): nunca le sugieras a la persona que se presente con un título,
    nivel de seniority o experiencia que no tiene todavía. El objetivo de
    este plan es ayudarla a CONSEGUIR esa experiencia, no a simular que ya la
    tiene. Si hoy está lejos del rol objetivo, decilo con honestidad y
    enfocá el plan en achicar esa distancia real, no en maquillarla.

    REGLA ANTI-FABRICACIÓN: no inventes cursos, certificaciones, empresas o
    plataformas específicas que no sean ampliamente conocidas y reales (está
    bien nombrar plataformas masivas y reales como Coursera, Udemy, YouTube,
    freeCodeCamp, LinkedIn Learning, o equivalentes locales conocidas de
    Argentina/Latam si aplican — pero no inventes nombres de cursos puntuales
    ni garantices resultados). Nunca prometas un tiempo fijo de conseguir el
    puesto (nada de "en 3 meses conseguís el trabajo") — el ritmo depende de
    cada persona; hablá en fases, no en fechas. No le inventes a la persona
    experiencia, logros o proyectos que no mencionó.

    REGLA ANTI-NARRATIVA INVENTADA: no le atribuyas a la persona motivos,
    emociones o circunstancias personales que no escribió explícitamente en
    su situación actual (ej. "dada tu desmotivación actual", "estás
    agotado/a de tu rol actual", "no te sentís realizado/a") — aunque suene
    empático, es inventar algo sobre su vida privada que no te contó. Si no
    dijo por qué quiere este cambio, no lo expliques ni lo asumas: andá
    directo al diagnóstico de la brecha entre su situación real (la que sí
    describió) y el rol objetivo, sin narrarle una motivación que no es tuya
    para inventar.

    DIRECTIVAS DE ESTILO PARA EL INFORME:
    - Escribilo 100% en idioma {idioma}, en Markdown.
    - Tono directo, cálido y concreto — como un consultor de carrera real
      que quiere que a esta persona le vaya bien, no un genérico "tips para
      tu carrera" de internet. Todo lo que sugieras tiene que ser accionable
      por ESTA persona puntual, no un consejo genérico que serviría para
      cualquiera.
    - Usá EXACTAMENTE esta estructura y estos títulos (podés ajustar el
      contenido, no el formato ni los emojis).
    - MUY IMPORTANTE, formato Markdown real: cada título numerado va
      precedido por "## " en su propia línea, con una línea en blanco antes
      y después. Para listas usá SIEMPRE guion "- ", nunca numeración "1. 2.".
    - MUY IMPORTANTE: el informe NO va en un solo campo, lo partimos en 5
      campos de markdown independientes (ver el JSON de abajo) — mismo
      motivo que en las otras herramientas: el frontend ubica cada sección
      sin tener que adivinar dónde corta el texto. Cada campo tiene que ser
      markdown válido y autocontenido, de forma que concatenados en orden
      con una línea en blanco en el medio formen el informe completo.

    CAMPO "intro_markdown" — contiene:

    ## 🧭 Tu plan para pasar a {rol_objetivo}

    (un párrafo de apertura directo con el diagnóstico general — qué tan
    cerca o lejos está hoy del rol objetivo, y por qué)

    ## 1. 🎯 Qué tan preparado/a estás hoy

    (un párrafo breve justificando el PUNTAJE_PREPARACION que vas a poner en
    el JSON, en base a cuánto de lo que ya tiene se solapa con lo que pide
    el rol objetivo)

    CAMPO "brecha_markdown" — contiene:

    ## 2. 🔍 Lo que ya tenés a favor vs. lo que te falta

    ### ✅ Ya tenés esto a favor

    (con guion "- ", cosas concretas de su situación actual/CV que SÍ le
    sirven para este rol objetivo, aunque vengan de una experiencia distinta
    — explicá brevemente por qué cada una es transferible)

    ### 🔲 Esto es lo que te falta

    (con guion "- ", gaps concretos y honestos: skills técnicas, herramientas,
    tipo de experiencia o credenciales que hoy no tiene y el rol sí pide)

    CAMPO "plan_markdown" — contiene:

    ## 3. 🗺️ Tu hoja de ruta

    (organizá en 3 fases con subtítulos "### Fase 1: ..." / "### Fase 2: ..."
    / "### Fase 3: ..." — nombralas vos según el contenido, no uses fechas ni
    plazos fijos. Cada fase con guion "- ": qué aprender/practicar, mencionando
    tipos de recursos reales — cursos online de plataformas masivas conocidas,
    documentación oficial, comunidades — sin inventar nombres de cursos
    puntuales ni URLs)

    CAMPO "portfolio_markdown" — contiene:

    ## 4. 💼 Cómo demostrarlo

    (2-3 ideas CONCRETAS y específicas para ESTE rol objetivo de algo que la
    persona puede construir/hacer para tener algo real que mostrar — ej. un
    proyecto con datos públicos, un caso de estudio, una pieza de portfolio —
    no genérico tipo "hacé un portfolio". Después, un párrafo breve sobre
    puertas de entrada realistas a este rol — posiciones junior/trainee,
    pasantías, freelance, o transición interna si aplica — siendo honesto
    sobre qué tan competitivo es entrar así, sin asegurar resultados)

    CAMPO "cierre_markdown" — contiene:

    ## 5. 🚀 3 próximos pasos para esta semana

    (3 acciones como ítems con guion "- ", concretas, chiquitas y accionables
    YA — no genéricas tipo "investigá sobre el rol", algo que pueda arrancar
    hoy mismo)

    Respondé EXCLUSIVAMENTE con un JSON con este formato exacto y nada más
    (sin bloques de código, sin texto fuera del JSON):
    {{
      "puntajes": {{
        "preparacion": numero_del_1_al_10
      }},
      "intro_markdown": "## 🧭 Tu plan para pasar a ...\\n\\n...\\n\\n## 1. 🎯 Qué tan preparado/a estás hoy\\n\\n...",
      "brecha_markdown": "## 2. 🔍 Lo que ya tenés a favor vs. lo que te falta\\n\\n...",
      "plan_markdown": "## 3. 🗺️ Tu hoja de ruta\\n\\n...",
      "portfolio_markdown": "## 4. 💼 Cómo demostrarlo\\n\\n...",
      "cierre_markdown": "## 5. 🚀 3 próximos pasos para esta semana\\n\\n..."
    }}
    """

    texto, modelo_usado = llamar_gemini_con_fallback(client, prompt, config=JSON_CONFIG_PLAN_CARRERA)
    data = extraer_json_seguro(texto)
    data.setdefault("puntajes", {})
    for campo in (
        "intro_markdown",
        "brecha_markdown",
        "plan_markdown",
        "portfolio_markdown",
        "cierre_markdown",
    ):
        data.setdefault(campo, "")

    data["modelo_usado"] = modelo_usado
    data["informe_markdown"] = "\n\n".join(
        parte
        for parte in (
            data["intro_markdown"],
            data["brecha_markdown"],
            data["plan_markdown"],
            data["portfolio_markdown"],
            data["cierre_markdown"],
        )
        if parte
    ).strip()
    return data


@app.post("/api/plan-negociacion")
async def plan_negociacion(
    x_gemini_api_key: str = Header(None, alias="x-gemini-api-key"),
    oferta_recibida: str = Form(...),
    situacion_actual: str = Form(...),
    prioridades: str = Form(None),
    idioma: str = Form("Español"),
):
    """Da un plan de negociación salarial de una sola pasada (sin ida y
    vuelta interactivo, a diferencia del simulador de entrevistas) — Ale
    eligió esta versión más simple y rápida de construir en vez de un
    roleplay turno a turno. Reutiliza el mismo patrón de las otras
    herramientas: un llamado a Gemini, informe partido en campos de
    markdown independientes."""
    client = get_client(x_gemini_api_key)

    bloque_prioridades = (
        f"\n    Qué le importa a la persona además del sueldo: {prioridades.strip()}\n"
        if prioridades and prioridades.strip()
        else "\n    La persona no indicó prioridades más allá del sueldo — no asumas ninguna, enfocate en la compensación.\n"
    )

    prompt = f"""
    Actuá como un consultor de carrera experto en negociación salarial,
    asesorando a alguien que recibió una oferta de trabajo (o está por pedir
    un aumento) y quiere negociar mejor antes de responder.

    Oferta recibida (pegada por la persona, puede incluir sueldo, beneficios,
    o estar incompleta):
    ---
    {oferta_recibida.strip()}
    ---

    Situación actual de la persona (sueldo actual o situación previa, años de
    experiencia, y cualquier otra oferta o alternativa real que tenga — esto
    es su principal poder de negociación):
    ---
    {situacion_actual.strip()}
    ---
    {bloque_prioridades}

    REGLA ANTI-FABRICACIÓN (muy importante, es la más importante de esta
    herramienta): NUNCA inventes una cifra, rango salarial o porcentaje de
    mercado que no te haya dado la persona — no tenés datos reales y
    actualizados de sueldos por rol/empresa/región, e inventar un número
    suena autoritativo pero puede estar completamente mal y hacerle perder
    credibilidad en la negociación real. Si hace falta un número concreto en
    algún punto (ej. "pedí un X% más"), usá un placeholder explícito como
    "[definí tu número objetivo]" en vez de inventarlo — nunca falta, nunca
    es opcional.

    REGLA ANTI-DESHONESTIDAD (igual de importante): nunca sugieras que la
    persona mienta — ni sobre tener otras ofertas que no tiene, ni sobre su
    experiencia, ni sobre nada. Si en "Situación actual" no mencionó otras
    ofertas reales, NO le sugieras decir que las tiene. Todo el plan tiene
    que funcionar siendo 100% honesto sobre su situación real.

    REGLA ANTI-NARRATIVA INVENTADA: no le atribuyas a la persona motivos,
    emociones o circunstancias personales que no escribió explícitamente
    (ej. "dado lo desgastante que fue tu año", "sabiendo lo mal que la
    pasaste en tu trabajo actual") — aunque suene empático, es inventar algo
    de su vida privada que no te contó. Si no lo dijo, no lo asumas.

    DIRECTIVAS DE ESTILO PARA EL INFORME:
    - Escribilo 100% en idioma {idioma}, en Markdown.
    - Tono directo y práctico, como un consultor real preparando a alguien
      para una conversación que va a tener pronto — no genérico.
    - Usá EXACTAMENTE esta estructura y estos títulos (podés ajustar el
      contenido, no el formato ni los emojis).
    - MUY IMPORTANTE, formato Markdown real: cada título numerado va
      precedido por "## " en su propia línea, con una línea en blanco antes
      y después. Para listas usá SIEMPRE guion "- ", nunca numeración "1. 2.".
    - MUY IMPORTANTE: el informe NO va en un solo campo, lo partimos en 6
      campos de markdown independientes (ver el JSON de abajo) — mismo
      motivo que en las otras herramientas: el frontend ubica cada sección
      sin adivinar dónde corta el texto. Cada campo tiene que ser markdown
      válido y autocontenido, de forma que concatenados en orden con una
      línea en blanco en el medio formen el informe completo.

    CAMPO "intro_markdown" — contiene:

    ## 💬 Tu plan de negociación

    (un párrafo de apertura directo con el veredicto general sobre esta
    oferta/situación)

    ## 1. 🔍 Tu posición negociadora

    (un párrafo justificando el PUNTAJE_POSICION que vas a poner en el JSON
    — qué tan fuerte o débil es su poder de negociación hoy, en base a lo
    que escribió, siendo honesto si es una posición débil)

    CAMPO "analisis_markdown" — contiene:

    ## 2. ⚖️ Qué jugás a favor y qué jugás en contra

    ### ✅ A tu favor

    (con guion "- ", elementos reales de su situación que fortalecen su
    negociación)

    ### 🔲 En contra o a tener en cuenta

    (con guion "- ", elementos reales que debilitan su posición o riesgos a
    manejar con cuidado)

    CAMPO "argumentos_markdown" — contiene:

    ## 3. 🎯 Qué pedir y por qué

    (más allá del número de sueldo en sí —que la persona tiene que definir
    ella misma, ver la regla anti-fabricación—, qué OTRAS cosas concretas
    puede pedir según lo que importa según "prioridades" si las dio: bono de
    firma, días extra de vacaciones, home office, título, fecha de revisión
    salarial a los 6 meses, etc. Con guion "- ", cada pedido con una breve
    justificación de por qué es razonable pedirlo en base a su situación)

    CAMPO "guion_markdown" — contiene:

    ## 4. 💬 Frases para usar

    (3-4 frases o mini-guiones ya redactados, en primera persona, listos
    para adaptar y decir en la conversación real: cómo abrir el pedido, cómo
    contrapropuestas, cómo pedir tiempo para pensar sin sonar indeciso/a)

    CAMPO "objeciones_markdown" — contiene:

    ## 5. 🛡️ Cómo responder a las objeciones más comunes

    (3-4 objeciones típicas que un reclutador/manager puede poner —ej. "no
    tenemos presupuesto para eso", "esta es nuestra oferta final", "todos
    arrancan en este rango"— cada una como "**Objeción:** ..." seguida de
    "**Cómo responder:** ..." con una respuesta concreta y honesta)

    CAMPO "cierre_markdown" — contiene:

    ## 6. 🚀 3 cosas para definir antes de responder

    (3 acciones como ítems con guion "- ", concretas, para que la persona
    resuelva ANTES de hablar con la empresa — ej. definir su número mínimo
    aceptable, confirmar si una alternativa que mencionó es real y en pie,
    etc. — NO uses numeración acá)

    Respondé EXCLUSIVAMENTE con un JSON con este formato exacto y nada más
    (sin bloques de código, sin texto fuera del JSON):
    {{
      "puntajes": {{
        "posicion": numero_del_1_al_10
      }},
      "intro_markdown": "## 💬 Tu plan de negociación\\n\\n...\\n\\n## 1. 🔍 Tu posición negociadora\\n\\n...",
      "analisis_markdown": "## 2. ⚖️ Qué jugás a favor y qué jugás en contra\\n\\n...",
      "argumentos_markdown": "## 3. 🎯 Qué pedir y por qué\\n\\n...",
      "guion_markdown": "## 4. 💬 Frases para usar\\n\\n...",
      "objeciones_markdown": "## 5. 🛡️ Cómo responder a las objeciones más comunes\\n\\n...",
      "cierre_markdown": "## 6. 🚀 3 cosas para definir antes de responder\\n\\n..."
    }}
    """

    texto, modelo_usado = llamar_gemini_con_fallback(client, prompt, config=JSON_CONFIG_NEGOCIACION)
    data = extraer_json_seguro(texto)
    data.setdefault("puntajes", {})
    for campo in (
        "intro_markdown",
        "analisis_markdown",
        "argumentos_markdown",
        "guion_markdown",
        "objeciones_markdown",
        "cierre_markdown",
    ):
        data.setdefault(campo, "")

    data["modelo_usado"] = modelo_usado
    data["informe_markdown"] = "\n\n".join(
        parte
        for parte in (
            data["intro_markdown"],
            data["analisis_markdown"],
            data["argumentos_markdown"],
            data["guion_markdown"],
            data["objeciones_markdown"],
            data["cierre_markdown"],
        )
        if parte
    ).strip()
    return data


# Rango amplio de emojis Unicode — ReportLab con las fuentes base (Helvetica,
# las que usamos acá) no tiene esos glifos y los dibuja como un cuadrado
# "tofu" (■), así que los sacamos del texto que va al PDF. Los emojis se
# siguen viendo perfecto en pantalla (ahí los renderiza el navegador) — esto
# es solo para la descarga. Ale lo encontró mirando el PDF de un plan de
# carrera: todos los "■" eran emojis que no se pudieron dibujar.
_PATRON_EMOJI = re.compile(
    "["
    "\U0001F300-\U0001FAFF"  # pictografías, emoticones, símbolos, transporte, etc.
    "\U00002600-\U000027BF"  # símbolos misceláneos y dingbats (✅❌⚖️🔑✨ etc.)
    "\U0001F1E6-\U0001F1FF"  # banderas (pares de letras regionales)
    "\U00002190-\U000021FF"  # flechas
    "\U00002B00-\U00002BFF"  # símbolos y flechas varios
    "\U0000FE0F"  # variation selector (modificador de presentación emoji)
    "\U0000200D"  # zero-width joiner (emojis compuestos, ej. 🧑‍💼)
    "]+",
    flags=re.UNICODE,
)


def _escapar_para_reportlab(texto: str) -> str:
    return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _inline_markdown_a_reportlab(texto: str) -> str:
    texto = _PATRON_EMOJI.sub("", texto)
    texto = re.sub(r" {2,}", " ", texto).strip()  # colapsa el espacio doble que deja el emoji sacado
    texto = _escapar_para_reportlab(texto)
    texto = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", texto)
    return texto


def _markdown_a_story(md_texto: str, styles) -> list:
    """Convierte el markdown que devuelve Gemini a elementos de reportlab.
    No es un parser de markdown completo, pero cubre lo que produce el
    prompt del informe: títulos, subtítulos, viñetas y negrita."""
    story = []
    for linea_cruda in md_texto.splitlines():
        linea = linea_cruda.strip()

        if not linea:
            story.append(Spacer(1, 6))
            continue

        if re.match(r"^\d+\.\s", linea) or (len(linea) < 90 and linea.upper() == linea and any(c.isalpha() for c in linea)):
            # Ej: "1. 🎯 DESGLOSE DE NOTAS" o títulos en mayúsculas
            story.append(Paragraph(_inline_markdown_a_reportlab(linea), styles["Subtitulo"]))
            continue

        if linea.startswith("#"):
            texto_titulo = linea.lstrip("#").strip()
            story.append(Paragraph(_inline_markdown_a_reportlab(texto_titulo), styles["Subtitulo"]))
            continue

        if linea.startswith(("* ", "- ")):
            contenido = linea[2:].strip()
            story.append(Paragraph("• " + _inline_markdown_a_reportlab(contenido), styles["Bullet"]))
            continue

        story.append(Paragraph(_inline_markdown_a_reportlab(linea), styles["Cuerpo"]))

    return story


@app.post("/api/descargar-pdf")
async def descargar_pdf(
    informe_markdown: str = Form(...),
    rol: str = Form("Executive"),
    titulo: str = Form(None),
    nombre_archivo: str = Form(None),
):
    try:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
        )

        base = getSampleStyleSheet()
        styles = {
            "Titulo": ParagraphStyle(
                "Titulo", parent=base["Heading1"], fontSize=16,
                textColor=colors.HexColor("#1E293B"), spaceAfter=14,
            ),
            "Subtitulo": ParagraphStyle(
                "Subtitulo", parent=base["Heading2"], fontSize=11,
                textColor=colors.HexColor("#2563EB"), spaceBefore=12, spaceAfter=6,
            ),
            "Cuerpo": ParagraphStyle(
                "Cuerpo", parent=base["Normal"], fontSize=9, leading=13,
                textColor=colors.HexColor("#334155"), spaceAfter=4,
            ),
            "Bullet": ParagraphStyle(
                "Bullet", parent=base["Normal"], fontSize=9, leading=13,
                textColor=colors.HexColor("#334155"), leftIndent=12, spaceAfter=4,
            ),
        }

        titulo_final = titulo or f"Reporte de Simulación de Entrevista — {rol}"
        story = [
            Paragraph(_inline_markdown_a_reportlab(titulo_final), styles["Titulo"]),
            Spacer(1, 6),
        ]
        story.extend(_markdown_a_story(informe_markdown, styles))

        doc.build(story)
        buffer.seek(0)

        # OJO: el nombre de archivo va en un header HTTP, que solo admite
        # ASCII — sacamos tildes/ñ/emojis para no romper la descarga en
        # algunos navegadores.
        base_archivo = nombre_archivo or f"Reporte_Entrevista_{rol}"
        base_archivo = base_archivo.encode("ascii", "ignore").decode("ascii")
        base_archivo = re.sub(r"[^A-Za-z0-9_\-]+", "_", base_archivo).strip("_") or "Reporte"

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={base_archivo}.pdf"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")
