import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, Message, ChatInputCommandInteraction, Client } from 'discord.js';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(__dirname, '../Data/birthdays.json');

interface BirthdayEntry {
    name: string;
    aniversarianteId: string;
    day: number;
    month: number;
    year: number;
    requesterId: string;
    lastNotifiedYear: number;
}

interface GuildConfig {
    serverId: string;
    channelId: string;
    messageId: string | null;
    entries: BirthdayEntry[];
}

interface DB {
    [guildId: string]: GuildConfig;
}

function lerDB(): DB {
    try {
        if (!fs.existsSync(dbPath)) return {};
        const raw = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(raw);
    } catch (e) { return {}; }
}

function salvarDB(data: DB) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 4));
}

export default {
    name: 'birthday',
    description: 'Sistema de aniversários',
    
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Gerencia aniversários')
        .addSubcommand(sub => sub.setName('add').setDescription('Adiciona data').addStringOption(op => op.setName('data').setDescription('DD/MM/AAAA').setRequired(true)).addUserOption(op => op.setName('usuario').setDescription('O aniversariante')))
        .addSubcommand(sub => sub.setName('list').setDescription('Lista aniversários')),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;
        let db = lerDB();

        if (sub === 'list') {
            const config = db[guildId];
            if (!config || !config.entries.length) return interaction.reply("Nenhum aniversário registrado.");
            
            const list = config.entries.map(e => `🎂 **${e.day}/${e.month}** - ${e.name}`).join('\n');
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle("📅 Aniversariantes").setDescription(list).setColor(0xFFD700)] });
        }

        if (sub === 'add') {
            const dataStr = interaction.options.getString('data')!;
            const user = interaction.options.getUser('usuario') || interaction.user;
            
            const parts = dataStr.split('/');
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const year = parts[2] ? parseInt(parts[2]) : 0;

            if (!db[guildId]) db[guildId] = { serverId: guildId, channelId: interaction.channelId, messageId: null, entries: [] };
            
            db[guildId].entries.push({
                name: user.username,
                aniversarianteId: user.id,
                day, month, year,
                requesterId: interaction.user.id,
                lastNotifiedYear: 0
            });
            salvarDB(db);
            return interaction.reply(`🎉 Aniversário de **${user.username}** salvo para **${day}/${month}**!`);
        }
    },

    // Versão texto mantida simplificada
    async execute(message: Message, args: string[]) {
        if(args[0] === 'check') {
            // Lógica de check manual se quiser implementar
             message.reply("Use `/birthday list` para ver a lista.");
        } else {
             message.reply("Use `/birthday add` para adicionar.");
        }
    }
};