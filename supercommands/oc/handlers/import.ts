// RPTool/supercommands/oc/import.ts
import { Message } from 'discord.js';
import axios from 'axios';
import { OCModel, WikiModel } from '../../../tools/models/OCSchema';

export default async function handleImport(message: Message, args: string[], userId: string) {
    const attachment = message.attachments.first();
    if (!attachment?.name?.endsWith(".json")) return message.reply("⚠️ Anexe o arquivo `.json`.");

    try {
        const res = await axios.get(attachment.url);
        const data = res.data;

        if (!data.OCs || !Array.isArray(data.OCs)) return message.reply("❌ Formato de arquivo inválido.");

        const aguarde = await message.reply("⏳ Sincronizando bancos de dados...");
        let count = 0;

        for (const t of data.OCs) {
            const prefix = Array.isArray(t.brackets) ? t.brackets[0] || "" : "";
            const suffix = Array.isArray(t.brackets) ? t.brackets[1] || "" : "";
            
            // 1. Atualiza o OC no banco principal
            const oc = await OCModel.findOneAndUpdate(
                { adminId: userId, name: t.name },
                {
                    adminId: userId,
                    name: t.name,
                    prefix,
                    suffix,
                    avatar: t.avatar_url || "",
                    ai: t.rpt_ai || { enabled: false, persona: "", memories: [] },
                    duoIds: t.rpt_duo || [],
                    group: t.rpt_group || null,
                    messageCount: t.posts || 0
                },
                { upsert: true, new: true }
            );

            // 2. Se o arquivo tiver dados de Wiki, salva no banco da Wiki
            if (t.rpt_wiki && oc) {
                await WikiModel.updateOne(
                    { ocId: oc._id },
                    {
                        ocId: oc._id,
                        adminId: userId,
                        ...t.rpt_wiki
                    },
                    { upsert: true }
                );
            }
            count++;
        }

        await aguarde.edit(`✅ **${count}** OCs sincronizados nos dois bancos de dados!`);
    } catch (error) {
        console.error(error);
        message.reply("❌ Erro ao ler o arquivo de importação.");
    }
}