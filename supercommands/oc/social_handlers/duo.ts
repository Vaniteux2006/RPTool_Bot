import { Message } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';
import { extractName } from '../utils';

export default async function handleDuo(message: Message, args: string[], userId: string) {
    const extracted = extractName(message.content, args[0]);
    if (!extracted) return message.reply("⚠️ Uso: `rp!oc duo \"NomeOC\" @usuario`");

    const oc = await OCModel.findOne({ adminId: userId, name: extracted.name });
    if (!oc) return message.reply("❌ OC não encontrado.");

    const targetUser = message.mentions.users.first();
    // Pega a menção ou tenta pegar o ID direto do texto
    const targetId = targetUser ? targetUser.id : extracted.rest.split(" ")[0];

    if (!targetId || targetId === userId) return message.reply("⚠️ Marque o usuário ou informe o ID válido para adicionar.");

    if (!oc.duoIds) oc.duoIds = [];
    if (oc.duoIds.includes(targetId)) return message.reply("⚠️ Esse usuário já tem acesso ao OC.");

    oc.duoIds.push(targetId);
    await oc.save();

    return message.reply(`🤝 Usuário <@${targetId}> agora pode usar **${oc.name}**!`);
}