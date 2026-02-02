import json
import os
import google.generativeai as genai
from pathlib import Path

MODEL_NAME = 'gemini-3-flash-preview' 

class TupperBrain:
    def __init__(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.db_path = os.path.join(current_dir, "..", "..", "Data", "ai_memory.json")
        self.memory_db = {}
        self.load_memory()
        
        self.model = genai.GenerativeModel(MODEL_NAME)

    def load_memory(self):
        try:
            if os.path.exists(self.db_path):
                with open(self.db_path, "r", encoding='utf-8') as f:
                    self.memory_db = json.load(f)
        except: self.memory_db = {}

    def save_memory(self):
        try:
            with open(self.db_path, "w", encoding='utf-8') as f:
                json.dump(self.memory_db, f, indent=4, ensure_ascii=False)
        except Exception as e:
            print(f"Erro ao salvar memória: {e}")

    def add_memory(self, uid, tupper_name, memory_text):
        key = f"{uid}_{tupper_name}"
        if key not in self.memory_db:
            self.memory_db[key] = { "persona": "Indefinida", "long_term_memories": [] }
        if "long_term_memories" not in self.memory_db[key]:
            self.memory_db[key]["long_term_memories"] = []
            
        self.memory_db[key]["long_term_memories"].append(memory_text)
        self.save_memory()
        return {"status": "ok", "msg": "Memória implantada."}

    def register_persona(self, uid, tupper_name, persona_text):
        key = f"{uid}_{tupper_name}"
        if key not in self.memory_db:
            self.memory_db[key] = { "persona": persona_text, "long_term_memories": [] }
        else:
            self.memory_db[key]["persona"] = persona_text
        self.save_memory()
        return {"status": "ok", "msg": "Persona registrada!"}

    def generate_response(self, uid, tupper_name, context_messages):
        key = f"{uid}_{tupper_name}"
        if key not in self.memory_db:
            return {"error": "Tupper sem persona."}

        data = self.memory_db[key]
        persona = data.get("persona", "Personalidade não encontrada.")
        memories = data.get("long_term_memories", [])

        prompt = f"""
        [PERSONA DO PERSONAGEM]
        {persona}

        [MEMÓRIAS DE LONGO PRAZO]
        {chr(10).join(f"- {m}" for m in memories)}

        [LOG DE MENSAGENS RECENTES (ÚLTIMO MINUTO)]
        O formato abaixo é: [Nome do Usuário]: Mensagem
        ---
        {chr(10).join(context_messages)}
        ---

        [INSTRUÇÃO CRÍTICA]
        Você está lendo um log acumulado do chat.
        1. Analise o fluxo da conversa acima.
        2. Se ninguém falou com você ou o assunto não interessa: RESPONDA APENAS "[NO_REPLY]"
        3. Se for pertinente participar: Responda como o personagem. Seja direto.
        4. Se aprender algo novo: Use [MEMORY: fato] no final.
        """

        try:
            response = self.model.generate_content(prompt)
            raw_text = response.text.strip()
            
            if raw_text == "[NO_REPLY]" or raw_text == "NO_REPLY":
                return {"reply": None} 

            final_reply = raw_text
            
            if "[MEMORY:" in raw_text:
                parts = raw_text.split("[MEMORY:")
                final_reply = parts[0].strip()
                new_memory = parts[1].replace("]", "").strip()
                if new_memory and new_memory not in memories:
                    memories.append(new_memory)
                    self.save_memory()

            return {"reply": final_reply}

        except Exception as e:
            return {"reply": f"// Erro cerebral: {str(e)}"}