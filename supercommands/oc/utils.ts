// RPTool/supercommands/oc/utils.ts

// Extrai o nome do OC (com aspas duplas, simples, crases ou sem aspas) e retorna o resto do texto
export function extractName(content: string, subCommand: string) {
    // Remove o prefixo do bot e o primeiro comando base dinamicamente (ex: rp!oc avatar, rp!oc create)
    const prefixRegex = /^rp!oc\s+[a-z]+\s+/i;
    let raw = content.replace(prefixRegex, "");
    
    // Se tiver um sub-subcomando (ex: wiki add), remove ele também provisoriamente
    if (raw.toLowerCase().startsWith(subCommand.toLowerCase())) {
        raw = raw.replace(new RegExp(`^${subCommand}\\s+`, 'i'), "");
    }

    // Captura o nome (grupo 2, 3, 4 ou 5 dependendo da aspa) e o resto (grupo 6)
    const match = raw.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|([^\s]+))\s*(.*)$/si);
    if (!match) return null;

    return {
        name: match[2] || match[3] || match[4] || match[5],
        rest: match[6] ? match[6].trim() : ""
    };
}

// Limpa nulls e undefineds de textos, prefixos e sufixos
export function cleanWrapper(text: string) {
    if (!text || text.toLowerCase() === "null") return "";
    return text.trim();
}