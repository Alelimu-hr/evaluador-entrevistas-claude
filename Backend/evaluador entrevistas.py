import streamlit as st
import google.generativeai as genai

# Configuración de la página
st.set_page_config(page_title="Evaluador de Entrevistas & Feedback HR", page_icon="🎯", layout="wide")

st.title("🎯 Evaluador de Entrevistas & Generador de Feedback")
st.subheader("Mejorando la experiencia del candidato mediante evaluación objetiva.")

st.markdown("---")

# Barra lateral para credenciales
with st.sidebar:
    st.header("⚙️ Configuración")
    api_key = st.text_input("Ingresa tu Gemini API Key (Gratis):", type="password")
    st.info("Obtén tu API Key gratis en aistudio.google.com")

# Formulario principal de la entrevista
col1, col2 = st.columns(2)

with col1:
    st.header("📝 Datos de la Entrevista")
    candidato_nombre = st.text_input("Nombre del Candidato", placeholder="Ej: Maria Perez")
    puesto = st.text_input("Puesto al que postula", placeholder="Ej: Senior Data Analyst")
    
    st.subheader("Atributos / Competencias a Evaluar")
    comunicacion = st.slider("Comunicación y Expresión", 1, 5, 3)
    tecnica = st.slider("Conocimiento Técnico / Resolutivo", 1, 5, 3)
    cultural = st.slider("Alineación Cultural y Trabajo en Equipo", 1, 5, 3)

with col2:
    st.header("🗣️ Notas de la Entrevista")
    notas = st.text_area(
        "Anotaciones del entrevistador (puntos fuertes, ejemplos dados, vacilaciones, etc.):",
        height=250,
        placeholder="Ej: El candidato explicó muy bien el proyecto X usando el método STAR, pero dudó al responder sobre cómo manejó el conflicto con su manager anterior."
    )

st.markdown("---")

# Botón para procesar
if st.button("🚀 Generar Evaluación y Feedback para Candidato", type="primary"):
    if not api_key:
        st.error("⚠️ Por favor ingresa tu Gemini API Key en la barra lateral para continuar.")
    elif not candidato_nombre or not notas:
        st.warning("⚠️ Por favor completa el nombre del candidato y las notas de la entrevista.")
    else:
        try:
            genai.configure(api_key=api_key)
            
            prompt = f"""
            Eres un Evaluador Experto en Selección de Talento y Coach de Carrera.
            Tu objetivo es procesar las notas de una entrevista y entregar dos resultados muy claros:
            
            1. REPORTE INTERNO PARA HR:
               - Puntuación general y resumen técnico.
               - Fortalezas destacadas.
               - Áreas de riesgo o dudas.
               - Recomendación (Avanza / No Avanza / En Reserva).
               
            2. FEEDBACK CONSTRUCTIVO PARA EL CANDIDATO (Formato Email/Carta):
               - Debe ser sumamente empático, profesional y constructivo.
               - Enfocado 100% en ayudar al candidato a mejorar su performance profesional para futuras entrevistas.
               - Si fue rechazado o sigue en proceso, explicárselo de forma clara sin ser cruenta.
               - Brindar consejos prácticos (ej: método STAR, profundizar en X tema técnico, estructurar mejor las respuestas).

            ---
            DATOS DE LA EVALUACIÓN:
            Candidato: {candidato_nombre}
            Puesto: {puesto}
            
            Puntuaciones del Entrevistador (1 a 5):
            - Comunicación: {comunicacion}/5
            - Capacidad Técnica: {tecnica}/5
            - Alineación Cultural: {cultural}/5
            
            Notas crudas del entrevistador:
            "{notas}"
            """
            
            with st.spinner("Conectando y buscando un modelo de Gemini activo..."):
                # Obtenemos los modelos que soportan generación de contenido
                modelos_candidatos = [
                    m.name for m in genai.list_models() 
                    if 'generateContent' in m.supported_generation_methods
                ]
                
                response = None
                modelo_exitoso = None

                # Probamos modelo por modelo en la práctica hasta que uno RESPONDA
                for nombre_m in modelos_candidatos:
                    try:
                        m = genai.GenerativeModel(nombre_m)
                        res = m.generate_content(prompt)
                        if res and res.text:
                            response = res
                            modelo_exitoso = nombre_m
                            break
                    except Exception:
                        # Si el modelo falla o tira 404, salta al siguiente de la lista silenciosamente
                        continue
                
                if response:
                    st.success(f"¡Evaluación completada con éxito usando `{modelo_exitoso}`!")
                    st.markdown(response.text)
                else:
                    st.error("No se pudo generar respuesta con ningún modelo disponible en la cuenta.")

        except Exception as e:
            st.error(f"Ocurrió un error general: {e}")
            