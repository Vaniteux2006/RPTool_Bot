import { Message, TextChannel } from 'discord.js';

/**
 * Lê múltiplas mensagens do usuário e concatena tudo até ele digitar a palavra de parada.
 * @param message A mensagem original que engatilhou o comando
 * @param userId O ID do usuário que estamos ouvindo
 * @param stopKeyword A palavra que finaliza a leitura (padrão: "END")
 * @param cancelKeyword A palavra que cancela a operação (padrão: "CANCELAR")
 * @param timeoutMs Tempo máximo de espera em milissegundos (padrão: 5 minutos)
 * @returns O texto completo ou null se foi cancelado/tempo esgotado
 */
export async function readLongText(
    message: Message,
    userId: string,
    stopKeyword: string = "END",
    cancelKeyword: string = "CANCELAR",
    timeoutMs: number = 300000
): Promise<string | null> {
    return new Promise((resolve) => {
        const channel = message.channel as TextChannel;
        const filter = (m: Message) => m.author.id === userId;
        
        // Não definimos 'max' porque queremos várias mensagens
        const collector = channel.createMessageCollector({ filter, time: timeoutMs });
        
        let fullText = "";

        collector.on('collect', (m) => {
            const content = m.content.trim();

            if (content.toUpperCase() === cancelKeyword.toUpperCase()) {
                m.reply("❌ Operação cancelada.");
                collector.stop("cancelled");
                return;
            }

            if (content.toUpperCase() === stopKeyword.toUpperCase()) {
                collector.stop("finished");
                return;
            }

            // Concatena com uma quebra de linha dupla para separar os parágrafos
            fullText += (fullText.length > 0 ? "\n\n" : "") + content;
            
            // Reage à mensagem para o usuário saber que o bot "registrou" aquele parágrafo
            m.react('👀').catch(() => {});
        });

        collector.on('end', (collected, reason) => {
            if (reason === "cancelled") {
                resolve(null);
            } else if (reason === "time") {
                message.reply("⌛ Tempo esgotado! A operação foi cancelada.");
                resolve(null);
            } else {
                resolve(fullText.trim() || null);
            }
        });
    });
}