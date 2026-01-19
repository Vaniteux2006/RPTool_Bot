const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const pythonManager = require('../../python_codes/python_manager.js');

// VARIÁVEL GLOBAL (CRUCIAL)
global.aiSessions = global.aiSessions || {}; 

module.exports = {
    name: 'insert',
    description: 'Controla a inserção de Tuppers IA no chat',

    // --- ESTRUTURA SLASH ---
    data: new SlashCommandBuilder()
        .setName('insert')
        .setDescription('Insere um personagem')
        // Opção 1: Inserir (Padrão)
        .addSubcommand(sub => 
            sub.setName('start')
                .setDescription('Insere um personagem no canal')
                .addStringOption(op => op.setName('nome').setDescription('Nome do Tupper').setRequired(true))
                .addBooleanOption(op => op.setName('auto').setDescription('Modo automático? (Fala sozinho)').setRequired(false)))
        // Opção 2: Memórias
        .addSubcommand(sub => 
            sub.setName('memories')
                .setDescription('Adiciona memórias ao personagem')
                .addStringOption(op => op.setName('nome').setDescription('Nome do Tupper').setRequired(true)))
        // Opção 3: Sair
        .addSubcommand(sub => 
            sub.setName('end')
                .setDescription('Remove o personagem do canal')),

    // --- ADAPTADOR SLASH ---
    async executeSlash(interaction) {
        const sub = interaction.options.getSubcommand();
        const args = [];

        if (sub === 'start') {
            args.push(interaction.options.getString('nome'));
            if (interaction.options.getBoolean('auto')) args.push('auto');
        } 
        else if (sub === 'memories') {
            args.push('memories');
            args.push(`"${interaction.options.getString('nome')}"`);
        }
        else if (sub === 'end') {
            args.push('end');
        }

        const fakeMessage = {
            author: interaction.user,
            member: interaction.member,
            guild: interaction.guild,
            channel: interaction.channel, // Importante para o createMessageCollector
            reply: async (payload) => {
                if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
                return interaction.reply(payload);
            }
        };
        
        // Simula o método .send para o canal (usado no feedback final)
        fakeMessage.channel.send = async (content) => interaction.followUp(content);

        await this.execute(fakeMessage, args);
    },

    // --- LÓGICA ORIGINAL ---
    async execute(message, args) {
        const action = args[0] ? args[0].toLowerCase() : "";

        // === 1. MEMÓRIAS ===
        if (action === 'memories') {
            const fullText = args.slice(1).join(' ');
            const match = fullText.match(/"([^"]+)"/) || [null, fullText];
            const tupperName = match[1];

            if (!tupperName) return message.reply('⚠️ Use: `rp!insert memories "Nome"`');

            const dbPath = path.join(__dirname, '../../Data/tuppers.json');
            let db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            const tupperData = db.find(t => t.name.toLowerCase() === tupperName.toLowerCase() && t.uid === message.author.id);

            if (!tupperData || !tupperData.ai_enabled) return message.reply("❌ Personagem não encontrado ou não possui IA.");

            message.reply(`🧠 **Implantando Memórias em ${tupperData.name}...**\nEscreva as memórias. Digite **Done** para salvar.`);

            const filter = m => m.author.id === message.author.id;
            const collector = message.channel.createMessageCollector({ filter, time: 300000 });
            let memoryBuffer = [];

            collector.on('collect', m => {
                if (m.content.toLowerCase() === 'done') collector.stop('finished');
                else memoryBuffer.push(m.content);
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'finished') {
                    const finalMemory = memoryBuffer.join('\n');
                    try {
                        await pythonManager.ensureConnection();
                        await fetch('http://127.0.0.1:8000/tupper/memories', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ uid: message.author.id, tupper_name: tupperData.name, memory_text: finalMemory })
                        });
                        // Tenta usar .send do canal, se não der usa .reply
                        if(message.channel.send) message.channel.send(`✅ **Memórias implantadas com sucesso!**`);
                        else message.reply(`✅ **Memórias implantadas com sucesso!**`);
                    } catch (e) { message.reply("❌ Erro ao conectar com o cérebro."); }
                }
            });
            return;
        }

        // === 2. ENCERRAR SESSÃO ===
        if (action === 'end') {
            if (global.aiSessions[message.channel.id]) {
                const nome = global.aiSessions[message.channel.id].tupperName;
                delete global.aiSessions[message.channel.id];
                return message.reply(`🛑 **${nome} saiu da conversa.** (Sessão encerrada)`);
            }
            return message.reply("?? Não tem ninguém inserido aqui.");
        }

        // === 3. INSERIR (AUTO OU MANUAL) ===
        const isAutoMode = args.includes('auto');
        const nameArgs = args.filter(a => a.toLowerCase() !== 'auto');
        const tupperName = nameArgs.join(' ');

        if (!tupperName) return message.reply("Quem você quer inserir?");

        const dbPath = path.join(__dirname, '../../Data/tuppers.json');
        let db = [];
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (err) { db = []; }

        const tupperData = db.find(t => t.name.toLowerCase() === tupperName.toLowerCase() && t.uid === message.author.id);

        if (!tupperData) return message.reply(`❌ Não achei o Tupper **"${tupperName}"**.`);
        if (!tupperData.ai_enabled) return message.reply(`⚠️ **${tupperData.name}** não tem cérebro (IA).`);

        global.aiSessions[message.channel.id] = {
            active: true,
            autoMode: isAutoMode, 
            tupperName: tupperData.name,
            avatar: tupperData.avatar,
            prefix: tupperData.prefix,
            ownerId: message.author.id,
            buffer: [] 
        };

        let msgAviso = `👁️ **${tupperData.name} está na conversa.**`;
        if (isAutoMode) {
            msgAviso += `\n🤖 **Modo Autônomo: ON.** Ele vai ler tudo e responder quando achar necessário.`;
        } else {
            msgAviso += `\nUse \`${tupperData.prefix}:ai\` para chamar.`;
        }

        message.reply(msgAviso);
    }
};