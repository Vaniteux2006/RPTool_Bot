import { Client } from 'discord.js';
import fs from 'fs';
import path from 'path';

export default async function loadEvents(client: Client) {
    // Caminho para a pasta onde ficam os eventos
    const eventsPath = path.join(__dirname, '../../events'); 
    
    // Lê todas as pastas e arquivos dentro de events/
    const readEvents = (dir: string) => {
        const files = fs.readdirSync(dir);
        let count = 0;

        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                count += readEvents(filePath); // Se for uma subpasta, entra nela
            } else if (file.endsWith('.ts') || file.endsWith('.js')) {
                const imported = require(filePath).default; // Importa o que tem no arquivo
                if (!imported) continue;

                // Transforma em array se for um evento só, para o loop funcionar para ambos os casos
                const events = Array.isArray(imported) ? imported : [imported];

                for (const event of events) {
                    if (!event.name) continue;

                    // Liga o evento no client!
                    if (event.once) {
                        client.once(event.name, (...args) => event.execute(...args, client));
                    } else {
                        client.on(event.name, (...args) => event.execute(...args, client));
                    }
                    count++;
                }
            }
        }
            return count;
        }
    try {
        const loadedCount = readEvents(eventsPath);
        console.log(`📡 [EVENTOS] ${loadedCount} ouvintes conectados à Matrix com sucesso!`);
    } catch (error) {
        console.error("❌ [EVENTOS] Erro ao carregar a pasta de eventos:", error);
    }
}