const fs = require('fs');
const path = require('path');
const { EmbedBuilder, SlashCommandBuilder, Collection } = require('discord.js'); // Importei Collection
const pythonManager = require('../../python_codes/python_manager.js');

module.exports = {
    name: 'create',
    description: 'Gerencia seus personagens (Tuppers)',

    // --- ESTRUTURA SLASH ---
    data: new SlashCommandBuilder()
        .setName('create')
        .setDescription('Gerencia seus personagens')
        // 1. Criar
        .addSubcommand(sub => 
            sub.setName('new')
                .setDescription('Cria um novo personagem')
                .addStringOption(op => op.setName('nome').setDescription('Nome').setRequired(true))
                .addStringOption(op => op.setName('prefixo').setDescription('Prefixo (Ex: luke:)').setRequired(true))
                .addAttachmentOption(op => op.setName('avatar').setDescription('Foto de perfil').setRequired(false)))
        // 2. Deletar
        .addSubcommand(sub => 
            sub.setName('delete')
                .setDescription('Apaga um personagem')
                .addStringOption(op => op.setName('nome').setDescription('Nome exato').setRequired(true)))
        // 3. Avatar (Editar)
        .addSubcommand(sub => 
            sub.setName('avatar')
                .setDescription('Muda a foto do personagem')
                .addStringOption(op => op.setName('nome').setDescription('Nome do personagem').setRequired(true))
                .addAttachmentOption(op => op.setName('imagem').setDescription('Nova foto').setRequired(true)))
        // 4. Renomear
        .addSubcommand(sub => 
            sub.setName('rename')
                .setDescription('Muda o nome do personagem')
                .addStringOption(op => op.setName('antigo').setDescription('Nome atual').setRequired(true))
                .addStringOption(op => op.setName('novo').setDescription('Novo nome').setRequired(true)))
        // 5. Prefixo (Editar)
        .addSubcommand(sub => 
            sub.setName('prefix')
                .setDescription('Muda o prefixo do personagem')
                .addStringOption(op => op.setName('nome').setDescription('Nome do personagem').setRequired(true))
                .addStringOption(op => op.setName('novo_prefixo').setDescription('Novo prefixo').setRequired(true)))
        // 6. Criar IA
        .addSubcommand(sub => 
            sub.setName('ai')
                .setDescription('Cria um personagem com Inteligência Artificial')
                .addStringOption(op => op.setName('nome').setDescription('Nome').setRequired(true))
                .addStringOption(op => op.setName('prefixo').setDescription('Prefixo').setRequired(true))),

    // --- ADAPTADOR SLASH ---
    async executeSlash(interaction) {
        const sub = interaction.options.getSubcommand();
        const args = [];
        // Cria uma Collection igual a do Discord.js para enganar o código antigo
        let attachments = new Collection();

        if (sub === 'new') {
            args.push(`"${interaction.options.getString('nome')}"`);
            args.push(interaction.options.getString('prefixo'));
            const avatar = interaction.options.getAttachment('avatar');
            if (avatar) attachments.set(avatar.id, avatar);
        }
        else if (sub === 'delete') {
            args.push('delete');
            args.push(`"${interaction.options.getString('nome')}"`);
        }
        else if (sub === 'avatar') {
            args.push('avatar');
            args.push(`"${interaction.options.getString('nome')}"`);
            const img = interaction.options.getAttachment('imagem');
            if (img) attachments.set(img.id, img);
        }
        else if (sub === 'rename') {
            args.push('name');
            args.push(`"${interaction.options.getString('antigo')}"`);
            args.push(`"${interaction.options.getString('novo')}"`);
        }
        else if (sub === 'prefix') {
            args.push('prefix');
            args.push(`"${interaction.options.getString('nome')}"`);
            args.push(interaction.options.getString('novo_prefixo'));
        }
        else if (sub === 'ai') {
            args.push('ai');
            args.push(`"${interaction.options.getString('nome')}"`);
            args.push(interaction.options.getString('prefixo'));
        }

        // Fake Message
        const fakeMessage = {
            content: `rp!create ${args.join(' ')}`,
            author: interaction.user,
            member: interaction.member,
            guild: interaction.guild,
            channel: interaction.channel,
            attachments: attachments, // Passamos a Collection aqui
            reply: async (payload) => {
                if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
                return interaction.reply(payload);
            }
        };
        
        // Adaptação para o Collector
        fakeMessage.channel.createMessageCollector = (options) => interaction.channel.createMessageCollector(options);
        fakeMessage.channel.send = async (content) => interaction.followUp(content);

        await this.execute(fakeMessage, args);
    },

    // --- LÓGICA ORIGINAL ---
    async execute(message, args) {

        const subCommand = args[0] ? args[0].toLowerCase() : "";

        // === 1. DELETAR TUPPER ===
        if (subCommand === 'delete') {
            const fullText = args.slice(1).join(' ');
            const match = fullText.match(/"([^"]+)"/) || [null, fullText]; 
            const nameToDelete = match[1];

            if (!nameToDelete) return message.reply('⚠️ Use: `rp!create delete "Nome do Personagem"`');

            const dbPath = path.join(__dirname, '../../Data/tuppers.json');
            let db = [];
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}

            const initialLength = db.length;
            db = db.filter(t => !(t.name.toLowerCase() === nameToDelete.toLowerCase() && t.uid === message.author.id));

            if (db.length === initialLength) {
                return message.reply(`❌ Não encontrei o personagem **"${nameToDelete}"** na sua lista.`);
            }

            fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));
            return message.reply(`🗑️ **${nameToDelete}** foi deletado para sempre.`);
        }
        
        // === 2. AVATAR ===
        if (subCommand === 'avatar') {
            if (message.attachments.size === 0) {
                return message.reply("⚠️ Você precisa anexar uma imagem junto com o comando!");
            }

            const fullText = args.slice(1).join(' ');
            const match = fullText.match(/"([^"]+)"/) || [null, fullText];
            const nameToEdit = match[1];

            if (!nameToEdit) return message.reply('⚠️ Use: `rp!create avatar "Nome"` (e mande a foto junto)');

            const dbPath = path.join(__dirname, '../../Data/tuppers.json');
            let db = [];
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}

            const index = db.findIndex(t => t.name.toLowerCase() === nameToEdit.toLowerCase() && t.uid === message.author.id);

            if (index === -1) {
                return message.reply(`❌ Não encontrei **"${nameToEdit}"**.`);
            }

            db[index].avatar = message.attachments.first().url;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));

            return message.reply(`🖼️ Avatar de **${db[index].name}** atualizado com sucesso!`);
        }

        // === 3. RENOMEAR ===
        if (subCommand === 'name' || subCommand === 'rename') {
            const fullText = args.slice(1).join(' ');
            const match = fullText.match(/"([^"]+)"\s+"([^"]+)"/);
            
            if (!match) return message.reply('⚠️ Formato inválido!\nUse: `rp!create name "Nome Antigo" "Nome Novo"`');

            const oldName = match[1];
            const newName = match[2];

            const dbPath = path.join(__dirname, '../../Data/tuppers.json');
            let db = [];
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}

            const index = db.findIndex(t => t.name.toLowerCase() === oldName.toLowerCase() && t.uid === message.author.id);

            if (index === -1) return message.reply(`❌ Não encontrei o personagem **"${oldName}"**.`);

            if (db.some(t => t.uid === message.author.id && t.name.toLowerCase() === newName.toLowerCase())) {
                return message.reply(`❌ Você já tem um personagem chamado **"${newName}"**!`);
            }

            db[index].name = newName;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));

            return message.reply(`📝 **${oldName}** agora se chama **${newName}**!`);
        }

        // === 4. PREFIXO ===
        if (subCommand === 'prefix') {
            const fullText = args.slice(1).join(' ');
            const match = fullText.match(/"([^"]+)"\s+(\S+)/);

            if (!match) return message.reply('⚠️ Formato inválido!\nUse: `rp!create prefix "Nome do Char" novo_prefixo`');

            const charName = match[1];
            const newPrefix = match[2];

            const dbPath = path.join(__dirname, '../../Data/tuppers.json');
            let db = [];
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}

            const index = db.findIndex(t => t.name.toLowerCase() === charName.toLowerCase() && t.uid === message.author.id);

            if (index === -1) return message.reply(`❌ Não encontrei o personagem **"${charName}"**.`);

            if (db.some(t => t.uid === message.author.id && t.prefix === newPrefix)) {
                return message.reply(`❌ Você já tem um personagem com o prefixo **"${newPrefix}"**!`);
            }

            const oldPrefix = db[index].prefix;
            db[index].prefix = newPrefix;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));

            return message.reply(`🔄 Prefixo de **${charName}** alterado de \`${oldPrefix}\` para \`${newPrefix}\`.`);
        }

        // === 5. IA (Redireciona) ===
        if (args[0] && args[0].toLowerCase() === 'ai') {
            return this.createAI(message, args.slice(1));
        }

        // === 6. CRIAR NOVO (PADRÃO) ===
        const resultado = this.saveTupper(message, args.join(' '));

        if (resultado && resultado.nome) {
            if (message.channel.send) message.channel.send(`✅ **${resultado.nome}** criado com sucesso!\nPara usar, digite: \`${resultado.prefixo}: sua mensagem\``);
            else message.reply(`✅ **${resultado.nome}** criado com sucesso!\nPara usar, digite: \`${resultado.prefixo}: sua mensagem\``);
        }
    },

    // FUNÇÃO AUXILIAR: SALVAR JSON
    saveTupper(message, fullText, isAI = false) {
        const regex = /"([^"]+)"\s+(\S+)/;
        const match = fullText.match(regex);

        if (!match) return message.reply('⚠️ Formato inválido!\nUse: `rp!create "Nome" prefixo`');

        const nome = match[1];
        const prefixo = match[2];
        
        let avatarUrl = message.author.displayAvatarURL();
        if (message.attachments.size > 0) avatarUrl = message.attachments.first().url;

        const novoTupper = {
            uid: message.author.id,
            name: nome,
            prefix: prefixo,
            avatar: avatarUrl,
            ai_enabled: isAI 
        };

        const dbPath = path.join(__dirname, '../../Data/tuppers.json');
        let db = [];
        try {
            db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        } catch (err) { db = []; }

        const nomeExiste = db.find(t => t.uid === message.author.id && t.name.toLowerCase() === nome.toLowerCase());
        if (nomeExiste) {
            message.reply(`❌ Você já tem um personagem chamado **"${nome}"**!`);
            return null;
        }

        const prefixoExiste = db.find(t => t.uid === message.author.id && t.prefix === prefixo);
        if (prefixoExiste) {
            message.reply(`❌ Você já tem um personagem com o prefixo **"${prefixo}"**!`);
            return null;
        }

        db.push(novoTupper);
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));

        return { nome, prefixo };
    },

    // FUNÇÃO ESPECIAL: CRIAR COM IA (COM COLLECTOR)
    async createAI(message, args) {
        const fullText = args.join(' ');
        
        if (!/"([^"]+)"\s+(\S+)/.test(fullText)) {
             return message.reply('⚠️ Formato: `rp!create ai "Nome" prefixo`');
        }

        const saved = this.saveTupper(message, fullText, true); 
        if (!saved) return;

        const userId = message.author.id;
        const name = saved.nome;

        message.reply(`🤖 **${name} criado! Agora vamos dar vida a ele.**\nDescreva a personalidade (Persona) em várias mensagens.\nDigite **Done** para terminar.`);

        const filter = m => m.author.id === message.author.id;
        const collector = message.channel.createMessageCollector({ filter, time: 300000 });

        let personaBuffer = [];

        collector.on('collect', m => {
            if (m.content.toLowerCase() === 'done') collector.stop('finished');
            else personaBuffer.push(m.content);
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'finished') {
                const finalPersona = personaBuffer.join('\n');
                // Feedback
                const loadingMsg = await (message.channel.send ? message.channel.send("⚙️ **Configurando cérebro da IA...**") : message.reply("⚙️ **Configurando cérebro da IA...**"));
                
                try {
                    await pythonManager.ensureConnection();
                    await fetch('http://127.0.0.1:8000/tupper/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uid: userId, tupper_name: name, persona: finalPersona })
                    });
                    
                    const successText = `✅ **Cérebro conectado!**\nUse \`rp!insert ${name}\` nesse canal para começar a conversar.`;
                    if (message.channel.send) message.channel.send(successText);
                    else message.reply(successText);

                } catch (e) {
                    console.error(e);
                    message.reply("❌ O Tupper foi criado, mas a IA falhou ao conectar.");
                }
            } else {
                message.reply("❌ Tempo esgotado.");
            }
        });
    }
};