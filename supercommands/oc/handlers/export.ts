// RPTool/supercommands/oc/export.ts
import { Message, AttachmentBuilder } from 'discord.js';
import { OCModel, WikiModel } from '../../../tools/models/OCSchema';

export default async function handleExport(message: Message, args: string[], userId: string) {
    const isFull = args[1]?.toLowerCase() === 'full';
    const ocs = await OCModel.find({ adminId: userId });

    if (ocs.length === 0) return message.reply("❌ Você não tem OCs para exportar.");

    const OCs = await Promise.all(ocs.map(async (oc) => {
        // Base (Tupperbox Standard)
        const base = {
            name: oc.name,
            avatar_url: oc.avatar,
            brackets: [oc.prefix || "", oc.suffix || ""],
            posts: oc.messageCount || 0,
            description: "",
            created_at: oc.createdAt ? oc.createdAt.toISOString() : new Date().toISOString()
        };

        // Se for full, buscamos no banco da Wiki e adicionamos as propriedades do RPTool
        if (isFull) {
            const wiki = await WikiModel.findOne({ ocId: oc._id });
            return {
                ...base,
                rpt_ai: oc.ai,
                rpt_duo: oc.duoIds,
                rpt_group: oc.group,
                rpt_wiki: wiki ? {
                    bio: wiki.bio,
                    extras: Object.fromEntries(wiki.extras),
                    sections: wiki.sections,
                    references: wiki.references,
                    gallery: wiki.gallery
                } : null
            };
        }

        return base;
    }));

    const data = JSON.stringify({ rpt_version: isFull ? "2.0" : "1.0", OCs }, null, 2);
    const buffer = Buffer.from(data, "utf-8");
    const filename = isFull ? "rptool_full_backup.json" : "tupperbox_export.json";
    const attachment = new AttachmentBuilder(buffer, { name: filename });

    const msgText = isFull 
        ? `📦 Backup **COMPLETO** (Wiki, IA, Duo) de **${ocs.length}** OCs gerado!`
        : `📦 Backup padrão (Tupperbox) de **${ocs.length}** OCs gerado!`;

    message.reply({ content: msgText, files: [attachment] });
}