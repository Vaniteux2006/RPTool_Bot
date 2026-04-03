// RPTool/supercommands/ficha/interactions.ts
import { EmbedBuilder } from "discord.js";
import { FichaModel, TemplateModel } from "../../tools/models/FichaSchema";
import { OCModel, WikiModel } from "../../tools/models/OCSchema";

export async function handleFichaInteraction(interaction: any) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('ficha_')) return;

    const [, action, fichaId] = interaction.customId.split('_');
    const ficha = await FichaModel.findById(fichaId);

    if (!ficha) return interaction.reply({ content: "❌ Ficha não encontrada no banco de dados.", ephemeral: true });

    // Lógica de Rejeição
    if (action === 'reject') {
        await FichaModel.findByIdAndDelete(fichaId);
        return interaction.update({ content: `❌ Ficha de **${ficha.characterName}** REJEITADA por ${interaction.user.username}.`, components: [] });
    }

    // Lógica de Aprovação (Com a correção de Banco de Dados DUPLO)
    if (action === 'approve') {
        ficha.status = 'approved';
        await ficha.save();

        const template = await TemplateModel.findOne({ guildId: interaction.guildId });

        if (template && template.integrateOC) {
            const nameKeys = ["nome", "name", "nome do personagem"];
            const bioKeys = ["história", "historia", "lore", "bio", "background"];
            
            let ocName = ficha.characterName;
            let ocBio = "";
            let ocPrefix = "";
            const ocExtras = new Map<string, string>();

            for (const [key, val] of Object.entries(ficha.data)) {
                const kLower = key.toLowerCase();
                if (key === '__avatar__') continue;
                
                if (template.ocPrefixLabel && kLower === template.ocPrefixLabel.toLowerCase()) {
                    ocPrefix = val as string;
                }
                else if (nameKeys.includes(kLower)) {
                    ocName = val as string;
                }
                else if (bioKeys.includes(kLower)) {
                    ocBio = val as string;
                }
                else {
                    ocExtras.set(key, String(val));
                }
            }

            try {
                // 1. Cria o OC no banco principal (Mongoose já não vai surtar)
                const novoOC = await OCModel.create({
                    adminId: ficha.userId,
                    name: ocName,
                    prefix: ocPrefix || ocName.toLowerCase(), 
                    suffix: "",
                    avatar: ficha.avatar,
                });

                // 2. Cria a Wiki no banco de lore, usando o ID gerado acima!
                await WikiModel.create({
                    ocId: novoOC._id,
                    adminId: ficha.userId,
                    bio: ocBio,
                    extras: ocExtras,
                    sections: [],
                    references: [],
                    gallery: []
                });
                
            } catch (err) {
                console.error("Erro ao integrar com OCModel/WikiModel.", err);
            }
        }
        await interaction.update({ content: `✅ Ficha de **${ficha.characterName}** APROVADA por ${interaction.user.username}!`, components: [] });
    }
}