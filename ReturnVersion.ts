import fs from 'fs';
import path from 'path';

export default function ReturnVersion(): string {
    try {
        const versionPath = path.join(__dirname, 'Data/version.json');
        
        if (fs.existsSync(versionPath)) {
            const rawData = fs.readFileSync(versionPath, 'utf-8');
            const data = JSON.parse(rawData);
            return data.current_display || "?.?.?";
        }
    } catch (e) {
        console.error("⚠️ [ReturnVersion] Não foi possível ler a versão.");
    }
    return "1.4";
}