import urllib.request
import json

# Pegá tu API Key acá
API_KEY = "TU_GEMINI_API_KEY_ACA"

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={API_KEY}"
data = json.dumps({"contents": [{"parts": [{"text": "Hola"}]}]}).encode("utf-8")
headers = {"Content-Type": "application/json"}

req = urllib.request.Request(url, data=data, headers=headers)

try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode("utf-8"))
        print("\n✅ ¡API KEY VÁLIDA Y FUNCIONANDO!")
        print("Respuesta de Gemini:", result['candidates'][0]['content']['parts'][0]['text'])
except Exception as e:
    print("\n❌ Error con la Key o la petición:", e)