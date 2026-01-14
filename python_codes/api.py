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

# 2. Achar os diretórios de comandos
current_dir = os.path.dirname(os.path.abspath(__file__))
chess_dir = os.path.join(current_dir, "..", "commands", "chess")
phone_dir = os.path.join(current_dir, "..", "commands", "phone")
tupper_dir = os.path.join(current_dir, "..", "commands", "tupper")

# Adiciona ao Path do Python
sys.path.append(chess_dir)
sys.path.append(phone_dir)
sys.path.append(tupper_dir)

# Importações dos Módulos
from chess_logic import ChessBot 
from phone_logic import PhoneSystem
from tupper_logic import TupperBrain

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Inicializa o Gemini
safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
]
model = genai.GenerativeModel('gemini-3-flash-preview', safety_settings=safety_settings)

app = FastAPI()

# Inicializa os Cérebros
chess_brain = ChessBot()
phone_brain = PhoneSystem()
tupper_brain = TupperBrain()

# --- MODELOS DE DADOS (Pydantic) ---
class InteractionRequest(BaseModel):
    npc_name: str
    persona: str
    user_message: str

class ChessRequest(BaseModel):
    fen: str
    mode: str = "solve"

class PhoneAction(BaseModel):
    action: str 
    server_id: str
    target_id: str = None 
    channel_id: str = None 
    marker: str = None

class PhoneMessage(BaseModel):
    content: str
    user_name: str
    server_name: str
    server_id: str
    channel_id: str

class PersonaRequest(BaseModel):
    uid: str
    tupper_name: str
    persona: str

class TupperChatRequest(BaseModel):
    uid: str
    tupper_name: str
    context: list[str]

# --- NOVO MODELO PARA MEMÓRIAS ---
class MemoryRequest(BaseModel):
    uid: str
    tupper_name: str
    memory_text: str


# --- ROTA 1: CHAT GENÉRICO ---
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

# --- ROTA 4: TELEFONE (TRANSMISSÃO) ---
@app.post("/phone/transmit")
async def phone_transmit(request: PhoneMessage):
    result = phone_brain.transmit(
        request.server_id, 
        request.channel_id, 
        request.content, 
        request.user_name, 
        request.server_name
    )
    if result: return result
    return {"status": "ignored"}

# --- ROTA 5: TUPPER AI ---
@app.post("/tupper/create")
async def create_persona(request: PersonaRequest):
    return tupper_brain.register_persona(request.uid, request.tupper_name, request.persona)

@app.post("/tupper/chat")
async def chat_tupper(request: TupperChatRequest):
    return tupper_brain.generate_response(request.uid, request.tupper_name, request.context)

# --- ROTA 6: MEMÓRIAS (A QUE FALTAVA!) ---
@app.post("/tupper/memories")
async def add_memories(request: MemoryRequest):
    # Chama a função que você já criou no tupper_logic.py
    return tupper_brain.add_memory(request.uid, request.tupper_name, request.memory_text)


# =======================================================
# O INICIADOR TEM QUE SER A ÚLTIMA COISA DO ARQUIVO
# =======================================================

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)