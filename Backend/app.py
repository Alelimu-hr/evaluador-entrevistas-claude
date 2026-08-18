import streamlit as st
from google import genai
from google.genai import types
from streamlit_mic_recorder import mic_recorder
from pypdf import PdfReader
import pandas as pd
import datetime
import os
import json
import time
import io
import wave

# 1. CONFIGURACIÓN DE PÁGINA
st.set_page_config(
    page_title="Reclutador IA Pro - Platform",
    page_icon="🎙️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 2. ESTILOS CSS PERSONALIZADOS
st.markdown("""
<style>
    .main { background-color: #f8f9fa; }
    .main-header {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        padding: 24px;
        border-radius: 16px;
        color: white;
        margin-bottom: 25px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .main-header h1 { color: white !important; font-weight: 700; margin-bottom: 5px; }
    .main-header p { color: #94a3b8; font-size: 1.05rem; margin: 0; }
    
    .question-card {
        background-color: #ffffff;
        border-left: 5px solid #3b82f6;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        margin-bottom: 20px;
    }
    .status-badge {
        background-color: #eff6ff;
        color: #1d4ed8;
        padding: 6px 12px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 0.85rem;
        display: inline-block;
        margin-bottom: 10px;
    }
    .oratoria-card {
        background-color: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;
        padding: 12px;
        margin-top: 10px;
    }
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
</style>
""", unsafe_allow_html=True)

# 3. FUNCIONES AUXILIARES REFACTORIZADAS

# 🔄 Función unificada para llamadas a Gemini con Fallback y Reintentos
def llamar_gemini_con_fallback(client, model_list, contents):
    error_ultimo = None
    for model_id in model_list:
        for intento in range(2):
            try:
                res = client.models.generate_content(
                    model=model_id,
                    contents=contents
                )
                if res and res.text:
                    return res.text
            except Exception as e:
                error_ultimo = e
                time.sleep(1.2)
    raise Exception(f"Saturación o error de API: {error_ultimo}")

# 🔍 Función precisa para medir duración del audio
def obtener_duracion_audio(audio_bytes):
    if not audio_bytes:
        return 0.0
    try:
        with wave.open(io.BytesIO(audio_bytes), 'rb') as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            if rate > 0:
                return round(frames / float(rate), 1)
    except Exception:
        pass
    return 0.0

# 🎙️ Función para analizar oratoria por respuesta
def analizar_oratoria_respuesta(client, model_list, audio_bytes, duracion_seg):
    if duracion_seg <= 0:
        return {"ppm": 0, "evaluacion_ritmo": "N/A", "tono_emocional": "Breve", "consejo_oratoria": "Respuesta demasiado corta para evaluar."}
    
    prompt_oratoria = """
    Analiza este audio de respuesta a una entrevista laboral.
    Proporciona un diagnóstico sobre la oratoria y la emocionalidad de la voz en formato JSON exacto:
    {
        "transcripcion": "transcripción textual corta o resumen del contenido",
        "palabras_aprox": 120,
        "evaluacion_ritmo": "Adecuado / Muy Rápido / Lento",
        "tono_emocional": "Confiado y Seguro / Apagado y Desinteresado / Monótono / Entusiasta / Nervioso",
        "consejo_oratoria": "Un consejo de 1 frase sobre la energía, entonación o actitud detectada en la voz."
    }
    Responde ÚNICAMENTE el objeto JSON sin bloques de código ni markdown.
    """
    
    try:
        res_text = llamar_gemini_con_fallback(
            client, model_list, 
            [prompt_oratoria, types.Part.from_bytes(data=audio_bytes, mime_type="audio/wav")]
        )
        clean_json = res_text.strip().replace("```json", "").replace("```", "")
        data = json.loads(clean_json)
        palabras = data.get("palabras_aprox", 0)
        ppm = round((palabras / (duracion_seg / 60))) if duracion_seg > 0 else 0
        data["ppm"] = ppm
        return data
    except Exception:
        return {
            "transcripcion": "Procesado correctamente",
            "ppm": 0,
            "evaluacion_ritmo": "Normal",
            "tono_emocional": "Equilibrado",
            "consejo_oratoria": "Mantiene pausas naturales al hablar."
        }

# 💾 Gestión de Historial por Sesión (Sin borrarlo al reiniciar entrevista)
def guardar_sesion_en_historial(datos_sesion):
    if "historial_sesiones_usuario" not in st.session_state:
        st.session_state.historial_sesiones_usuario = []
    st.session_state.historial_sesiones_usuario.append(datos_sesion)

def cargar_historial():
    return st.session_state.get("historial_sesiones_usuario", [])

# 🧹 Función de Reinicio Seguro (Preserva el historial histórico)
def reiniciar_simulacion_actual():
    claves_a_limpiar = [
        "paso_entrevista", "historial", "preguntas_generadas", 
        "informe_guardado", "informe_json_guardado"
    ]
    for key in claves_a_limpiar:
        if key in st.session_state:
            del st.session_state[key]

# 🔍 Verificar modelos multimodales activos
def obtener_modelos_multimodales_activos(client):
    dummy_wav = b'RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00'
    modelos_funcionales = []
    try:
        lista_api = list(client.models.list())
        for item in lista_api:
            nombre = item.name
            if "embed" not in nombre.lower() and "imagen" not in nombre.lower():
                modelos_funcionales.append(nombre)
    except Exception:
        pass

    modelos_funcionales.extend(["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"])

    probados = []
    for model_id in modelos_funcionales:
        if model_id in probados:
            continue
        try:
            res = client.models.generate_content(
                model=model_id,
                contents=["OK", types.Part.from_bytes(data=dummy_wav, mime_type="audio/wav")]
            )
            if res and res.text:
                probados.append(model_id)
        except Exception:
            continue

    if not probados:
        raise Exception("No se encontró ningún modelo multimodal activo.")
    return probados

# ⚙️ BARRA LATERAL: CONFIGURACIÓN
with st.sidebar:
    st.image("https://cdn-icons-png.flaticon.com/512/4762/4762311.png", width=60)
    st.title("Panel de Control")
    
    api_key_secret = ""
    try:
        if "GEMINI_API_KEY" in st.secrets:
            api_key_secret = st.secrets["GEMINI_API_KEY"]
    except Exception:
        api_key_secret = ""

    api_key_input = st.text_input("🔑 Gemini API Key:", type="password")
    api_key = api_key_input.strip() if api_key_input else api_key_secret

    st.markdown("👉 [Conseguí tu API Key gratuita acá](https://aistudio.google.com/app/apikey)", unsafe_allow_html=True)

    st.markdown("---")
    st.header("🎯 Módulo de Entrevista")
    modo_entrevista = st.selectbox(
        "Elegí el enfoque:",
        [
            "Simulación Completa STAR (Soft & Hard Skills)",
            "Fast Technical Drill (Solo preguntas técnicas clave)",
            "Deep Dive en Brechas (CV vs Job Description)"
        ]
    )
    
    # 🌐 Selector de idioma independiente
    idioma_entrevista = st.selectbox(
        "🌐 Idioma de la entrevista:",
        ["Español", "English"]
    )
    
    seniority = st.selectbox("Seniority Target:", ["Junior / Trainee", "Semi-Senior", "Senior / Lead"])

    st.markdown("---")
    st.header("📋 Vacante & Datos")
    puesto = st.text_input("Puesto a evaluar:", "People Manager")
    jd = st.text_area("Job Description (JD):", placeholder="Requisitos técnicos...", height=80)
    
    uploaded_cv = st.file_uploader("📄 Subir tu CV (PDF - Opcional):", type=["pdf"])
    cv_texto = ""
    if uploaded_cv:
        try:
            reader = PdfReader(uploaded_cv)
            for page in reader.pages:
                cv_texto += page.extract_text() or ""
            st.success("✅ CV cargado correctamente.")
        except Exception as e:
            st.error(f"Error al leer el PDF: {e}")

    cantidad_preguntas = st.slider("Preguntas a realizar:", min_value=2, max_value=4, value=3)

    st.markdown("---")
    if st.button("🔄 Reiniciar Simulación Actual", use_container_width=True):
        reiniciar_simulacion_actual()
        st.rerun()

# 4. PESTAÑAS PRINCIPALES DE LA APLICACIÓN
tab_entrevista, tab_dashboard = st.tabs(["🎙️ Entrenador Virtual", "📈 Mi Evolución y Métricas"])

# --------------------------------------------------------------------------------
# PESTAÑA 1: SIMULADOR DE ENTREVISTA
# --------------------------------------------------------------------------------
with tab_entrevista:
    st.markdown("""
    <div class="main-header">
        <h1>🎙️ Simulador Pro de Entrevistas con IA</h1>
        <p>Evaluación multimodal de voz, metodología STAR, análisis GAP de CV y control de oratoria/emoción</p>
    </div>
    """, unsafe_allow_html=True)

    if not api_key:
        st.warning("👈 Por favor, ingresá tu Gemini API Key en la barra lateral para comenzar.")
    else:
        client = genai.Client(api_key=api_key.strip())
        
        if "modelos_disponibles" not in st.session_state:
            with st.spinner("Conectando con el motor de IA..."):
                try:
                    st.session_state.modelos_disponibles = obtener_modelos_multimodales_activos(client)
                except Exception as e:
                    st.error(f"Error de conexión: {e}")

        if "modelos_disponibles" in st.session_state and st.session_state.modelos_disponibles:
            if "paso_entrevista" not in st.session_state: st.session_state.paso_entrevista = 0
            if "historial" not in st.session_state: st.session_state.historial = []
            if "preguntas_generadas" not in st.session_state: st.session_state.preguntas_generadas = []
            if "informe_guardado" not in st.session_state: st.session_state.informe_guardado = None

            # PASO 0: Inicio
            if st.session_state.paso_entrevista == 0:
                col1, col2 = st.columns([2, 1])
                with col1:
                    st.markdown("### 🚀 Configuración de la Sesión")
                    st.write(f"- **Modo Seleccionado:** `{modo_entrevista}`")
                    st.write(f"- **Idioma:** `{idioma_entrevista}`")
                    st.write(f"- **Seniority:** `{seniority}`")
                    st.write(f"- **Análisis de CV:** `{'Cargado y cruzado' if cv_texto else 'Sin CV adjunto'}`")
                    st.write("- **Pulsá el botón para generar preguntas realistas y empezar.**")

                    if st.button("🚀 Comenzar Entrevista", type="primary", use_container_width=True):
                        with st.spinner("Diseñando preguntas adaptadas..."):
                            instruccion_cv = ""
                            if cv_texto:
                                instruccion_cv = "UTILIZÁ EL CV ADJUNTO: Formula preguntas contextualizadas en los roles, logros o empresas reales presentes en el CV del candidato."

                            prompt_plan = f"""
                            Sos un Reclutador Executive / Headhunter especializado en roles Líderes y Técnicos.
                            Generá {cantidad_preguntas} preguntas EN {idioma_entrevista} para el puesto '{puesto}' con nivel '{seniority}'.
                            Modo de entrevista elegido: '{modo_entrevista}'.
                            Job Description: {jd if jd else 'Perfil estándar del puesto'}.
                            Contenido del CV del candidato: {cv_texto if cv_texto else 'No proporcionado'}.
                            {instruccion_cv}

                            DIRECTIVAS EXIGENTES DE FORMATO Y CONTENIDO:
                            1. IDIOMA OBLIGATORIO: Generá las preguntas 100% en idioma {idioma_entrevista}.
                            2. EXIGENCIA ADAPTADA AL SENIORITY: Si el nivel es Senior/Lead, NO hagas preguntas operativas básicas. Enfocate en visión estratégica, métricas clave, negociación con C-Level y resolución de crisis.
                            3. BREVEDAD ANTE TODO: Cada pregunta debe tener MÁXIMO 2 oraciones (menos de 35 palabras).
                            4. NO desgloses la estructura STAR dentro de la pregunta. Haz una pregunta abierta, fluida y natural.
                            5. Devuelve ÚNICAMENTE las {cantidad_preguntas} preguntas numeradas ("1. ... \n 2. ..."), sin introducciones.
                            """

                            try:
                                res_text = llamar_gemini_con_fallback(client, st.session_state.modelos_disponibles, prompt_plan)
                                lineas = [l.strip() for l in res_text.split("\n") if l.strip() and l[0].isdigit()]
                                if len(lineas) >= cantidad_preguntas:
                                    st.session_state.preguntas_generadas = lineas[:cantidad_preguntas]
                                else:
                                    st.session_state.preguntas_generadas = [f"{i+1}. Cuéntame sobre tu experiencia en {puesto}." for i in range(cantidad_preguntas)]
                                
                                st.session_state.paso_entrevista = 1
                                st.rerun()
                            except Exception as e:
                                st.error(f"Alta demanda en la API de Google. Reintentá en un instante. ({e})")

                with col2:
                    st.info("💡 **Tip de Oratoria & Actitud:**\nDesarrollá tus respuestas con profundidad. En niveles Senior/Lead, respuestas menores a 30 segundos sin contexto o datos concretos serán penalizadas.")

            # PASO INTERACTIVO
            elif 1 <= st.session_state.paso_entrevista <= cantidad_preguntas:
                idx = st.session_state.paso_entrevista - 1
                pregunta_actual = st.session_state.preguntas_generadas[idx]

                st.progress(st.session_state.paso_entrevista / cantidad_preguntas, text=f"Pregunta {st.session_state.paso_entrevista} de {cantidad_preguntas}")
                
                st.markdown(f"""
                <div class="question-card">
                    <span class="status-badge">🤖 PREGUNTA {st.session_state.paso_entrevista} DE {cantidad_preguntas}</span>
                    <h3 style="margin-top: 5px; color: #0f172a;">{pregunta_actual}</h3>
                </div>
                """, unsafe_allow_html=True)

                col_mic, col_info = st.columns([1, 2])
                with col_mic:
                    audio = mic_recorder(
                        start_prompt="🎙️ Grabar Respuesta",
                        stop_prompt="⏹️ Detener Grabación",
                        key=f"rec_{st.session_state.paso_entrevista}"
                    )

                if audio:
                    audio_bytes = audio['bytes']
                    duracion_seg = obtener_duracion_audio(audio_bytes)
                    
                    st.audio(audio_bytes, format="audio/wav")
                    
                    with st.spinner("Analizando ritmo, fluidez y tono emocional del audio..."):
                        metrics_oratoria = analizar_oratoria_respuesta(
                            client, st.session_state.modelos_disponibles, audio_bytes, duracion_seg
                        )

                    st.markdown(f"""
                    <div class="oratoria-card">
                        <strong>📊 Feedback de Oratoria y Tono Vocal:</strong><br>
                        ⏱️ <b>Duración:</b> {duracion_seg} segs | 🗣️ <b>Velocidad:</b> ~{metrics_oratoria.get('ppm', 0)} PPM | ⚡ <b>Ritmo:</b> {metrics_oratoria.get('evaluacion_ritmo', 'Normal')}<br>
                        🎭 <b>Tono Emocional Detectado:</b> {metrics_oratoria.get('tono_emocional', 'N/A')}<br>
                        💡 <i>{metrics_oratoria.get('consejo_oratoria', '')}</i>
                    </div>
                    """, unsafe_allow_html=True)

                    st.write("")
                    if st.button("➡️ Guardar Respuesta y Siguiente", type="primary", use_container_width=True):
                        st.session_state.historial.append({
                            "pregunta": pregunta_actual,
                            "audio": audio_bytes,
                            "duracion": duracion_seg,
                            "ppm": metrics_oratoria.get('ppm', 0),
                            "tono": metrics_oratoria.get('tono_emocional', 'N/A')
                        })
                        st.session_state.paso_entrevista += 1
                        st.rerun()

            # PASO FINAL
            elif st.session_state.paso_entrevista > cantidad_preguntas:
                st.balloons()
                
                if st.session_state.informe_guardado is None:
                    if st.button("🚀 Generar Evaluación y Reporte de Métricas", type="primary", use_container_width=True):

                        prompt_final = f"""
                        Eres un Reclutador Executive implacable pero constructivo. 
                        Analiza las respuestas de voz grabadas para el puesto '{puesto}' con nivel '{seniority}'.
                        Modo de sesión: {modo_entrevista}.
                        Idioma de evaluación: {idioma_entrevista}.
                        Job Description: {jd if jd else 'No provista'}
                        CV del candidato: {cv_texto if cv_texto else 'No provisto'}

                        DIRECTIVAS CRÍTICAS DE EVALUACIÓN:
                        1. IDIOMA DEL INFORME: Escribe el campo 'informe_markdown' completamente en idioma {idioma_entrevista}.
                        2. EXIGENCIA DE TIEMPO: Una respuesta de menos de 25 segundos para nivel {seniority} es INSUFICIENTE. Asigna max 5.0 en nota_star.
                        3. VELOCIDAD: Más de 200 PPM indica atropellamiento. Penaliza nota_oratoria.

                        Responde ÚNICAMENTE en el siguiente formato JSON exacto:
                        {{
                            "notas": {{
                                "global": 7.0,
                                "tecnica": 7.5,
                                "star": 6.0,
                                "oratoria": 7.0,
                                "tono": 8.0
                            }},
                            "informe_markdown": "Escribe aquí el informe completo estructurado en markdown en idioma {idioma_entrevista} con secciones de análisis de tiempo, evaluación técnica, STAR, tono, consejos y respuestas modelo."
                        }}
                        """

                        contents = [prompt_final]
                        total_tiempo = 0
                        for item in st.session_state.historial:
                            total_tiempo += item['duracion']
                            contents.append(f"\nPregunta: {item['pregunta']} (Duración audio: {item['duracion']} segs, Velocidad: {item.get('ppm', 0)} PPM, Tono: {item.get('tono', 'N/A')})")
                            contents.append(types.Part.from_bytes(data=item["audio"], mime_type="audio/wav"))

                        with st.spinner("Realizando evaluación exhaustiva y generando respuestas modelo..."):
                            try:
                                res_text = llamar_gemini_con_fallback(client, st.session_state.modelos_disponibles, contents)
                                clean_json = res_text.strip().replace("```json", "").replace("```", "")
                                json_data = json.loads(clean_json)

                                st.session_state.informe_guardado = json_data.get("informe_markdown", res_text)
                                notas = json_data.get("notas", {})

                                datos_sesion = {
                                    "fecha": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
                                    "puesto": puesto,
                                    "seniority": seniority,
                                    "modo": modo_entrevista,
                                    "idioma": idioma_entrevista,
                                    "nota": float(notas.get("global", 6.0)),
                                    "nota_tecnica": float(notas.get("tecnica", 6.0)),
                                    "nota_star": float(notas.get("star", 6.0)),
                                    "nota_oratoria": float(notas.get("oratoria", 6.0)),
                                    "nota_tono": float(notas.get("tono", 6.0)),
                                    "preguntas": cantidad_preguntas,
                                    "duracion_total_seg": round(total_tiempo, 1)
                                }
                                guardar_sesion_en_historial(datos_sesion)
                                st.rerun()
                            except Exception as err:
                                st.error(f"Error al generar el informe: {err}")

                else:
                    st.markdown("### 📊 Informe Final de Selección")
                    st.markdown(st.session_state.informe_guardado)
                    st.download_button(
                        label="📥 Descargar Reporte (.txt)",
                        data=st.session_state.informe_guardado,
                        file_name=f"Reporte_{puesto}.txt",
                        mime="text/plain"
                    )

# --------------------------------------------------------------------------------
# PESTAÑA 2: DASHBOARD DE EVOLUCIÓN
# --------------------------------------------------------------------------------
with tab_dashboard:
    st.markdown("## 📈 Tu Evolución Histórica por Competencia")
    
    historial_datos = cargar_historial()
    
    if not historial_datos:
        st.info("Aún no has completado ninguna entrevista en esta sesión. Completa tu primera práctica en la pestaña 'Entrenador Virtual' para ver tus métricas aquí.")
    else:
        col_m1, col_m2, col_m3 = st.columns(3)
        
        total_sesiones = len(historial_datos)
        promedio_nota = round(sum(d.get("nota", 5) for d in historial_datos) / total_sesiones, 1)
        ultima_nota = historial_datos[-1].get("nota", 5)

        col_m1.metric("Sesiones Completadas", total_sesiones)
        col_m2.metric("Promedio General", f"{promedio_nota} / 10")
        col_m3.metric("Última Calificación", f"{ultima_nota} / 10")

        st.markdown("---")
        st.markdown("### 📊 Desglose de Competencias por Sesión")
        
        df_historial = pd.DataFrame(historial_datos)
        df_historial["Nro_Sesion"] = [f"Sesión {i+1}" for i in range(len(df_historial))]

        df_grafico = df_historial.rename(columns={
            "nota_tecnica": "🛠️ Técnica",
            "nota_star": "🌟 Estructura STAR",
            "nota_oratoria": "🗣️ Oratoria/Ritmo",
            "nota_tono": "🎭 Tono/Emoción"
        })

        st.bar_chart(
            df_grafico,
            x="Nro_Sesion",
            y=["🛠️ Técnica", "🌟 Estructura STAR", "🗣️ Oratoria/Ritmo", "🎭 Tono/Emoción"],
            height=380
        )

        st.markdown("---")
        st.markdown("### 📜 Detalle de Sesiones Anteriores")
        st.dataframe(df_historial.drop(columns=["Nro_Sesion"]), use_container_width=True)