import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    Message, 
    TextChannel, 
    ChannelType,
    Client
} from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURAÇÃO E TIPOS ---
const DATA_PATH = path.join(__dirname, '../Data/time.json');

interface ClockData {
    channelId: string;
    messageId: string; // Precisamos disso para editar a msg antiga em vez de criar nova
    utcInput: string;  // O que o usuário digitou (Brasilia, UTC=-4, etc)
    lastDate: string;  // Data da última atualização
    isFictional: boolean; // Para uso futuro
}

const TIMEZONES: { [key: string]: string } = {
    'brasilia': 'America/Sao_Paulo',
    'br': 'America/Sao_Paulo',
    'sp': 'America/Sao_Paulo',
    'utc': 'UTC',
    'gmt': 'UTC',
    'lisboa': 'Europe/Lisbon',
    'tokyo': 'Asia/Tokyo',
    'ny': 'America/New_York'
};

// Cache para não ligar o mesmo relógio 2x na mesma sessão
const activeIntervals = new Set<string>();

export default {
    name: 'time',
    description: 'Relógio persistente (Salva em Data/time.json)',
    
    data: new SlashCommandBuilder()
        .setName('time')
        .setDescription('Cria um relógio persistente')
        .addChannelOption(op => op.setName('canal').setDescription('Canal').addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption(op => op.setName('zona').setDescription('Fuso (Brasilia, UTC=1, etc)').setRequired(false)),

    // --- EXECUÇÃO (CRIAR NOVO RELÓGIO) ---

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const channel = interaction.options.getChannel('canal') as TextChannel;
        const zonaInput = interaction.options.getString('zona') || 'Brasilia';
        
        if (!channel.isTextBased()) return interaction.reply({ content: "❌ Canal inválido.", ephemeral: true });
        await interaction.deferReply({ ephemeral: true });

        try {
            // 1. Cria a mensagem inicial
            const msg = await channel.send("⏳ Iniciando relógio...");
            
            // 2. Salva no JSON
            this.saveClockToJSON(channel.id, msg.id, zonaInput);

            // 3. Liga o processo
            await this.startClock(channel, msg, zonaInput);

            await interaction.editReply(`✅ Relógio salvo e iniciado em ${channel}!`);
        } catch (e) {
            console.error(e);
            await interaction.editReply("❌ Erro ao criar relógio.");
        }
    },

    async execute(message: Message, args: string[]) {
        if (args.length < 1) return message.reply("⚠️ Uso: `rp!time #chat Brasilia`");
        
        const channelId = args[0].replace(/[<#>]/g, ''); 
        const channel = message.guild?.channels.cache.get(channelId) as TextChannel;
        if (!channel) return message.reply("❌ Canal inválido.");
        
        const zonaInput = args[1] || 'Brasilia';

        try {
            const msg = await channel.send("⏳ Iniciando relógio...");
            this.saveClockToJSON(channel.id, msg.id, zonaInput);
            await this.startClock(channel, msg, zonaInput);
            
            message.reply(`✅ Relógio persistente criado em ${channel}.`);
        } catch (e) {
            console.error(e);
            message.reply("❌ Erro.");
        }
    },

    // --- FUNÇÕES DE CONTROLE (SISTEMA) ---

    // Função chamada pelo command_checkout.ts
    async checkAndRestoreClocks(client: Client) {
        // Lê o arquivo JSON
        let clocks: ClockData[] = [];
        try {
            if (fs.existsSync(DATA_PATH)) {
                const raw = fs.readFileSync(DATA_PATH, 'utf-8');
                clocks = JSON.parse(raw);
            }
        } catch (e) { console.error("Erro ao ler time.json", e); return; }

        // Itera sobre os relógios salvos
        for (const clock of clocks) {
            // Se já estiver rodando na memória, ignora
            if (activeIntervals.has(clock.channelId)) continue;

            // Se for fictício (futuro), ignoramos por enquanto conforme pedido
            if (clock.isFictional) continue;

            try {
                const channel = await client.channels.fetch(clock.channelId) as TextChannel;
                if (!channel) continue;

                // Tenta buscar a mensagem antiga para editar
                let msg: Message | undefined;
                try {
                    msg = await channel.messages.fetch(clock.messageId);
                } catch {
                    // Se a mensagem foi deletada, talvez devêssemos apagar do JSON? 
                    // Por enquanto vamos ignorar/logar
                    console.log(`Mensagem de relógio ${clock.messageId} não encontrada.`);
                    continue;
                }

                if (msg) {
                    console.log(`🔄 Restaurando relógio no canal: ${channel.name}`);
                    this.startClock(channel, msg, clock.utcInput);
                }

            } catch (error) {
                console.error(`Falha ao restaurar relógio ${clock.channelId}`, error);
            }
        }
    },

    saveClockToJSON(channelId: string, messageId: string, utcInput: string) {
        let clocks: ClockData[] = [];
        try {
            if (fs.existsSync(DATA_PATH)) {
                clocks = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
            }
        } catch (e) {}

        // Remove duplicatas do mesmo canal (substitui o antigo)
        clocks = clocks.filter(c => c.channelId !== channelId);

        clocks.push({
            channelId,
            messageId,
            utcInput,
            lastDate: new Date().toISOString(),
            isFictional: false
        });

        // Garante que a pasta existe
        const dir = path.dirname(DATA_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(DATA_PATH, JSON.stringify(clocks, null, 2));
    },

    // A Lógica visual (igual a anterior, mas agora recebe a msg pronta)
    async startClock(channel: TextChannel, message: Message, rawZone: string) {
        // Marca como ativo na memória
        activeIntervals.add(channel.id);

        const resolveTimeZone = (input: string) => {
            const offsetRegex = /^(?:UTC|GMT)\s*=?\s*([+-]?\d+(?:\.\d+)?)$/i;
            const match = input.match(offsetRegex);
            if (match) return { type: 'offset', value: parseFloat(match[1]) };
            const key = input.toLowerCase();
            return { type: 'iana', value: TIMEZONES[key] || input };
        };

        const zoneData = resolveTimeZone(rawZone);

        const getClockString = () => {
            const now = new Date();
            let dateToFormat: Date;
            let timeZoneForIntl: string;

            if (zoneData.type === 'offset') {
                const offsetHours = zoneData.value as number;
                const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000); 
                const shiftedTime = utcNow + (offsetHours * 3600000); 
                dateToFormat = new Date(shiftedTime);
                timeZoneForIntl = 'UTC'; 
            } else {
                dateToFormat = now;
                timeZoneForIntl = zoneData.value as string;
            }

            const hourString = new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: timeZoneForIntl }).format(dateToFormat);
            const currentHour = parseInt(hourString);

            let emoji = '🌑'; 
            if (currentHour >= 0 && currentHour < 5) emoji = ':new_moon:';
            else if (currentHour >= 5 && currentHour < 7) emoji = ':sunrise:';
            else if (currentHour >= 7 && currentHour < 10) emoji = ':sunny:';
            else if (currentHour >= 10 && currentHour < 15) emoji = ':fire:';
            else if (currentHour >= 15 && currentHour < 18) emoji = ':city_sunset:';
            else if (currentHour >= 18 && currentHour < 21) emoji = ':city_dusk:';
            else if (currentHour >= 21) emoji = ':crescent_moon:';

            const options: Intl.DateTimeFormatOptions = { timeZone: timeZoneForIntl };
            const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

            const hora = new Intl.DateTimeFormat('pt-BR', { ...options, hour: '2-digit', minute: '2-digit' }).format(dateToFormat);
            const dataExtenso = new Intl.DateTimeFormat('pt-BR', { ...options, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(dateToFormat);
            const dataCurta = new Intl.DateTimeFormat('pt-BR', { ...options, day: '2-digit', month: '2-digit', year: 'numeric' }).format(dateToFormat);

            return `# [ **${hora}** ] ${emoji}\n## [ **${capitalize(dataExtenso)}** ]\n-# (${dataCurta})`;
        };

        // Atualiza a primeira vez imediatamente
        const content = getClockString();
        if (message.content !== content) await message.edit(content).catch(() => {});

        // Loop
        setInterval(() => {
            const newContent = getClockString();
            if (message.content !== newContent) {
                message.edit(newContent).catch(err => {
                    console.log(`Relógio em ${channel.name} parou (msg deletada?). Removendo da memória.`);
                    activeIntervals.delete(channel.id);
                    // Opcional: Remover do JSON também se quiser
                });
            }
        }, 60000); 
    }
};