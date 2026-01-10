import os
import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path

# Carrega as variáveis de ambiente (Coloque a GEMINI_API_KEY no seu .env)
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Configura o Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Configuração de segurança (pra ele não bloquear violência de RPG/luta)
safety_settings = [
    {
        "category": "HARM_CATEGORY_HARASSMENT",
        "threshold": "BLOCK_NONE"
    },
    {
        "category": "HARM_CATEGORY_HATE_SPEECH",
        "threshold": "BLOCK_NONE"
    },
    {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "threshold": "BLOCK_NONE"
    },
    {
        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
        "threshold": "BLOCK_NONE"
    },
]



model = genai.GenerativeModel('gemini-3-flash-preview', safety_settings=safety_settings)
app = FastAPI()

# Modelo de dados que vamos receber do Node.js
class InteractionRequest(BaseModel):
    npc_name: str      # Ex: "Gerard"
    persona: str       # Ex: "Você é um vampiro emo de 2009..."
    user_message: str  # O que o player falou

@app.post("/chat")
async def chat_endpoint(request: InteractionRequest):
    print(f"📩 Recebido pedido para: {request.npc_name}")
    
    # Monta o prompt pro Gemini
    prompt_final = f"""
    [INSTRUÇÃO DO SISTEMA]
    {request.persona}
    
    [CONTEXTO ATUAL]
    O usuário falou algo para você. Responda interpretando o personagem {request.npc_name}.
    Mantenha respostas curtas (máximo 1 parágrafo) e no tom do RP.
    
    [USUÁRIO]: {request.user_message}
    [{request.npc_name}]:
    """
    
    try:
        response = model.generate_content(prompt_final)
        return {"reply": response.text}
    except Exception as e:
        return {"reply": f"// Erro de conexão neural: {str(e)}"}

# Para rodar: uvicorn api:app --reload
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)