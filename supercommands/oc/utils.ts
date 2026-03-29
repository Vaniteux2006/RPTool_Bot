// RPTool/supercommands/oc/utils.ts

// Extrai o nome do OC (com ou sem aspas) e retorna o resto do texto
export function extractName(content: string, subCommand: string) {
    // Remove o prefixo e o subcomando base
    const prefixRegex = /^rp!oc\s+[a-z]+\s+/i;
    let raw = content.replace(prefixRegex, "");
    
    // Se tiver um sub-subcomando (ex: wiki add), remove ele também provisoriamente
    if (raw.startsWith(subCommand)) {
        raw = raw.replace(new RegExp(`^${subCommand}\\s+`, 'i'), "");
    }

    const match = raw.match(/^("([^"]+)"|'([^']+)'|([^\s]+))\s*(.*)$/si);
    if (!match) return null;

    return {
        name: match[2] || match[3] || match[4],
        rest: match[5] ? match[5].trim() : ""
    };
}

// Limpa nulls e undefineds dos prefixos e sufixos
export function cleanWrapper(text: string) {
    if (!text || text.toLowerCase() === "null") return "";
    return text.trim();
}