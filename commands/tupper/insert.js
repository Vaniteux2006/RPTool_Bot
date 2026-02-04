const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const pythonManager = require('../../python_codes/python_manager.js');

global.aiSessions = global.aiSessions || {}; 

module.exports = {
    name: 'insert',
    description: 'Controla a inserção de Tuppers IA no chat',

    data: new SlashCommandBuilder()
        .setName('insert')
        .setDescription('Insere um personagem')
        .addSubcommand(sub => 
            sub.setName('auto')
                .setDescription('Insere um personagem já no modo Automático')
                .addStringOption(op => op.setName('nome').setDescription('Nome do Tupper').setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('start')
                .setDescription('Insere um personagem no canal')
                .addStringOption(op => op.setName('nome').setDescription('Nome do Tupper').setRequired(true))
                .addBooleanOption(op => op.setName('auto').setDescription('Modo automático?').setRequired(false)))
        .addSubcommand(sub => 
            sub.setName('memories')
                .setDescription('Adiciona memórias ao personagem')
                .addStringOption(op => op.setName('nome').setDescription('Nome do Tupper').setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('delay')
                .setDescription('Altera o tempo de resposta do modo automático')
                .addIntegerOption(op => op.setName('segundos').setDescription('Tempo em segundos (Min: 10s)').setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('end')
                .setDescription('Remove o personagem do canal')),

    async executeSlash(interaction) {
        // CORREÇÃO CRÍTICA
        await interaction.deferReply();

        const sub = interaction.options.getSubcommand();
        const args = [];
        
        if (sub === 'start') {
            args.push(interaction.options.getString('nome'));
            if (interaction.options.getBoolean('auto')) args.push('auto');
        } else if (sub === 'memories') {
            args.push('memories');
            args.push(`"${interaction.options.getString('nome')}"`);
        } else if (sub === 'delay') {
            args.push('delay');
            args.push(interaction.options.getInteger('segundos').toString());
        } else if (sub === 'end') {
            args.push('end');
        }

        const fakeMessage = {
            author: interaction.user,
            member: interaction.member,
            guild: interaction.guild,
            channel: interaction.channel, 
            client: interaction.client,
            // CORREÇÃO: Mapear reply para editReply
            reply: async (payload) => interaction.editReply(payload)
        };
        // CORREÇÃO: Mapear send para followUp
        fakeMessage.channel.send = async (content) => interaction.followUp(content);

        await this.execute(fakeMessage, args);
    },

    async execute(message, args) {
        const action = args[0] ? args[0].toLowerCase() : "";

        if (action === 'memories') {
            const fullText = args.slice(1).join(' ');
            const match = fullText.match(/"([^"]+)"/) || [null, fullText];
            const tupperName = match[1];

            if (!tupperName) return message.reply('⚠️ Use: `rp!insert memories "Nome"`');

            const dbPath = path.join(__dirname, '../../Data/tuppers.json');
            let db = [];
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) { db = []; }
            
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
                        if(message.channel.send) message.channel.send(`✅ **Memórias implantadas com sucesso!**`);
                        else message.reply(`✅ **Memórias implantadas com sucesso!**`);
                    } catch (e) { message.reply("❌ Erro ao conectar com o cérebro."); }
                }
            });
            return;
        }

        if (action === 'delay') {
            const session = global.aiSessions[message.channel.id];
            
            if (!session || !session.active) {
                return message.reply("⚠️ Não tem nenhum Tupper ativo neste canal agora.");
            }

            const newDelay = parseInt(args[1]);
            
            if (isNaN(newDelay) || newDelay < 10) {
                return message.reply("⚠️ **Segurança:** O tempo mínimo é de **10 segundos** para não sobrecarregar a API.");
            }

            session.intervalTime = newDelay * 1000;

            if (session.autoMode) {
                this.startAutoLoop(message.channel.id);
            }

            return message.reply(`⏱️ **Ritmo alterado!** ${session.tupperName} vai responder a cada **${newDelay} segundos**.`);
        }

        if (action === 'end') {
            if (global.aiSessions[message.channel.id]) {
                const session = global.aiSessions[message.channel.id];
                if (session.timer) clearInterval(session.timer);
                
                const nome = session.tupperName;
                delete global.aiSessions[message.channel.id];
                return message.reply(`🛑 **${nome} saiu da conversa.** (Sessão encerrada)`);
            }
            return message.reply("?? Não tem ninguém inserido aqui.");
        }
        
        const isAutoMode = args.includes('auto');
        const nameArgs = args.filter(a => a.toLowerCase() !== 'auto' && a.toLowerCase() !== 'start');
        const tupperName = nameArgs.join(' ');

        if (!tupperName) return message.reply("❌ ERRO: Quem você quer inserir?");

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
            prefix: tupperData.brackets ? tupperData.brackets[0] : (tupperData.prefix || "??"),
            uid: message.author.id,
            buffer: [],
            lastActivity: Date.now(),
            channelObj: message.channel,
            clientObj: message.client || message.guild.client,
            timer: null,
            intervalTime: 60000 
        };

        console.log(`✅ [INSERT] Sessão INICIADA: ${tupperData.name} (Auto: ${isAutoMode})`);

        let msgAviso = `👁️ **${tupperData.name} está na conversa.**`;
        
        if (isAutoMode) {
            msgAviso += `\n🤖 **Modo Autônomo: ON.**\n⏳ Loop padrão de **60s**. Use \`/insert delay\` para alterar.`;
            this.startAutoLoop(message.channel.id);
            
            // Saudação Inicial
            setTimeout(async () => {
                const session = global.aiSessions[message.channel.id];
                if(!session) return;
                const fakeContext = ["[SISTEMA]: Você acabou de ser invocado no chat. Cumprimente os presentes."];
                try {
                    if (session.channelObj.sendTyping) session.channelObj.sendTyping();
                    await pythonManager.ensureConnection();
                    const response = await fetch('http://127.0.0.1:8000/tupper/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uid: session.uid, tupper_name: session.tupperName, context: fakeContext })
                    });
                    const data = await response.json();
                    if (data.reply) this.sendWebhookMessage(session, data.reply);
                } catch(e) { console.error("Erro na saudação:", e); }
            }, 2000); 

        } else {
            const p = global.aiSessions[message.channel.id].prefix;
            msgAviso += `\n✍️ **Modo Manual.**\nUse \`${p}:ai sua mensagem\` para ele responder imediatamente.`; 
        }

        if (message.channel.send) message.channel.send(msgAviso);
        else message.reply(msgAviso);
    },

    startAutoLoop(channelId) {
        const session = global.aiSessions[channelId];
        if (!session) return;
        if (session.timer) clearInterval(session.timer);

        const TEMPO_INATIVIDADE = 5 * 60 * 1000;
        const currentTime = session.intervalTime || 60000;

        console.log(`🔄 [INSERT] Loop iniciado para ${session.tupperName} (${currentTime}ms)`);

        const loop = setInterval(async () => {
            const currentSession = global.aiSessions[channelId];
            if (!currentSession) { clearInterval(loop); return; }

            if (Date.now() - currentSession.lastActivity > TEMPO_INATIVIDADE) {
                if (currentSession.channelObj.send) currentSession.channelObj.send(`💤 **${currentSession.tupperName}** dormiu. (Auto-OFF)`);
                clearInterval(loop);
                delete global.aiSessions[channelId];
                return;
            }

            if (currentSession.buffer.length === 0) return; 

            const contextToSend = [...currentSession.buffer];
            currentSession.buffer = [];

            try {
                if (currentSession.channelObj.sendTyping) await currentSession.channelObj.sendTyping();
                await pythonManager.ensureConnection();
                
                console.log(`📡 [AUTO] Enviando contexto para IA... (${contextToSend.length} msgs)`);

                const response = await fetch('http://127.0.0.1:8000/tupper/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uid: currentSession.uid, tupper_name: currentSession.tupperName, context: contextToSend })
                });
                const data = await response.json();

                if (data.reply) {
                    console.log(`💬 [AUTO] Resposta gerada: "${data.reply.substring(0, 20)}..."`);
                    this.sendWebhookMessage(currentSession, data.reply);
                }
            } catch (error) { console.error("Erro no Auto Loop:", error); }

        }, currentTime); 

        session.timer = loop;
    },

    async sendWebhookMessage(session, content) {
        try {
            const webhooks = await session.channelObj.fetchWebhooks();
            let webhook = webhooks.find(w => w.owner.id === session.clientObj.user.id);
            if (!webhook) {
                webhook = await session.channelObj.createWebhook({ name: 'RPTool Proxy', avatar: session.clientObj.user.displayAvatarURL() });
            }
            await webhook.send({ content: content, username: session.tupperName, avatarURL: session.avatar });
        } catch (webhookError) {
            console.error("Erro no Webhook:", webhookError);
            if (session.channelObj.send) session.channelObj.send(`**${session.tupperName}**: ${content}`);
        }
    }
};