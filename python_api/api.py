import os
import sys
import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path

# --- TRUQUE PARA IMPORTAR DA PASTA VIZINHA ---
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Importa da pasta renomeada 'chess_engine'
from chess_engine.chess_logic import ChessBot 

# --- CONFIGURAÇÕES DO SISTEMA ---
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Inicializa o Bot de Xadrez
chess_brain = ChessBot()

# Inicializa o Gemini (Modelo corrigido para 1.5 Flash)
safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
]
model = genai.GenerativeModel('gemini-3-flash-preview', safety_settings=safety_settings)

app = FastAPI()

# --- MODELOS DE DADOS ---
class InteractionRequest(BaseModel):
    npc_name: str
    persona: str
    user_message: str

class ChessRequest(BaseModel):
    fen: str
    mode: str = "solve"

# --- ROTA 1: CHAT GEMINI ---
@app.post("/chat")
async def chat_endpoint(request: InteractionRequest):
    print(f"[IA] Mensagem para: {request.npc_name}")
    prompt_final = f"""
    [INSTRUÇÃO DO SISTEMA]
    {request.persona}
    [CONTEXTO]
    Responda como {request.npc_name}. Curto e direto.
    [USUÁRIO]: {request.user_message}
    [{request.npc_name}]:
    """
    try:
        response = model.generate_content(prompt_final)
        return {"reply": response.text}
    except Exception as e:
        return {"reply": f"// Erro neural: {str(e)}"}

# --- ROTA 2: XADREZ ---
@app.post("/chess")
async def chess_endpoint(request: ChessRequest):
    return chess_brain.analyze(request.fen)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)