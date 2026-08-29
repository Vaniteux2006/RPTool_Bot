import { Message } from "discord.js";
import { AttachmentBuilder } from 'discord.js';

// Fonte única em tools/utils/text.ts — re-exportado para os consumidores antigos.
export { sanitizeOutput } from './text';

export function extractArgs(content: string, commandName: string): string[] {
    // 1. Encontra onde a palavra-chave do comando (ex: 'create', 'addplayer') termina
    const cmdIndex = content.toLowerCase().indexOf(commandName.toLowerCase());
    if (cmdIndex === -1) return [];

    // 2. Corta o prefixo e o comando, deixando apenas os dados brutos a partir daí
    const rawArgs = content.slice(cmdIndex + commandName.length).trim();

    // 3. RegEx avançada: separa por espaços, MAS ignora os espaços dentro de aspas!
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(rawArgs)) !== null) {
        // match[1] são aspas duplas, match[2] são aspas simples, match[0] é texto sem aspas
        matches.push(match[1] || match[2] || match[0]);
    }

    return matches;
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

export function formatLongContent(content: string, fileName: string) {
    const files: AttachmentBuilder[] = [];
    let text = content?.trim() || "*Mensagem vazia/Apenas mídia*";

    // O limite técnico para Fields de Embed é 1024
    if (text.length > 1024) {
        const buffer = Buffer.from(content, 'utf-8');
        files.push(new AttachmentBuilder(buffer, { name: fileName }));
        text = `⚠️ **Texto muito longo!** O conteúdo completo foi anexado no arquivo \`${fileName}\` acima.`;
    }

    return { text, files };
}
