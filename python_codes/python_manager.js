const { spawn } = require('child_process');
const path = require('path');

let pythonProcess = null;
let shutdownTimer = null;
const PYTHON_PORT = 8000;
const SHUTDOWN_DELAY = 5 * 60 * 100000000; 

const waitForServer = async (retries = 20) => {
    for (let i = 0; i < retries; i++) {
        try {
            await fetch(`http://127.0.0.1:${PYTHON_PORT}/docs`);
            return true;
        } catch (err) {
            await new Promise(r => setTimeout(r, 500));
        }
    }
    return false;
};

module.exports = {
    async ensureConnection() {
        console.log("🔍 [MANAGER] Verificando status do Python...");

        if (!pythonProcess) {
            console.log("🐍 [MANAGER] Iniciando servidor Python...");
            
            // ATUALIZADO: Arquivo está na mesma pasta agora
            const scriptPath = path.join(__dirname, 'api.py');
            
            try {
                pythonProcess = spawn('python', [scriptPath]);
                
                pythonProcess.on('error', (err) => {
                    console.log("⚠️ [MANAGER] 'python' falhou. Tentando 'py'...");
                    pythonProcess = spawn('py', [scriptPath]);
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
                if (pythonProcess) pythonProcess.kill();
                pythonProcess = null;
                throw new Error("O servidor Python não respondeu.");
            }
            console.log("✅ [MANAGER] Python conectado!");
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