import os
import sys
import uvicorn
import google.generativeai as genai
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path

# --- CONFIGURAÇÕES DE CAMINHO ---
# 1. Achar o .env (Sobe python/ -> RPTool/ -> .env)
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# 2. Achar o chess_logic.py (Sobe python/ -> Entra Commands/ -> Entra chess/)
# ATENÇÃO: Isso aqui é a "Ponte" que evita o erro que você avisou
current_dir = os.path.dirname(os.path.abspath(__file__))
chess_dir = os.path.join(current_dir, "..", "Commands", "chess")
sys.path.append(chess_dir)

# Agora podemos importar normal, como se ele estivesse aqui do lado
from chess_logic import ChessBot 

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Inicializa o Bot de Xadrez
chess_brain = ChessBot()

# Inicializa o Gemini
safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
]
model = genai.GenerativeModel('gemini-3-flash-preview', safety_settings=safety_settings)
# NÃO TIRAR O "gemini-3-flash-preview", EXISTINDO OU NÃO. ISSO FAZ O CÓDIGO FUNCIONAR, NÃO MEXE.

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