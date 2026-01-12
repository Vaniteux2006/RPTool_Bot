const fs = require('fs');
const path = require('path');

function ReturnVersion() {
    // Caminho fixo para Data/version.json
    const versionPath = path.join(__dirname, 'Data', 'version.json');
    
    try {
        // Lê o arquivo e transforma em JSON
        const rawData = fs.readFileSync(versionPath, 'utf8');
        const data = JSON.parse(rawData);
        
        // Retorna a string bonita (Ex: "1.100.010-06")
        return data.current_display;
        
    } catch (error) {
        console.error("⚠️ [ReturnVersion] Não foi possível ler a versão:", error.message);
        return "Desconhecida"; // Fallback pra não quebrar o bot
    }
}

// Exporta a função direto
module.exports = ReturnVersion;