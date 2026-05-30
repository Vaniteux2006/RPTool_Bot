// RPTool/commands/welcome.ts
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    Message,
    PermissionFlagsBits,
    GuildMember,
    PartialGuildMember,
    AuditLogEvent,
    EmbedBuilder,
} from 'discord.js';
import { WelcomeModel } from '../tools/models/Outros';
import { getAverageColor } from 'fast-average-color-node';
import { EventCheckout } from '../tools/event_checkout';

const welcome = {
    name: 'welcome',
    description: 'Configura o painel de boas-vindas e moderação',
    aliases: ['boasvindas', 'setwelcome', 'registro'],

    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Configura o sistema de boas-vindas do servidor')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        await interaction.reply({ content: 'Use o comando de texto `rp!welcome` para essa versão avançada!', ephemeral: true });
    },

    async execute(message: Message | any, args: string[]) {
        if (!message.member?.permissions.has(PermissionFlagsBits.Administrator))
            return message.reply('❌ Apenas administradores podem configurar a recepção.');

        let action = args[0]?.toLowerCase();
        const guildId = message.guild.id;

        if (action?.startsWith('<#') && action.endsWith('>')) {
            args.unshift('canal');
            action = 'canal';
        }

        let config = await WelcomeModel.findOne({ guildId });
        if (!config) config = new WelcomeModel({ guildId });

        if (action === 'canal') {
            const targetChannel = message.mentions?.channels?.first();
            if (!targetChannel) return message.reply('❌ Mencione o canal! Ex: `rp!welcome #geral`');
            config.channelId = targetChannel.id;
            await config.save();
            return message.reply(`✅ Canal de registros definido para <#${targetChannel.id}>!`);
        }

        if (action === 'end') {
            await WelcomeModel.deleteOne({ guildId });
            return message.reply('🛑 Sistema de registros e boas-vindas totalmente apagado e desligado.');
        }

        if (action === 'change') {
            const type = args[1]?.toLowerCase();
            const validTypes = ['join', 'leave', 'kick', 'ban'];
            let targetType = 'join';
            let startIndex = 1;
            if (validTypes.includes(type)) { targetType = type; startIndex = 2; }
            const newMsg = args.slice(startIndex).join(' ').replace(/^["']|["']$/g, '');
            if (!newMsg) return message.reply('❌ Escreva a mensagem! Ex: `rp!welcome change "Bem-vindo {user}!"`');
            if (targetType === 'join')  config.joinMsg  = newMsg;
            if (targetType === 'leave') config.leaveMsg = newMsg;
            if (targetType === 'kick')  config.kickMsg  = newMsg;
            if (targetType === 'ban')   config.banMsg   = newMsg;
            await config.save();
            return message.reply(`✅ Mensagem de **${targetType}** atualizada com sucesso!`);
        }

        return message.reply(
            '👋 **Painel de Registros:**\n\n' +
            '`rp!welcome #canal` — define onde enviar\n' +
            '`rp!welcome change "msg"` — altera a msg de entrada\n' +
            '`rp!welcome change <leave/kick/ban> "msg"` — altera as outras msgs\n' +
            '`rp!welcome end` — desliga tudo e reseta\n\n' +
            '*Variáveis aceitas: `{user}`, `{server}`, `{count}`*',
        );
    },
};

// ─── Auto-inscrição no EventCheckout ─────────────────────────────────────────

// Boas-vindas na entrada
EventCheckout.onGuildMemberAdd('welcome:join', async (member: GuildMember) => {
    try {
        const config = await WelcomeModel.findOne({ guildId: member.guild.id });
        if (!config?.channelId) return;
        const channel = member.guild.channels.cache.get(config.channelId);
        if (!channel?.isTextBased()) return;

        const msg = config.joinMsg
            .replace(/{user}/g,   `<@${member.id}>`)
            .replace(/{server}/g, member.guild.name)
            .replace(/{count}/g,  String(member.guild.memberCount));

        let color = 0x5865F2;
        try {
            const avg = await getAverageColor(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
            color = parseInt(avg.hex.replace('#', ''), 16);
        } catch (_) {}

        const embed = new EmbedBuilder()
            .setColor(color)
            .setDescription(msg)
            .setThumbnail(member.user.displayAvatarURL());

        await (channel as any).send({ embeds: [embed] });
    } catch (e) {
        console.error('❌ [welcome] join falhou:', e);
    }
});

// Mensagem de saída / kick / ban
EventCheckout.onGuildMemberRemove('welcome:leave', async (member: GuildMember | PartialGuildMember) => {
    try {
        const config = await WelcomeModel.findOne({ guildId: member.guild.id });
        if (!config?.channelId) return;
        const channel = member.guild.channels.cache.get(config.channelId);
        if (!channel?.isTextBased()) return;

        const banLogs  = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd  }).catch(() => null);
        const kickLogs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick    }).catch(() => null);
        const banEntry  = banLogs?.entries.first();
        const kickEntry = kickLogs?.entries.first();

        const isBan  = !!(banEntry  && banEntry.target?.id  === member.id && Date.now() - banEntry.createdTimestamp  < 5000);
        const isKick = !isBan && !!(kickEntry && kickEntry.target?.id === member.id && Date.now() - kickEntry.createdTimestamp < 5000);

        let rawMsg = config.leaveMsg ?? '{user} saiu do servidor.';
        let color  = 0x1A2B4C;
        if (isBan)  { rawMsg = config.banMsg  ?? '{user} foi banido.'; color = 0xFF0000; }
        if (isKick) { rawMsg = config.kickMsg ?? '{user} foi expulso.'; color = 0xFF6600; }

        const msg = rawMsg
            .replace(/{user}/g,   member.user?.tag ?? `<@${member.id}>`)
            .replace(/{server}/g, member.guild.name)
            .replace(/{count}/g,  String(member.guild.memberCount));

        const embed = new EmbedBuilder()
            .setColor(color)
            .setDescription(msg)
            .setThumbnail(member.user?.displayAvatarURL() ?? null);

        await (channel as any).send({ embeds: [embed] });
    } catch (e) {
        console.error('❌ [welcome] leave falhou:', e);
    }
});

export default welcome;
