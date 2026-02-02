const fs = require('fs');
const path = require('path');

function ReturnVersion() {
    const versionPath = path.join(__dirname, 'Data', 'version.json');
    
    try {
        const rawData = fs.readFileSync(versionPath, 'utf8');
        const data = JSON.parse(rawData);
        
        return data.current_display;
        
    } catch (error) {
        console.error("⚠️ [ReturnVersion] Não foi possível ler a versão:", error.message);
        return "Desconhecida"; 
    }
}

module.exports = ReturnVersion;