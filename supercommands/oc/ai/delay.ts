import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleDelay(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted || !extracted.rest) return message.reply("⚠️ Uso: `rp!oc delay \"NomeOC\" [Segundos]`");

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado.");

    // Aceita "120", "120s" ou "2m" — é o intervalo do autoMode (entre respostas automáticas)
    const raw = extracted.rest.trim().toLowerCase();
    const m = raw.match(/^(\d+)\s*(m|min|s|seg)?$/);
    if (!m) return message.reply("⚠️ Uso: `rp!oc delay \"NomeOC\" <tempo>` (ex: `90`, `90s` ou `2m`).");

    const value = parseInt(m[1]);
    const isMinutes = m[2] === 'm' || m[2] === 'min';
    const delaySeconds = isMinutes ? value * 60 : value;

    if (isNaN(delaySeconds) || delaySeconds < 0 || delaySeconds > 3600) {
        return message.reply("⚠️ O intervalo deve ficar entre **0** e **3600s** (1 hora).");
    }

    if (!oc.ai) {
        oc.ai = { enabled: false, persona: "", activeChannelId: null, autoMode: false, replyDelay: 120, memories: [] };
    }

    oc.ai.replyDelay = delaySeconds; // intervalo do autoMode (Schema)
    oc.markModified('ai');
    await oc.save();

    const human = delaySeconds >= 60 ? `${Math.round(delaySeconds / 60 * 10) / 10} min` : `${delaySeconds}s`;
    return message.reply(`⏳ Intervalo do autoMode de **${oc.name}** definido para **${human}**.`);
}