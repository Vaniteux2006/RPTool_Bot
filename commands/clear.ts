import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    Message, 
    ChatInputCommandInteraction, 
    TextChannel,
    ChannelType
} from 'discord.js';

export default {
    name: 'clear',
    aliases: ['limpar', 'purge'],
    description: 'Apaga uma quantidade específica de mensagens.',
    
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Apaga mensagens do chat (Max 100)')
        .addIntegerOption(option => 
            option.setName('quantidade')
                .setDescription('Quantas mensagens apagar')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages), 

    async execute(message: Message, args: string[]) {
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply("❌ Você precisa da permissão **Gerenciar Mensagens** para usar isso.");
        }

        const channel = message.channel as TextChannel;
        if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
             return message.reply("❌ Não posso limpar mensagens neste tipo de canal.");
        }

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply("❌ Por favor, forneça um número entre **1** e **100**.\nExemplo: `rp!clear 5`");
        }

        try {
            await message.delete().catch(() => {}); 

            const deleted = await channel.bulkDelete(amount, true);

            const msg = await channel.send(`🧹 **Limpeza concluída!** Apaguei ${deleted.size} mensagens.`);
            
            setTimeout(() => {
                msg.delete().catch(() => {});
            }, 5000);

        } catch (error) {
            console.error(error);
            message.reply("❌ Ocorreu um erro. Lembre-se que não posso apagar mensagens com mais de 14 dias.");
        }
    },

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const amount = interaction.options.getInteger('quantidade', true);
        const channel = interaction.channel as TextChannel;

        if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
            return interaction.reply({ content: '❌ Comando inválido neste canal.', ephemeral: true });
        }

        try {
            const deleted = await channel.bulkDelete(amount, true);
            
            await interaction.reply({ 
                content: `🧹 **Sucesso!** Apaguei ${deleted.size} mensagens neste canal.`, 
                ephemeral: true 
            });

        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: '❌ Erro ao apagar. Mensagens com mais de 14 dias não podem ser apagadas em massa pelo Discord.', 
                ephemeral: true 
            });
        }
    }
};