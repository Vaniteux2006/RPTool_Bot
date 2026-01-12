const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const pythonManager = require('../../python_codes/python_manager.js');

module.exports = {
    name: 'create',
    description: 'Cria um novo Tupper (Personagem)',
    async execute(message, args) {
        
        // Se for IA, desvia para a função especial
        if (args[0] && args[0].toLowerCase() === 'ai') {
            return this.createAI(message, args.slice(1));
        }

        // --- MODO NORMAL ---
        this.saveTupper(message, args.join(' '));
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