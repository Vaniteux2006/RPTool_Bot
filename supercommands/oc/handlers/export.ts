import { Message, AttachmentBuilder } from 'discord.js';
import { OCModel } from '../../../tools/models/OCSchema';

export default async function handleExport(message: Message, args: string[], userId: string) {
    const ocs = await OCModel.find({ adminId: userId });
    if (ocs.length === 0) return message.reply("❌ Você não tem OCs para exportar.");

    const tuppers = ocs.map(oc => ({
        name: oc.name,
        avatar_url: oc.avatar,
        brackets: [oc.prefix || "", oc.suffix || ""],
        posts: oc.messageCount || 0,
        description: "",
        created_at: oc.createdAt ? oc.createdAt.toISOString() : new Date().toISOString()
    }));

    const data = JSON.stringify({ tuppers }, null, 2);
    const buffer = Buffer.from(data, "utf-8");
    const attachment = new AttachmentBuilder(buffer, { name: "tupperbox_export.json" });

    message.reply({ content: `📦 Aqui está o seu backup de **${ocs.length}** OCs no formato Tupperbox!`, files: [attachment] });
}