import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

// rp!oc auto "Nome" [on|off]
// Liga/desliga o autoMode: o NPC passa a participar sozinho da conversa neste canal
// (responde rápido quando citam o nome dele e periodicamente no resto). Ver
// tools/utils/aiUtils.ts → handleAIMessage para a lógica de disparo.
export default async function handleAuto(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted) return message.reply('⚠️ Uso: `rp!oc auto "NomeOC" [on|off]`');

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply('❌ OC não encontrado.');

    if (!oc.ai) {
        oc.ai = { enabled: false, persona: '', activeChannelId: null, autoMode: false, replyDelay: 120, memories: [] };
    }

    const wantsOff = extracted.rest?.trim().toLowerCase() === 'off';

    if (wantsOff) {
        oc.ai.autoMode = false;
        oc.markModified('ai');
        await oc.save();
        return message.reply(`💤 **${oc.name}** parou de responder sozinho. (A IA continua ativa para o gatilho \`ai:\`.)`);
    }

    // Ligar: garante que a IA está ativa e ancorada neste canal
    if (!oc.ai.persona) {
        return message.reply(`⚠️ **${oc.name}** ainda não tem personalidade. Configure antes com \`rp!oc ai "${oc.name}" <descrição>\` ou \`rp!oc persona "${oc.name}"\`.`);
    }

    oc.ai.enabled = true;
    oc.ai.autoMode = true;
    oc.ai.activeChannelId = message.channel.id;
    if (!oc.ai.replyDelay || oc.ai.replyDelay < 30) oc.ai.replyDelay = 120; // padrão equilibrado (~2 min)
    oc.markModified('ai');
    await oc.save();

    const intervalo = Math.round((oc.ai.replyDelay || 120) / 60 * 10) / 10;
    return message.reply(
        `🟢 **${oc.name}** agora está **vivo neste canal**! Ele lê a conversa e responde sozinho ` +
        `(rápido quando citam o nome dele, e a cada ~${intervalo} min no resto).\n` +
        `Ajuste o ritmo com \`rp!oc delay "${oc.name}" <tempo>\` • desligue com \`rp!oc auto "${oc.name}" off\`.`,
    );
}
