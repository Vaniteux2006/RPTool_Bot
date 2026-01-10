import google.generativeai as genai
import os
from dotenv import load_dotenv
from pathlib import Path

# Carrega o .env igualzinho ao seu bot
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

api_key = os.getenv("GEMINI_API_KEY")
print(f"🔑 Testando chave: {api_key[:5]}...{api_key[-5:]}")

genai.configure(api_key=api_key)

print("\n📡 Perguntando ao Google quais modelos você pode usar...")

try:
    found = False
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"✅ MODELO DISPONÍVEL: {m.name}")
            found = True
    
    if not found:
        print("❌ Nenhum modelo de texto encontrado. Sua chave pode estar limitada.")

except Exception as e:
    print(f"🔥 Erro fatal ao conectar: {e}")