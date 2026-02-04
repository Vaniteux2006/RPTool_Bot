import os
import sys
import uvicorn
import warnings
import base64 
import google.generativeai as genai
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

current_dir = os.path.dirname(os.path.abspath(__file__))
chess_dir = os.path.join(current_dir, "..", "commands", "chess")
phone_dir = os.path.join(current_dir, "..", "commands", "phone")
tupper_dir = os.path.join(current_dir, "..", "commands", "tupper")
warnings.filterwarnings("ignore", category=FutureWarning, module="google.generativeai")

sys.path.append(chess_dir)
sys.path.append(phone_dir)
sys.path.append(tupper_dir)
sys.path.append(current_dir)

from chess_logic import ChessBot 
from phone_logic import PhoneSystem
from tupper_logic import TupperBrain
from quote_engine import render_quote 

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
]
model = genai.GenerativeModel('gemini-3-flash-preview', safety_settings=safety_settings)

app = FastAPI()

chess_brain = ChessBot()
phone_brain = PhoneSystem()
tupper_brain = TupperBrain()

class InteractionRequest(BaseModel):
    npc_name: str
    persona: str
    user_message: str

class ChessRequest(BaseModel):
    fen: str
    mode: str = "solve" 
    user_move: str = None 

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

class MemoryRequest(BaseModel):
    uid: str
    tupper_name: str
    memory_text: str

class QuoteRequest(BaseModel):
    text: str
    username: str
    avatar_url: str
    user_color: str
    options: dict

class ResenhaRequest(BaseModel):
    messages: list[str]

@app.post("/chat")
async def chat_endpoint(request: InteractionRequest):
    print(f"[IA] Mensagem para: {request.npc_name}")
    prompt_final = f"""
    [INSTRUÇÃO DO SISTEMA]
    {request.persona}
    [CONTEXTO]
    Responda como {request.npc_name}. 
    [USUÁRIO]: {request.user_message}
    [{request.npc_name}]:
    """
    try:
        response = model.generate_content(prompt_final)
        return {"reply": response.text}
    except Exception as e:
        return {"reply": f"// Erro neural: {str(e)}"}

@app.post("/chess")
async def chess_endpoint(request: ChessRequest):
    if request.mode == "play":
        if not request.user_move:
            return {"error": "Preciso de um movimento para jogar!"}
        return chess_brain.play_turn(request.fen, request.user_move)
    else:
        return chess_brain.analyze(request.fen)

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

@app.post("/tupper/create")
async def create_persona(request: PersonaRequest):
    return tupper_brain.register_persona(request.uid, request.tupper_name, request.persona)

@app.post("/tupper/chat")
async def chat_tupper(request: TupperChatRequest):
    return tupper_brain.generate_response(request.uid, request.tupper_name, request.context)

@app.post("/tupper/memories")
async def add_memories(request: MemoryRequest):
    return tupper_brain.add_memory(request.uid, request.tupper_name, request.memory_text)

@app.post("/quote/generate")
async def generate_quote_api(request: QuoteRequest):
    try:
        buffer = render_quote(
            request.text, 
            request.username, 
            request.avatar_url, 
            request.user_color,
            request.options
        )
        img_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return {"image_base64": img_str}
    except Exception as e:
        print(f"Erro no Quote: {e}")
        return {"error": str(e)}
    
@app.post("/resenha/check")
async def check_resenha(request: ResenhaRequest):
    chat_history = "\n".join(request.messages)
    
    prompt = f"""
    Você é um moderador de chat experiente em gírias de internet e caos.
    Sua tarefa é analisar as últimas mensagens de um chat e determinar o "Estado de Resenha".
    
    [CRITÉRIOS DE ANÁLISE]
    1. Xingamentos e Tretas: Discussões acaloradas ou xingamentos.
    2. Desafio à Autoridade: Membros peitando ADMs.
    3. Caos de Ping: Uso desnecessário de @everyone ou @here.
    4. Gírias e Memes: Uso intensivo de dialeto da internet.
    5. Risada Excessiva: Spam de "KKKKK" ou similares.
    6. Choque/Surpresa: Reações exageradas a algo que aconteceu.
    7. Tempo: Se tá a muito tempo sem mensagens ou com conversa morna e sem graça

    [SAÍDA OBRIGATÓRIA]
    Analise o texto abaixo e retorne APENAS um JSON estrito no seguinte formato:
    {{
        "status": "r-00" ou "r-01",
        "analysis": "Uma frase curta e engraçada justificando a decisão."
    }}

    Regra: "r-01" é para Resenha Confirmada (Caos/Zueira/Treta). "r-00" é para Não há resenha (Chat parado ou conversa normal).

    [HISTÓRICO DO CHAT]
    {chat_history}
    """
    
    try:
        response = model.generate_content(prompt)
        # Limpeza para garantir JSON válido
        text_resp = response.text.replace('```json', '').replace('```', '').strip()
        import json
        return json.loads(text_resp)
    except Exception as e:
        print(f"Erro na resenha: {e}")
        return {"status": "r-00", "analysis": "A IA bugou com tanta resenha."}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)