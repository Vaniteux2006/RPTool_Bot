import json
import os
import google.generativeai as genai
from pathlib import Path

# --- CONFIGURAÇÃO ---
MODEL_NAME = 'gemini-3-flash-preview' # <--- MUDE AQUI SE TIVER O V3

class TupperBrain:
    def __init__(self):
        # Caminho: commands/tupper/ -> ... -> Data/ai_memory.json
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.db_path = os.path.join(current_dir, "..", "..", "Data", "ai_memory.json")
        self.memory_db = {}
        self.load_memory()
        
        # Configura Gemini (Pega a key do ambiente via api.py ou os.environ)
        # Assume que a API Key já está carregada pelo api.py
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

    # --- FUNÇÕES ---

    def register_persona(self, uid, tupper_name, persona_text):
        key = f"{uid}_{tupper_name}"
        if key not in self.memory_db:
            self.memory_db[key] = {
                "persona": persona_text,
                "long_term_memories": [] # Lista de strings (fatos aprendidos)
            }
        else:
            self.memory_db[key]["persona"] = persona_text
        
        self.save_memory()
        return {"status": "ok", "msg": "Persona registrada com sucesso!"}

    def generate_response(self, uid, tupper_name, context_messages):
        """
        uid: ID do dono do tupper
        tupper_name: Nome do char
        context_messages: Lista de strings com o chat recente (Buffer do Node)
        """
        key = f"{uid}_{tupper_name}"
        if key not in self.memory_db:
            return {"error": "Tupper sem persona definida. Use rp!create ai..."}

        data = self.memory_db[key]
        persona = data["persona"]
        memories = data["long_term_memories"]

        # 1. PROCESSAMENTO DE MEMÓRIA (Resumir o chat recente se for grande)
        # Se o contexto for muito grande, a gente pede pra IA extrair fatos antes de responder
        # Por simplicidade na V1, vamos pular a extração complexa e focar na resposta
        
        # 2. PROMPT DE GERAÇÃO
        prompt = f"""
        [PERSONA DO PERSONAGEM]
        {persona}

        [MEMÓRIAS DE LONGO PRAZO (O que você já sabe)]
        {chr(10).join(f"- {m}" for m in memories)}

        [CONTEXTO ATUAL (Chat recente)]
        {chr(10).join(context_messages)}

        [INSTRUÇÃO]
        Responda a última mensagem do contexto como o personagem descrito.
        Mantenha o tom da persona. Não use emojis se a persona for séria.
        Se aprendeu algo MUITO importante sobre o usuário agora, adicione uma tag [MEMORY: o que aprendeu] no final da resposta (invisível ao usuário).
        """

        try:
            response = self.model.generate_content(prompt)
            raw_text = response.text
            
            # Lógica simples de memória: Se a IA decidiu salvar algo
            final_reply = raw_text
            if "[MEMORY:" in raw_text:
                parts = raw_text.split("[MEMORY:")
                final_reply = parts[0].strip()
                new_memory = parts[1].replace("]", "").strip()
                
                # Salva a memória nova
                if new_memory not in memories:
                    memories.append(new_memory)
                    self.save_memory()

            return {"reply": final_reply, "new_memories": len(memories)}

        except Exception as e:
            return {"reply": f"// Erro cerebral: {str(e)}"}