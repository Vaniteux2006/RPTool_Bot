import fs from 'fs';
import path from 'path';

export default function ReturnVersion(): string {
    try {
        // Ajuste o caminho se necessário.
        // Assumindo que a pasta Data está na raiz do projeto (um nível acima deste arquivo)
        const versionPath = path.join(__dirname, 'Data/version.json');
        
        if (fs.existsSync(versionPath)) {
            const rawData = fs.readFileSync(versionPath, 'utf-8');
            const data = JSON.parse(rawData);
            return data.current_display || "?.?.?";
        }
    } catch (e) {
        console.error("⚠️ [ReturnVersion] Não foi possível ler a versão.");
    }
    return "1.0.0";
}