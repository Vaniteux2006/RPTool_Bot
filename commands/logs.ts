import { Message, TextChannel } from "discord.js";
import { Command } from "../tools/interfaces/Command"; 
import { GuildConfigModel } from "../tools/models/GuildConfig";

export const command: Command = {
    name: "logs",
    description: "Configura ou desativa o Ministério do Log.",
    aliases: ["setlogs", "audit", "log"],
    
    execute: async (message: Message, args: string[]) => {
        if (!message.member?.permissions.has("Administrator")) {
            return message.reply("❌ Apenas o Grande Irmão (Administrador) pode configurar isso.");
        }

        const action = args[0]?.toLowerCase();

        // Sistema de Desligar / Ligar
        if (action === "turnoff" || action === "off") {
            await GuildConfigModel.findOneAndUpdate(
                { guildId: message.guild!.id },
                { isLoggingEnabled: false },
                { upsert: true }
            );
            return message.reply("📴 **Ministério do Log desativado!** O bot parou de registrar as ações deste servidor.");
        }

        if (action === "turnon" || action === "on") {
            const config = await GuildConfigModel.findOneAndUpdate(
                { guildId: message.guild!.id },
                { isLoggingEnabled: true },
                { new: true }
            );
            
            if (!config || !config.logChannelId) {
                return message.reply("⚠️ O sistema foi ligado, mas **nenhum canal foi configurado ainda**. Use `rp!logs #canal`.");
            }
            return message.reply(`🔛 **Ministério do Log reativado!** Voltando a registrar tudo no canal <#${config.logChannelId}>.`);
        }

        // Sistema de Setar o Canal
        const targetChannel = message.mentions.channels.first();
        if (!targetChannel || !(targetChannel instanceof TextChannel)) {
            return message.reply("⚠️ Uso correto:\n`rp!logs #canal` (Define o canal e ativa)\n`rp!logs turnoff` (Pausa os logs)\n`rp!logs turnon` (Retoma os logs)");
        }

        try {
            await GuildConfigModel.findOneAndUpdate(
                { guildId: message.guild!.id },
                { logChannelId: targetChannel.id, isLoggingEnabled: true }, // Já liga automaticamente
                { upsert: true, new: true }
            );

            return message.reply(`👁️ **Ministério do Log estabelecido e ATIVADO!**\nTodas as fofocas deste servidor agora serão enviadas para ${targetChannel}.`);
        } catch (error) {
            console.error("Erro ao salvar logs:", error);
            message.reply("❌ Erro interno ao tentar salvar no banco de dados.");
        }
    }
};