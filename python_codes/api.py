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
phone_dir = os.path.join(current_dir, "..", "commands", "phone")
sys.path.append(chess_dir)
sys.path.append(phone_dir)

# Agora podemos importar normal, como se ele estivesse aqui do lado
from chess_logic import ChessBot 
from phone_logic import PhoneSystem

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


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

# Inicializa o Bot de Xadrez
chess_brain = ChessBot()


# INICIALIZA O SISTEMA DE TELEFONE
phone_brain = PhoneSystem()

# --- MODELOS DE DADOS ---
class InteractionRequest(BaseModel):
    npc_name: str
    persona: str
    user_message: str

class ChessRequest(BaseModel):
    fen: str
    mode: str = "solve"

class PhoneAction(BaseModel):
    action: str # register, call, accept, decline, end, off
    server_id: str
    target_id: str = None # Opcional (pra ligar)
    channel_id: str = None # Opcional (pro registro)
    marker: str = None

class PhoneMessage(BaseModel):
    content: str
    user_name: str
    server_name: str
    server_id: str
    channel_id: str

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

# --- ROTA 3: TELEFONE (COMANDOS) ---
@app.post("/phone/cmd")
async def phone_command(request: PhoneAction):
    match request.action:
        case "register":
            return phone_brain.register(request.server_id, request.channel_id, request.marker)
        case "off":
            return phone_brain.turn_off(request.server_id)
        case "call":
            return phone_brain.call(request.server_id, request.target_id)
        case "group":
            return phone_brain.request_group_join(request.server_id, request.target_id)
        case "accept":
            return phone_brain.accept(request.server_id)
        case "decline":
            return phone_brain.decline(request.server_id)
        case "end":
            return phone_brain.end_call(request.server_id)
        case _:
            return {"error": "Comando desconhecido"}
    
    return {"error": "Comando desconhecido"}

# --- ROTA 4: TELEFONE (TRANSMISSÃO DE VOZ/TEXTO) ---
@app.post("/phone/transmit")
async def phone_transmit(request: PhoneMessage):
    # Agora passa o channel_id
    result = phone_brain.transmit(
        request.server_id, 
        request.channel_id, 
        request.content, 
        request.user_name, 
        request.server_name
    )
    if result: return result
    return {"status": "ignored"} # Não está em call ou erro

# =======================================================
# O INICIADOR TEM QUE SER A ÚLTIMA COISA DO ARQUIVO
# =======================================================

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
