import { Message } from "discord.js";
import { Command } from "../interfaces/Command";
import { ReactionRoleModel } from "../models/ReactionRoleSchema";

export const command: Command = {
    name: "reaction",
    description: "Configura um cargo para ser dado ao reagir a uma mensagem.",
    aliases: ["reactionrole", "rr"],
    execute: async (message: Message, args: string[]) => {
        
        if (!message.member?.permissions.has("Administrator")) {
            return message.reply("❌ Apenas administradores podem configurar Reaction Roles.");
        }

        const messageId = args[0];
        const roleMention = args[1];
        const rawEmoji = args[2];

        if (!messageId || !roleMention || !rawEmoji) {
            return message.reply("⚠️ Uso: `rp!reaction <ID_da_Mensagem> <@Cargo> <Emoji>`\n*(Lembre-se de usar o comando no mesmo canal onde a mensagem está!)*");
        }

        const roleId = roleMention.replace(/[<@&>]/g, '');
        const role = message.guild?.roles.cache.get(roleId);
        
        if (!role) {
            return message.reply("❌ Cargo não encontrado. Certifique-se de marcar o cargo com `@` ou colar o ID correto.");
        }

        let emojiToStore = rawEmoji;
        const customEmojiMatch = rawEmoji.match(/<a?:.+:(\d+)>/);
        if (customEmojiMatch) {
            emojiToStore = customEmojiMatch[1]; 
        }

        try {
            const targetMessage = await message.channel.messages.fetch(messageId);
            
            await targetMessage.react(rawEmoji).catch(() => {
                throw new Error("Não consegui reagir. O emoji é válido e eu tenho acesso a ele?");
            });
            await ReactionRoleModel.create({
                guildId: message.guild!.id,
                channelId: message.channel.id,
                messageId: targetMessage.id,
                emoji: emojiToStore,
                roleId: role.id
            });

            return message.reply(`✅ **Reaction Role Configurado!**\nQuem reagir com ${rawEmoji} na mensagem vai ganhar o cargo **${role.name}**.`);

        } catch (e: any) {
            return message.reply(`❌ Erro: Mensagem não encontrada neste canal ou emoji inválido.\nDetalhes: \`${e.message}\``);
        }
    }
};