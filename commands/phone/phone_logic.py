import json
import os

class PhoneSystem:
    def __init__(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.db_path = os.path.join(current_dir, "..", "..", "Data", "phone_registry.json")

        # NOVA ESTRUTURA:
        # registry = { 
        #    "server_id": { "channel_id": "...", "marker": "nome_opcional" } 
        # }
        self.registry = {}      
        self.active_calls = {}  # { server_id: call_id }
        self.calls_data = {}    # { call_id: [participantes] }
        self.invites = {}       # { to_server: from_server }
        self.join_requests = {} 

        self.load_registry()

    def load_registry(self):
        try:
            if os.path.exists(self.db_path):
                with open(self.db_path, "r") as f:
                    self.registry = json.load(f)
        except: self.registry = {}

    def save_registry(self):
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        with open(self.db_path, "w") as f:
            json.dump(self.registry, f, indent=4)

    # --- HELPER: Acha o ID do server pelo ID ou pelo Marker ---
    def resolve_target(self, target_input):
        if not target_input: return None
        target_clean = target_input.strip()
        
        # 1. Tenta achar direto pelo ID
        if target_clean in self.registry:
            return target_clean
            
        # 2. Tenta achar pelo Marker (Nome)
        # Itera sobre todos os registros pra ver se o nome bate
        for s_id, data in self.registry.items():
            marker = data.get("marker")
            if marker and marker.lower() == target_clean.lower():
                return s_id
                
        return None

    # --- AÇÕES ---
    def register(self, server_id, channel_id, marker=None):
        # Salva o objeto completo agora
        self.registry[server_id] = {
            "channel_id": channel_id,
            "marker": marker
        }
        self.save_registry()
        
        msg = "📞 Telefone instalado neste canal!"
        if marker:
            msg += f"\n🏷️ **Nome registrado:** `{marker}` (Outros podem ligar usando este nome)"
        return {"status": "ok", "msg": msg}

    def turn_off(self, server_id):
        if server_id in self.registry:
            del self.registry[server_id]
            self.save_registry()
            return {"status": "ok", "msg": "🔌 Telefone desligado e removido."}
        return {"status": "error", "msg": "Você não tem telefone registrado."}

    def call(self, from_server, target_input):
        if from_server not in self.registry: return {"error": "Instale o telefone primeiro (rp!phone register)."}
        
        # Busca inteligente (ID ou Nome)
        to_server = self.resolve_target(target_input)
        
        if not to_server: return {"error": "Servidor ou Nome não encontrado no registro."}
        if to_server == from_server: return {"error": "Você não pode ligar para si mesmo."}

        if from_server in self.active_calls: return {"error": "Você já está em uma ligação!"}
        
        if to_server in self.active_calls: 
            return {"status": "busy", "msg": f"⚠️ O destino '{target_input}' está ocupado.\nUse `rp!phone group {target_input}` para pedir entrada!"}

        self.invites[to_server] = from_server
        
        # Retorna o ID do canal destino pra o Node avisar lá
        target_channel = self.registry[to_server]["channel_id"]
        return {"status": "ringing", "target_channel": target_channel}

    def request_group_join(self, requester_id, target_input):
        if requester_id not in self.registry: return {"error": "Instale o telefone primeiro."}
        if requester_id in self.active_calls: return {"error": "Você já está em call."}
        
        target_id = self.resolve_target(target_input)
        if not target_id: return {"error": "Destino não encontrado."}
        
        if target_id not in self.active_calls:
            return {"error": "Este servidor NÃO está em ligação. Use `rp!phone call`."}

        call_id = self.active_calls[target_id]
        participants = self.calls_data[call_id]

        self.join_requests[requester_id] = {
            "call_id": call_id,
            "remaining": list(participants) 
        }

        # Pega lista de canais dos participantes
        notify_channels = [self.registry[p]["channel_id"] for p in participants if p in self.registry]
        return {"status": "voting_started", "channels": notify_channels}

    def accept(self, server_id):
        # 1. Convite Direto
        if server_id in self.invites:
            caller = self.invites.pop(server_id)
            call_id = f"call_{caller}_{server_id}"
            
            self.active_calls[caller] = call_id
            self.active_calls[server_id] = call_id
            self.calls_data[call_id] = [caller, server_id]
            
            # Retorna canal do chamador pra avisar que atendeu
            return {"status": "connected", "partners": [self.registry[caller]["channel_id"]]}

        # 2. Votação de Grupo
        for requester, data in list(self.join_requests.items()):
            if server_id in data['remaining']:
                data['remaining'].remove(server_id)
                
                if not data['remaining']: # Unanimidade
                    call_id = data['call_id']
                    del self.join_requests[requester]
                    
                    self.active_calls[requester] = call_id
                    self.calls_data[call_id].append(requester)
                    
                    all_members = self.calls_data[call_id]
                    channels = [self.registry[p]["channel_id"] for p in all_members if p in self.registry]
                    
                    requester_channel = self.registry[requester]["channel_id"]
                    return {"status": "group_joined", "channels": channels, "new_member_id": requester, "requester_channel": requester_channel}
                else:
                    return {"status": "vote_registered", "remaining": len(data['remaining'])}

        return {"error": "Nenhum chamado pendente."}

    def decline(self, server_id):
        if server_id in self.invites:
            caller = self.invites.pop(server_id)
            return {"status": "declined", "target_channel": self.registry[caller]["channel_id"]}
        
        for requester, data in list(self.join_requests.items()):
            call_participants = self.calls_data.get(data['call_id'], [])
            if server_id in call_participants:
                del self.join_requests[requester]
                requester_channel = self.registry[requester]["channel_id"]
                return {"status": "group_denied", "requester_channel": requester_channel}

        return {"error": "Nada para recusar."}

    def end_call(self, server_id):
        if server_id not in self.active_calls: return {"error": "Você não está em ligação."}
        
        call_id = self.active_calls[server_id]
        participants = self.calls_data.get(call_id, [])
        
        target_channels = []
        for p in participants:
            if p in self.active_calls: del self.active_calls[p]
            # Avisa todo mundo menos quem desligou
            if p in self.registry and p != server_id:
                target_channels.append(self.registry[p]["channel_id"])
        
        if call_id in self.calls_data: del self.calls_data[call_id]
        
        keys_to_remove = [k for k, v in self.join_requests.items() if v['call_id'] == call_id]
        for k in keys_to_remove: del self.join_requests[k]

        return {"status": "ended", "notify_channels": target_channels}

    # --- TRANSMISSÃO (AGORA SEGURA 🔒) ---
    def transmit(self, sender_server, sender_channel_id, content, user_name, server_name):
        # 1. Verifica se está registrado
        if sender_server not in self.registry: return None
        
        # 2. SEGURANÇA: Verifica se a msg veio do canal certo
        registered_channel = self.registry[sender_server]["channel_id"]
        if sender_channel_id != registered_channel: return None # Ignora msg de outros chats
        
        # 3. Verifica se está em call
        if sender_server not in self.active_calls: return None
        
        call_id = self.active_calls[sender_server]
        participants = self.calls_data.get(call_id, [])
        
        destinations = []
        for p in participants:
            if p != sender_server and p in self.registry:
                destinations.append(self.registry[p]["channel_id"])
                
        if not destinations: return None

        formatted = f"**({user_name})** | *[ {server_name} ]* 📞💬: {content}"
        return {"targets": destinations, "msg": formatted}