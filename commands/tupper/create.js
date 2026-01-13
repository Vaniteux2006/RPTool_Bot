const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const pythonManager = require('../../python_codes/python_manager.js');

module.exports = {
    name: 'create',
    description: 'Cria um novo Tupper (Personagem)',
    async execute(message, args) {

        const subCommand = args[0] ? args[0].toLowerCase() : "";

        // === 1. DELETAR TUPPER ===
        // rp!create delete "Nome"
        if (subCommand === 'delete') {
            const fullText = args.slice(1).join(' ');
            const match = fullText.match(/"([^"]+)"/) || [null, fullText]; // Tenta pegar entre aspas ou tudo
            const nameToDelete = match[1];

            if (!nameToDelete) return message.reply('⚠️ Use: `rp!create delete "Nome do Personagem"`');

            const dbPath = path.join(__dirname, '../../Data/tuppers.json');
            let db = [];
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}

            const initialLength = db.length;
            // Filtra removendo o que tem o nome E o ID do usuário
            db = db.filter(t => !(t.name.toLowerCase() === nameToDelete.toLowerCase() && t.uid === message.author.id));

            if (db.length === initialLength) {
                return message.reply(`❌ Não encontrei o personagem **"${nameToDelete}"** na sua lista.`);
            }

            fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));
            return message.reply(`🗑️ **${nameToDelete}** foi deletado para sempre.`);
        }
        
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

            // Atualiza a foto
            db[index].avatar = message.attachments.first().url;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));

            return message.reply(`🖼️ Avatar de **${db[index].name}** atualizado com sucesso!`);
        }

        if (subCommand === 'name' || subCommand === 'rename') {
            // Regex para pegar dois nomes entre aspas: "Velho" "Novo"
            const match = fullText.match(/"([^"]+)"\s+"([^"]+)"/);
            
            if (!match) return message.reply('⚠️ Formato inválido!\nUse: `rp!create name "Nome Antigo" "Nome Novo"`');

            const oldName = match[1];
            const newName = match[2];

            const dbPath = path.join(__dirname, '../../Data/tuppers.json');
            let db = [];
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}

            const index = db.findIndex(t => t.name.toLowerCase() === oldName.toLowerCase() && t.uid === message.author.id);

            if (index === -1) return message.reply(`❌ Não encontrei o personagem **"${oldName}"**.`);

            // Verifica se o NOVO nome já existe
            if (db.some(t => t.uid === message.author.id && t.name.toLowerCase() === newName.toLowerCase())) {
                return message.reply(`❌ Você já tem um personagem chamado **"${newName}"**!`);
            }

            db[index].name = newName;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));

            return message.reply(`📝 **${oldName}** agora se chama **${newName}**!`);
        }

        if (subCommand === 'prefix') {
            // Regex: "Nome" prefixo
            const match = fullText.match(/"([^"]+)"\s+(\S+)/);

            if (!match) return message.reply('⚠️ Formato inválido!\nUse: `rp!create prefix "Nome do Char" novo_prefixo`');

            const charName = match[1];
            const newPrefix = match[2];

            const dbPath = path.join(__dirname, '../../Data/tuppers.json');
            let db = [];
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}

            const index = db.findIndex(t => t.name.toLowerCase() === charName.toLowerCase() && t.uid === message.author.id);

            if (index === -1) return message.reply(`❌ Não encontrei o personagem **"${charName}"**.`);

            // Verifica se o NOVO prefixo já existe
            if (db.some(t => t.uid === message.author.id && t.prefix === newPrefix)) {
                return message.reply(`❌ Você já tem um personagem com o prefixo **"${newPrefix}"**!`);
            }

            const oldPrefix = db[index].prefix;
            db[index].prefix = newPrefix;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));

            return message.reply(`🔄 Prefixo de **${charName}** alterado de \`${oldPrefix}\` para \`${newPrefix}\`.`);
        }

        // Se for IA, desvia para a função especial
        if (args[0] && args[0].toLowerCase() === 'ai') {
            return this.createAI(message, args.slice(1));
        }

        // --- MODO NORMAL ---
        if (args[0] && args[0].toLowerCase() === 'ai') {
            return this.createAI(message, args.slice(1));
        }

        // --- MODO NORMAL ---
        // 1. Tenta salvar e pega o resultado
        const resultado = this.saveTupper(message, args.join(' '));

        // 2. Se salvou com sucesso (não retornou erro/null), manda o aviso
        if (resultado && resultado.nome) {
            message.channel.send(`✅ **${resultado.nome}** criado com sucesso!\nPara usar, digite: \`${resultado.prefixo}: sua mensagem\``);
        }
    },

    // Separei a lógica de salvar pra reutilizar
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
            ai_enabled: isAI // Marcamos se é IA ou não
        };

        // CORREÇÃO DE CAMINHO: Sobe duas pastas (../../)
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

    async createAI(message, args) {
        // 1. Salva o Tupper fisicamente primeiro
        const fullText = args.join(' ');
        
        // Verifica formato antes de começar o ritual
        if (!/"([^"]+)"\s+(\S+)/.test(fullText)) {
             return message.reply('⚠️ Formato: `rp!create ai "Nome" prefixo`');
        }

        const saved = this.saveTupper(message, fullText, true); // Salva no JSON
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
                await message.reply("⚙️ **Configurando cérebro da IA...**");
                
                try {
                    await pythonManager.ensureConnection();
                    await fetch('http://127.0.0.1:8000/tupper/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uid: userId, tupper_name: name, persona: finalPersona })
                    });
                    message.channel.send(`✅ **Cérebro conectado!**\nUse \`rp!insert ${name}\` nesse canal para começar a conversar.`);
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