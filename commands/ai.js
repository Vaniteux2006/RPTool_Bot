const { spawn } = require('child_process');
const path = require('path');

// --- VARIÁVEIS DE ESTADO DO SERVIDOR PYTHON ---
// Elas ficam fora do 'execute' para manterem o valor entre mensagens
let pythonProcess = null;
let shutdownTimer = null;

const PYTHON_PORT = 8000;
const SHUTDOWN_DELAY = 5 * 60 * 1000; // 5 Minutos em milissegundos

// Função auxiliar para esperar o servidor ligar
const waitForServer = async (retries = 10) => {
    for (let i = 0; i < retries; i++) {
        try {
            // Tenta bater na porta 8000. Se responder, tá vivo.
            await fetch(`http://127.0.0.1:${PYTHON_PORT}/docs`);
            return true;
        } catch (err) {
            // Se der erro, espera 1 segundo e tenta de novo
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return false;
};

module.exports = {
    name: 'ai',
    description: 'Conversa com um NPC via IA (Liga o Python automaticamente)',
    async execute(message, args) {
        
        const userMessage = args.join(' ');
        if (!userMessage) return message.reply("//bro, você precisa falar algo!");

        let placeholderMsg = await message.reply("💤 **[ Acordando o Cérebro da IA... ]**");

        // 1. VERIFICAÇÃO E INICIALIZAÇÃO DO PYTHON
        if (!pythonProcess) {
            console.log("🐍 Iniciando servidor Python sob demanda...");
            
            const scriptPath = path.join(__dirname, '../python_api/api.py');
            
            // Inicia o processo (Se no seu PC for 'python3', mude aqui)
            pythonProcess = spawn('python', [scriptPath]);

            // Redireciona os logs do Python pro terminal do Node (pra você ver erros)
            pythonProcess.stdout.on('data', (data) => console.log(`[PYTHON]: ${data}`));
            pythonProcess.stderr.on('data', (data) => console.error(`[PYTHON ERRO]: ${data}`));

            pythonProcess.on('close', (code) => {
                console.log(`🐍 Servidor Python desligado (Código ${code})`);
                pythonProcess = null;
            });

            // Espera o Uvicorn subir
            const isOnline = await waitForServer();
            if (!isOnline) {
                pythonProcess.kill(); // Mata se travou
                pythonProcess = null;
                return placeholderMsg.edit("❌ **Erro:** O servidor Python falhou ao iniciar. Verifique o terminal.");
            }
            
            await placeholderMsg.edit("🧠 **[ Processando... ]**");
        } else {
            // Se já estava ligado, só muda o aviso
            await placeholderMsg.edit("🧠 **[ Processando... ]**");
        }

        // 2. GERENCIAMENTO DO TIMER DE DESLIGAMENTO
        // Se tinha um desligamento agendado, cancela ele (renova a sessão)
        if (shutdownTimer) clearTimeout(shutdownTimer);

        // Agenda um novo desligamento para daqui a 5 minutos
        shutdownTimer = setTimeout(() => {
            if (pythonProcess) {
                console.log("💤 Inatividade detectada (5min). Desligando Python para economizar RAM.");
                pythonProcess.kill(); // Mata o processo
                pythonProcess = null;
            }
        }, SHUTDOWN_DELAY);


        // 3. REQUISIÇÃO NORMAL (IGUAL ANTES)
        // Defina aqui quem é o NPC (depois podemos deixar dinâmico)
        const npcData = {
            npc_name: "RPTool",
            persona: "Você é um bot assistente do Discord focado em fazer RP. Você é prestativo, educado e direto, mas também não finge atuar. Você não é um personagem da história, você é o sistema que gerencia ela, e age como um mascote do server.",
            user_message: userMessage
        };

        try {
            const response = await fetch(`http://127.0.0.1:${PYTHON_PORT}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(npcData)
            });

            const data = await response.json();
            placeholderMsg.edit(`${data.reply}`);

        } catch (error) {
            console.error(error);
            placeholderMsg.edit("// Erro: Conexão perdida com o Python durante a geração.");
        }
    },
};