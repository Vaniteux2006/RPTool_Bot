const { spawn } = require('child_process');
const path = require('path');

let pythonProcess = null;
let shutdownTimer = null;
const PYTHON_PORT = 8000;
const SHUTDOWN_DELAY = 60 * 60 * 1000; 

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
            
            const scriptPath = path.join(__dirname, 'api.py');
            
            // DETECTA O SISTEMA OPERACIONAL
            // Se for Windows ('win32'), tenta 'python' ou 'py'. 
            // Se for Linux, usa 'python3'.
            const command = process.platform === 'win32' ? 'python' : 'python3';
            
            try {
                // Tenta iniciar com o comando principal
                pythonProcess = spawn(command, [scriptPath]);
                
                pythonProcess.on('error', (err) => {
                    console.log(`⚠️ [MANAGER] '${command}' falhou. Tentando fallback...`);
                    // Fallback para Windows caso 'python' falhe
                    if (process.platform === 'win32') {
                         pythonProcess = spawn('py', [scriptPath]);
                    } else {
                        // Fallback para Linux (as vezes é só 'python')
                        pythonProcess = spawn('python', [scriptPath]);
                    }
                });
            } catch (e) {
                console.error("❌ [MANAGER] Erro crítico no spawn:", e);
            }

            // O resto continua igual...
            if (pythonProcess) {
                pythonProcess.stdout.on('data', (data) => console.log(`[PYTHON]: ${data}`));
                pythonProcess.stderr.on('data', (data) => console.error(`[PYTHON ERRO]: ${data}`));
                
                pythonProcess.on('close', (code) => {
                    console.log(`🐍 Python desligado (Código ${code})`);
                    pythonProcess = null;
                });
            }

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