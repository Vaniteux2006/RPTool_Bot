import { Message } from "discord.js";

// Limpa pings perigosos (ótimo para qualquer comando de IA ou Webhook)
export function sanitizeOutput(text: string): string {
    if (!text) return text;
    return text
        .replace(/@everyone/g, '@everyоne')
        .replace(/@here/g, '@hеre')

        .replace(/<@&(\d+)>/g, '<@&\u200b$1>');
}

// Extrai nomes entre aspas ou crases (Excelente para comandos de busca, ban, etc)
export const extractName = (content: string, commandName: string) => {
    const cmdIndex = content.toLowerCase().indexOf(commandName.toLowerCase());
    if (cmdIndex === -1) return null;

    const rawArgs = content.slice(cmdIndex + commandName.length).trim();
    const match = rawArgs.match(/^("([^"]+)"|'([^']+)'|`([^`]+)`|(\S+))(\s+(.+))?$/);

    if (!match) return null;

    return {
        name: match[2] || match[3] || match[4] || match[5],
        rest: match[7]?.trim() || ""
    };
};

export const cleanWrapper = (str: string) => {
    if ((str.startsWith('') && str.endsWith('')) ||
        (str.startsWith('"') && str.endsWith('"')) ||
        (str.startsWith("'") && str.endsWith("'"))) {
        return str.slice(1, -1);
    }
    return str;
};

export const parseWikiText = (rawText: string) => {
    const extractedRefs: string[] = [];

    const cleanText = rawText.replace(/\(ref="([^"]+)"\)/g, (match, refName) => {
        if (!extractedRefs.includes(refName)) {
            extractedRefs.push(refName);
        }
        return `**__${refName}__**`;
    });

    return { cleanText, extractedRefs };
};
