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

# Binario de ffmpeg (bundleado por imageio-ffmpeg, no depende de que el
# sistema operativo lo tenga instalado). Lo usamos directo por subprocess
# en vez de pasar por pydub, porque pydub todavía no está arreglado para
# Python 3.13+ (le sacaron el módulo audioop a la librería estándar).
FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()

# Para leer PDFs de CV en un hilo aparte: si el PDF viene raro/pesado y
# pypdf se cuelga leyéndolo, no queremos que se frene TODO el servidor
# (y todas las demás peticiones de otros participantes) con él.
_pdf_executor = ThreadPoolExecutor(max_workers=4)
PDF_TIMEOUT_SEGUNDOS = 15

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

    raise HTTPException(
        status_code=500,
        detail=f"La API no devolvió un JSON válido. Texto recibido: '{texto[:150]}...'",
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
    seniority: str = Form("Executive"),
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

    prompt = f"""
    Actúa como un reclutador exigente.
    Genera exactamente {total_a_generar} preguntas de entrevista en idioma {idioma}.
    Rol objetivo: {rol}
    Seniority: {seniority}
    Enfoque: {enfoque}
    JD: {jd if jd else 'No provista'}
    CV: {cv_texto if cv_texto else 'No provisto'}

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
    seniority: str = Form("Executive"),
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

    contents = [f"""
    Sos un Reclutador Executive / Headhunter implacable pero constructivo, evaluando
    una simulación de entrevista para el puesto '{rol}' con nivel '{seniority}'.
    Job Description: {jd if jd else 'No provista'}.

    A continuación vas a escuchar, pregunta por pregunta, los audios reales con las
    respuestas del candidato (te indico también la duración y el ritmo de habla medidos
    de cada una). Evaluá el CONTENIDO de las respuestas (no solo la forma) usando la
    metodología STAR (Situación/Contexto, Tarea, Acción, Resultado), buscando gaps
    técnicos y de competencias para el rol, y el tono/emocionalidad de la voz.

    DIRECTIVAS DE ESTILO PARA EL INFORME (campo "informe_markdown"):
    - Escribilo 100% en idioma {idioma}, en Markdown.
    - Tono directo, exigente y sin rodeos de un headhunter ejecutivo real — si la
      entrevista fue mala, decilo sin filtros (pero seguí siendo constructivo, con
      consejos accionables). Si estuvo bien, reconocelo con el mismo nivel de exigencia.
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
    rol_objetivo: str = Form(...),
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

    prompt = f"""
    Actuá como un consultor experto en LinkedIn y reclutamiento, especializado en
    optimizar perfiles para que destaquen ante reclutadores humanos Y ante el
    buscador interno de LinkedIn (que prioriza palabras clave relevantes al rol).

    Rol/puesto al que apunta esta persona: {rol_objetivo}

    Contexto adicional que la persona escribió con sus propias palabras sobre lo
    que busca lograr (puede matizar, combinar roles, o explicar una situación
    particular — ej. "quiero pasar a role de gestión de personas pero todavía no
    tengo tanto seniority, así que busco algo intermedio"). Si está presente,
    dale prioridad por sobre el campo de rol solo, y hacé que el headline, el
    "acerca de" y las palabras clave sugeridas reflejen ese matiz real, no un
    único título genérico: {objetivo_libre if objetivo_libre and objetivo_libre.strip() else 'No provisto'}

    A continuación, el texto extraído del PDF que la persona exportó de su propio
    perfil de LinkedIn:
    ---
    {perfil_texto[:12000]}
    ---

    DIRECTIVAS DE ESTILO PARA EL INFORME (campo "informe_markdown"):
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

    ## 📈 Informe de tu Perfil de LinkedIn

    (un párrafo de apertura directo con el veredicto general, pensando en el rol objetivo)

    ## 1. 🎯 DESGLOSE DE PUNTAJES

    (lista con guiones "- " de PUNTAJE_GLOBAL, PUNTAJE_HEADLINE, PUNTAJE_ACERCA_DE,
    PUNTAJE_EXPERIENCIA, PUNTAJE_PALABRAS_CLAVE, cada uno en x/10 con una breve
    justificación entre paréntesis)

    ## 2. 🖋️ TITULAR (HEADLINE)

    (crítica del titular actual y 2-3 alternativas concretas ya redactadas, listas
    para copiar y pegar, pensadas para el rol objetivo)

    REGLA IMPORTANTE para las alternativas de titular: nunca le asignes a la persona
    un título de seniority/liderazgo (Leader, Head, Manager, Director, Sr., etc.) que
    su experiencia en el perfil no respalde todavía. Si el rol objetivo o el contexto
    adicional muestran una ASPIRACIÓN por encima de su nivel actual, reflejá esa
    dirección de crecimiento sin inventar un título que no tiene (por ejemplo, usando
    las áreas de expertise sin el título de liderazgo, o frases como "con foco en" /
    "en camino a", en vez de directamente "Leader" o "Manager"). Un titular inflado
    genera desconfianza cuando el reclutador lo compara con la experiencia real.

    ## 3. 📝 SECCIÓN "ACERCA DE"

    (qué falla en la sección actual —si no está, decilo— y una versión reescrita
    completa sugerida, en primera persona, de 3-4 párrafos)

    ## 4. 💼 EXPERIENCIA LABORAL

    (un ítem con guion "- " por cada rol relevante, señalando si la descripción
    muestra logros medibles o solo tareas, con sugerencia concreta de cómo
    reescribir al menos una)

    ## 5. 🔑 PALABRAS CLAVE PARA RECLUTADORES

    (lista con guion "- " de palabras clave/skills que le faltan al perfil para el
    rol objetivo, que un reclutador buscaría en LinkedIn)

    ## 6. 🚀 3 ACCIONES PRIORITARIAS PARA ESTA SEMANA

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
      "informe_markdown": "el informe completo en markdown, con la estructura de arriba"
    }}
    """

    texto, _modelo = llamar_gemini_con_fallback(client, prompt, config=JSON_CONFIG)
    data = extraer_json_seguro(texto)
    data.setdefault("puntajes", {})
    data.setdefault("informe_markdown", texto)
    return data


def _escapar_para_reportlab(texto: str) -> str:
    return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _inline_markdown_a_reportlab(texto: str) -> str:
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
