const { spawn } = require('child_process');
const path = require('path');

let pythonProcess = null;
let shutdownTimer = null;
const PYTHON_PORT = 8000;
const SHUTDOWN_DELAY = 5 * 60 * 1000; 

const waitForServer = async (retries = 20) => {
    for (let i = 0; i < retries; i++) {
        try {
            await fetch(`http://127.0.0.1:${PYTHON_PORT}/docs`);
            return true;
        } catch (err) {
            await new Promise(r => setTimeout(r, 500)); // Espera 0.5s
        }
    }
    return false;
};

module.exports = {
    async ensureConnection() {
        console.log("🔍 [MANAGER] Verificando status do Python..."); // LOG NOVO

        if (!pythonProcess) {
            console.log("🐍 [MANAGER] Iniciando servidor Python agora...");
            const scriptPath = path.join(__dirname, 'python_api/api.py');
            
            // Tenta rodar 'python', se falhar, tenta 'py' (comum no Windows)
            try {
                pythonProcess = spawn('python', [scriptPath]);
                
                // --- PROTEÇÃO CONTRA CRASH IMEDIATO ---
                pythonProcess.on('error', (err) => {
                    console.error("❌ [MANAGER] Falha ao executar 'python'. Tentando 'py'...");
                    pythonProcess = spawn('py', [scriptPath]); // Tentativa secundária
                });
            } catch (e) {
                console.error("❌ [MANAGER] Erro crítico no spawn:", e);
            }

            pythonProcess.stdout.on('data', (data) => console.log(`[PYTHON]: ${data}`));
            pythonProcess.stderr.on('data', (data) => console.error(`[PYTHON ERRO]: ${data}`));
            
            pythonProcess.on('close', (code) => {
                console.log(`🐍 Python desligado (Código ${code})`);
                pythonProcess = null;
            });

            const isOnline = await waitForServer();
            if (!isOnline) {
                pythonProcess.kill();
                pythonProcess = null;
                throw new Error("O servidor Python não respondeu a tempo.");
            }
            console.log("✅ [MANAGER] Python conectado com sucesso!");
        }

        if (shutdownTimer) clearTimeout(shutdownTimer);
        shutdownTimer = setTimeout(() => {
            if (pythonProcess) {
                console.log("💤 [MANAGER] Inatividade. Desligando.");
                pythonProcess.kill();
                pythonProcess = null;
            }
        }, SHUTDOWN_DELAY);

        return PYTHON_PORT;
    }
};