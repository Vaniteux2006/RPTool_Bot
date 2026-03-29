import { Message } from 'discord.js';
import axios from 'axios';
import { OCModel } from '../../../tools/models/OCSchema';

export default async function handleImport(message: Message, args: string[], userId: string) {
    const attachment = message.attachments.first();
    if (!attachment?.name?.endsWith(".json")) return message.reply("⚠️ Anexe o arquivo `.json` do Tupperbox/PluralKit.");

    try {
        const res = await axios.get(attachment.url);
        const data = res.data;

        if (!data.OCs || !Array.isArray(data.OCs)) {
            return message.reply("❌ O arquivo não parece ser um backup válido do Tupperbox.");
        }

        const aguarde = await message.reply("⏳ Processando importação...");
        let count = 0;

        for (const t of data.OCs) {
            const prefix = Array.isArray(t.brackets) ? t.brackets[0] || "" : "";
            const suffix = Array.isArray(t.brackets) ? t.brackets[1] || "" : "";
            
            await OCModel.updateOne(
                { adminId: userId, name: t.name },
                {
                    adminId: userId,
                    name: t.name,
                    prefix,
                    suffix,
                    avatar: t.avatar_url || "",
                    messageCount: typeof t.posts === 'number' ? t.posts : 0,
                    createdAt: t.created_at ? new Date(t.created_at) : new Date()
                },
                { upsert: true }
            );
            count++;
        }

        await aguarde.edit(`✅ **${count}** OCs importados e sincronizados com sucesso!`);
    } catch (error) {
        console.error(error);
        message.reply("❌ Falha ao processar o arquivo de importação.");
    }
}