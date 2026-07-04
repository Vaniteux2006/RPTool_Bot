import fs from 'fs';
import path from 'path';

export default function returnVersion(): string {
    try {
        const versionPath = path.join(__dirname, 'Data/version.json');
        
        if (fs.existsSync(versionPath)) {
            const rawData = fs.readFileSync(versionPath, 'utf-8');
            const data = JSON.parse(rawData);
            return data.current_display || "?.?.?";
        }
    } catch (e) {
        console.error("⚠️ [returnVersion] Não foi possível ler a versão.");
    }
    return "v1.6";
}