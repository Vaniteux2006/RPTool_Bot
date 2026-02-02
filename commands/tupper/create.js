const fs = require('fs');
const path = require('path');
const { 
    EmbedBuilder, 
    SlashCommandBuilder, 
    Collection, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    AttachmentBuilder
} = require('discord.js'); 
const pythonManager = require('../../python_codes/python_manager.js');
const https = require('https');

module.exports = {
    name: 'create',
    description: 'Gerencia seus personagens (Tuppers)',

    data: new SlashCommandBuilder()
        .setName('create')
        .setDescription('Gerencia seus personagens')
        .addSubcommand(sub => sub.setName('new').setDescription('Cria um novo personagem').addStringOption(op => op.setName('nome').setDescription('Nome').setRequired(true)).addStringOption(op => op.setName('prefixo').setDescription('Prefixo (Ex: luke:)').setRequired(true)).addAttachmentOption(op => op.setName('avatar').setDescription('Foto de perfil').setRequired(false)))
        .addSubcommand(sub => sub.setName('import').setDescription('Importa um arquivo do Tupperbox (.json)').addAttachmentOption(op => op.setName('arquivo').setDescription('O arquivo .json exportado').setRequired(true)))
        .addSubcommand(sub => sub.setName('export').setDescription('Baixa um backup dos seus personagens'))
        .addSubcommand(sub => sub.setName('list').setDescription('Lista todos os seus personagens'))
        .addSubcommand(sub => sub.setName('delete').setDescription('Apaga um personagem (ou digite "all" para apagar tudo)').addStringOption(op => op.setName('nome').setDescription('Nome exato ou "all"').setRequired(true)))
        .addSubcommand(sub => sub.setName('avatar').setDescription('Muda a foto do personagem').addStringOption(op => op.setName('nome').setDescription('Nome do personagem').setRequired(true)).addAttachmentOption(op => op.setName('imagem').setDescription('Nova foto').setRequired(true)))
        .addSubcommand(sub => sub.setName('rename').setDescription('Muda o nome do personagem').addStringOption(op => op.setName('antigo').setDescription('Nome atual').setRequired(true)).addStringOption(op => op.setName('novo').setDescription('Novo nome').setRequired(true)))
        .addSubcommand(sub => sub.setName('prefix').setDescription('Muda o prefixo do personagem').addStringOption(op => op.setName('nome').setDescription('Nome do personagem').setRequired(true)).addStringOption(op => op.setName('novo_prefixo').setDescription('Novo prefixo').setRequired(true)))
        .addSubcommand(sub => sub.setName('ai').setDescription('Cria um personagem com Inteligência Artificial').addStringOption(op => op.setName('nome').setDescription('Nome').setRequired(true)).addStringOption(op => op.setName('prefixo').setDescription('Prefixo').setRequired(true))),

    async executeSlash(interaction) {
        // CORREÇÃO CRÍTICA: Deferir imediatamente
        await interaction.deferReply();

        const sub = interaction.options.getSubcommand();
        const args = [];
        let attachments = new Collection();

        switch (sub) {
            case 'import':
                args.push('import');
                const file = interaction.options.getAttachment('arquivo');
                if (file) attachments.set(file.id, file);
                break;
            case 'export':
                args.push('export');
                break;
            case 'list':
                args.push('list');
                break;
            case 'new':
                args.push(`"${interaction.options.getString('nome')}"`);
                args.push(interaction.options.getString('prefixo'));
                const avatar = interaction.options.getAttachment('avatar');
                if (avatar) attachments.set(avatar.id, avatar);
                break;
            case 'delete':
                args.push('delete');
                args.push(`"${interaction.options.getString('nome')}"`);
                break;
            case 'avatar':
                args.push('avatar');
                args.push(`"${interaction.options.getString('nome')}"`);
                const img = interaction.options.getAttachment('imagem');
                if (img) attachments.set(img.id, img);
                break;
            case 'rename':
                args.push('name');
                args.push(`"${interaction.options.getString('antigo')}"`);
                args.push(`"${interaction.options.getString('novo')}"`);
                break;
            case 'prefix':
                args.push('prefix');
                args.push(`"${interaction.options.getString('nome')}"`);
                args.push(interaction.options.getString('novo_prefixo'));
                break;
            case 'ai':
                args.push('ai');
                args.push(`"${interaction.options.getString('nome')}"`);
                args.push(interaction.options.getString('prefixo'));
                break;
        }

        const fakeMessage = {
            content: `rp!create ${args.join(' ')}`,
            author: interaction.user,
            member: interaction.member,
            guild: interaction.guild,
            channel: interaction.channel,
            attachments: attachments,
            // CORREÇÃO: Usar editReply porque já deferimos
            reply: async (payload) => interaction.editReply(payload)
        };
        fakeMessage.channel.createMessageCollector = (options) => interaction.channel.createMessageCollector(options);
        fakeMessage.channel.createMessageComponentCollector = (options) => interaction.channel.createMessageComponentCollector(options);
        fakeMessage.channel.send = async (content) => interaction.followUp(content);

        await this.execute(fakeMessage, args);
    },

    async execute(message, args) {
        const subCommand = args[0] ? args[0].toLowerCase() : "";

        if (subCommand === 'import') {
            const attachment = message.attachments.first();
            if (!attachment || !attachment.name.endsWith('.json')) {
                return message.reply("⚠️ Por favor, anexe o arquivo `.json` exportado do Tupperbox.");
            }

            https.get(attachment.url, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const importedData = JSON.parse(data);
                        const tuppersList = importedData.tuppers || (Array.isArray(importedData) ? importedData : []);
                        
                        if (tuppersList.length === 0) return message.reply("❌ Não achei nenhum personagem nesse arquivo.");

                        const dbPath = path.join(__dirname, '../../Data/tuppers.json');
                        let db = [];
                        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}

                        let count = 0;
                        tuppersList.forEach(t => {
                            const exists = db.find(local => local.uid === message.author.id && local.name.toLowerCase() === t.name.toLowerCase());
                            if (!exists) {
                                db.push({
                                    uid: message.author.id,
                                    name: t.name,
                                    brackets: t.brackets || [t.name + ":", ""],
                                    avatar: t.avatar_url || t.avatar,
                                    posts: t.posts || 0,
                                    description: t.description || null,
                                    ai_enabled: false
                                });
                                count++;
                            }
                        });

                        fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));
                        message.reply(`✅ **Importação concluída!** ${count} novos personagens adicionados.`);
                    } catch (err) {
                        message.reply("❌ Erro ao ler o arquivo JSON.");
                    }
                });
            }).on('error', () => message.reply("❌ Erro ao baixar o arquivo."));
            return;
        }

        if (subCommand === 'export') {
            const dbPath = path.join(__dirname, '../../Data/tuppers.json');
            let db = [];
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) { db = []; }

            const userTuppers = db.filter(t => t.uid === message.author.id);
            if (userTuppers.length === 0) return message.reply("📂 Você não tem personagens para exportar.");

            const exportData = {
                tuppers: userTuppers.map(t => ({
                    name: t.name,
                    brackets: t.brackets,
                    avatar_url: t.avatar,
                    posts: t.posts || 0,
                    description: t.description || null
                })),
                groups: []
            };

            const buffer = Buffer.from(JSON.stringify(exportData, null, 4), 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: 'tuppers_backup.json' });

            if (message.channel.send) message.channel.send({ content: "📦 **Aqui está o backup dos seus personagens:**", files: [attachment] });
            else message.reply({ content: "📦 **Aqui está o backup dos seus personagens:**", files: [attachment] });
            return;
        }

        if (subCommand === 'list') {
            const dbPath = path.join(__dirname, '../../Data/tuppers.json');
            let db = [];
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) { db = []; }

            const userTuppers = db.filter(t => t.uid === message.author.id);

            if (userTuppers.length === 0) return message.reply("📂 Você não tem nenhum personagem criado.");

            const ITEMS_PER_PAGE = 10;
            let currentPage = 0;
            const totalPages = Math.ceil(userTuppers.length / ITEMS_PER_PAGE);

            const generateEmbed = (page) => {
                const start = page * ITEMS_PER_PAGE;
                const end = start + ITEMS_PER_PAGE;
                const currentItems = userTuppers.slice(start, end);

                const embed = new EmbedBuilder()
                    .setTitle(`📂 Seus Personagens (${userTuppers.length})`)
                    .setColor(0x00AE86)
                    .setFooter({ text: `Página ${page + 1} de ${totalPages} • Use rp!create delete "Nome" para apagar` });

                let description = currentItems.map(t => {
                    let gatilho = t.brackets ? `${t.brackets[0]}texto${t.brackets[1]}` : (t.prefix ? `${t.prefix}: texto` : "???");
                    const iaTag = t.ai_enabled ? "🤖 [IA]" : "";
                    return `**${t.name}** ${iaTag}\n└ Gatilho: \`${gatilho}\` • Posts: ${t.posts || 0}`;
                }).join('\n\n');

                embed.setDescription(description);
                return embed;
            };

            const getButtons = (page) => {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('prev').setLabel('⬅️ Anterior').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
                    new ButtonBuilder().setCustomId('next').setLabel('Próximo ➡️').setStyle(ButtonStyle.Primary).setDisabled(page === totalPages - 1)
                );
                return row;
            };

            const replyOptions = { embeds: [generateEmbed(0)], components: totalPages > 1 ? [getButtons(0)] : [] };
            let sentMessage;
            if (message.channel.send) sentMessage = await message.channel.send(replyOptions);
            else sentMessage = await message.reply(replyOptions);

            if (totalPages <= 1) return;

            const collector = sentMessage.createMessageComponentCollector({ 
                filter: i => i.user.id === message.author.id, 
                time: 60000 
            });

            collector.on('collect', async i => {
                if (i.customId === 'prev') currentPage--;
                else if (i.customId === 'next') currentPage++;

                await i.update({ embeds: [generateEmbed(currentPage)], components: [getButtons(currentPage)] });
            });

            collector.on('end', () => {
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('prev').setLabel('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId('next').setLabel('➡️').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );
                try { sentMessage.edit({ components: [disabledRow] }); } catch(e){}
            });
            return;
        }

        if (subCommand === 'delete') {
            const fullText = args.slice(1).join(' ');
            const match = fullText.match(/"([^"]+)"/) || [null, fullText]; 
            let nameToDelete = match[1];
            
            if (!nameToDelete && fullText.toLowerCase() === 'all') nameToDelete = 'all';
            if (!nameToDelete) return message.reply('⚠️ Use: `rp!create delete "Nome"` ou `rp!create delete all`');

            const dbPath = path.join(__dirname, '../../Data/tuppers.json');
            let db = [];
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}

            if (nameToDelete.toLowerCase() === 'all' || nameToDelete.toLowerCase() === 'tudo') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_wipe').setLabel('SIM, APAGAR TUDO').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('cancel_wipe').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
                );

                const embedWarning = new EmbedBuilder()
                    .setTitle("⚠️ ZONA DE PERIGO ⚠️")
                    .setDescription(`Você está prestes a deletar **TODOS** os seus personagens.\nIsso é **IRREVERSÍVEL**.\n\nTenha certeza de ter feito \`rp!create export\` antes de continuar.`)
                    .setColor(0xFF0000);

                let sentMsg;
                if(message.channel.send) sentMsg = await message.channel.send({ embeds: [embedWarning], components: [row] });
                else sentMsg = await message.reply({ embeds: [embedWarning], components: [row] });

                const collector = sentMsg.createMessageComponentCollector({ 
                    filter: i => i.user.id === message.author.id, 
                    time: 15000, 
                    max: 1 
                });

                collector.on('collect', async i => {
                    if (i.customId === 'confirm_wipe') {
                        const newDb = db.filter(t => t.uid !== message.author.id);
                        fs.writeFileSync(dbPath, JSON.stringify(newDb, null, 4));
                        await i.update({ content: "💥 **Todos os seus personagens foram deletados.**", embeds: [], components: [] });
                    } else {
                        await i.update({ content: "😮 Ufa... Operação cancelada.", embeds: [], components: [] });
                    }
                });
                return;
            }

            const initialLength = db.length;
            db = db.filter(t => !(t.name.toLowerCase() === nameToDelete.toLowerCase() && t.uid === message.author.id));

            if (db.length === initialLength) {
                return message.reply(`❌ Não encontrei o personagem **"${nameToDelete}"** na sua lista.`);
            }

            fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));
            return message.reply(`🗑️ **${nameToDelete}** foi deletado.`);
        }
        
        if (subCommand === 'avatar') {
            if (message.attachments.size === 0) return message.reply("⚠️ Você precisa anexar uma imagem!");
            const fullText = args.slice(1).join(' ');
            const match = fullText.match(/"([^"]+)"/) || [null, fullText];
            const nameToEdit = match[1];
            if (!nameToEdit) return message.reply('⚠️ Use: `rp!create avatar "Nome"` (e mande a foto)');

            const dbPath = path.join(__dirname, '../../Data/tuppers.json');
            let db = [];
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}

            const index = db.findIndex(t => t.name.toLowerCase() === nameToEdit.toLowerCase() && t.uid === message.author.id);

            if (index === -1) return message.reply(`❌ Não encontrei **"${nameToEdit}"**.`);

            db[index].avatar = message.attachments.first().url;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));
            return message.reply(`🖼️ Avatar atualizado!`);
        }

        if (subCommand === 'name' || subCommand === 'rename') {
            const fullText = args.slice(1).join(' ');
            const match = fullText.match(/"([^"]+)"\s+"([^"]+)"/);
            if (!match) return message.reply('⚠️ Use: `rp!create name "Nome Antigo" "Nome Novo"`');

            const oldName = match[1];
            const newName = match[2];
            const dbPath = path.join(__dirname, '../../Data/tuppers.json');
            let db = [];
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}

            const index = db.findIndex(t => t.name.toLowerCase() === oldName.toLowerCase() && t.uid === message.author.id);
            if (index === -1) return message.reply(`❌ Não encontrei **"${oldName}"**.`);

            db[index].name = newName;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));
            return message.reply(`📝 **${oldName}** agora se chama **${newName}**!`);
        }

        if (subCommand === 'prefix') {
            const fullText = args.slice(1).join(' ');
            const match = fullText.match(/"([^"]+)"\s+(\S+)/);
            if (!match) return message.reply('⚠️ Use: `rp!create prefix "Nome" novo_prefixo`');

            const charName = match[1];
            const newPrefix = match[2];
            const dbPath = path.join(__dirname, '../../Data/tuppers.json');
            let db = [];
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}

            const index = db.findIndex(t => t.name.toLowerCase() === charName.toLowerCase() && t.uid === message.author.id);
            if (index === -1) return message.reply(`❌ Não encontrei **"${charName}"**.`);

            db[index].brackets = [newPrefix, ""];
            delete db[index].prefix;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));
            return message.reply(`🔄 Prefixo de **${charName}** alterado para \`${newPrefix}\`.`);
        }

        if (args[0] && args[0].toLowerCase() === 'ai') {
            return this.createAI(message, args.slice(1));
        }

        const resultado = this.saveTupper(message, args.join(' '));
        if (resultado && resultado.nome) {
            const msg = `✅ **${resultado.nome}** criado!\nUso: \`${resultado.brackets[0]} msg ${resultado.brackets[1]}\``;
            if (message.channel.send) message.channel.send(msg); else message.reply(msg);
        }
    },

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
            brackets: [prefixo, ""],
            avatar: avatarUrl,
            ai_enabled: isAI,
            posts: 0,
            description: null
        };

        const dbPath = path.join(__dirname, '../../Data/tuppers.json');
        let db = [];
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (err) { db = []; }

        const nomeExiste = db.find(t => t.uid === message.author.id && t.name.toLowerCase() === nome.toLowerCase());
        if (nomeExiste) { message.reply(`❌ Já existe um **"${nome}"**!`); return null; }

        db.push(novoTupper);
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));
        return { nome, brackets: novoTupper.brackets };
    },

    async createAI(message, args) {
        const fullText = args.join(' ');
        if (!/"([^"]+)"\s+(\S+)/.test(fullText)) return message.reply('⚠️ Formato: `rp!create ai "Nome" prefixo`');

        const saved = this.saveTupper(message, fullText, true); 
        if (!saved) return;
        const name = saved.nome;

        message.reply(`🤖 **${name} criado!**\nDescreva a personalidade e digite **Done**.`);
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
                if (message.channel.send) message.channel.send("⚙️ **Conectando cérebro...**");
                try {
                    await pythonManager.ensureConnection();
                    await fetch('http://127.0.0.1:8000/tupper/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uid: message.author.id, tupper_name: name, persona: finalPersona })
                    });
                    const msg = `✅ **IA Ativa!**\nUse \`rp!insert start "${name}"\` para ligar no modo Manual.\nUse \`rp!insert start "${name}" auto\` para modo Automático.`;
                    if (message.channel.send) message.channel.send(msg);
                } catch (e) { message.reply("❌ Erro na IA."); }
            }
        });
    }
};