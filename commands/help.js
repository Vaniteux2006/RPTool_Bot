const { 
    EmbedBuilder, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType 
} = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Manual de comandos do RPTool',

    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Mostra a lista de comandos interativa'),

    async executeSlash(interaction) {
        await this.sendHelpMenu(interaction, true);
    },

    execute(message) {
        this.sendHelpMenu(message, false);
        console.log("Registrado comando de Ajuda");
    },

    async sendHelpMenu(target, isSlash) {
        const p = isSlash ? "/" : "rp!";
        
        // --- DEFINIÇÃO DAS PÁGINAS COM HIERARQUIA ---
        const pages = [
            {
                title: '🛠️ Utilidades & Info',
                description: 'Ferramentas gerais e informações do servidor.',
                fields: [
                    { 
                        name: '🎂 Aniversários (Birthday)', 
                        value: `**${p}birthday**\n` +
                               `├─ \`add [user] [data]\` • Adiciona niver (Ex: 15/09)\n` +
                               `├─ \`check\` • Vê lista de aniversariantes\n` +
                               `└─ \`reset\` • Reseta o sistema (Admin)` 
                    },
                    { 
                        name: '📥 Downloader (DL)', 
                        value: `**${p}dl [link]**\n` +
                               `└─ Baixa vídeos (TikTok, Insta, YT).` 
                    },
                    {
                        name: '📊 Informações',
                        value: `**${p}serverinfo** • Dados do Servidor e Ícone\n` +
                               `**${p}userinfo [user]** • Ficha do Usuário\n` +
                               `**${p}status** • Dashboard de atividade`
                    },
                    {
                        name: '🧮 Outros',
                        value: `**${p}math [conta]** • Calculadora (Ex: 2+2*4)\n` +
                               `**${p}version** • Versão do Bot\n` +
                               `**${p}helloworld** • Ping`
                    }
                ]
            },
            {
                title: '🛡️ Administração',
                description: 'Comandos de moderação e configuração.',
                fields: [
                    { 
                        name: '🚫 Punições', 
                        value: `**${p}ban [user] [motivo]** • Banir usuário\n` +
                               `**${p}kick [user] [motivo]** • Expulsar usuário\n` +
                               `**${p}unban [id]** • Desbanir pelo ID`
                    },
                    { 
                        name: '🤫 Castigos (Mute)', 
                        value: `**${p}mute [user] [tempo]**\n` +
                               `└─ Silencia temporariamente. (Ex: 10m, 2h, 1d)\n` +
                               `**${p}unmute [user]**\n` +
                               `└─ Remove o castigo imediatamente.` 
                    },
                    { 
                        name: '🏷️ Cargos Automáticos (Autorole)', 
                        value: `**${p}autorole**\n` +
                               `├─ \`add [cargo]\` • Define cargo de entrada\n` +
                               `├─ \`del [cargo]\` • Remove da configuração\n` +
                               `└─ \`check\` • Vê configuração atual` 
                    }
                ]
            },
            {
                title: '🎭 Tuppers & IA',
                description: 'Criação de personagens e Inteligência Artificial.',
                fields: [
                    { 
                        name: '📝 Gerenciar Personagens (Create)', 
                        value: `**${p}create**\n` +
                               `├─ \`new "Nome" [prefix]\` • Cria personagem simples\n` +
                               `├─ \`ai "Nome" [prefix]\` • Cria personagem com IA\n` +
                               `├─ \`avatar "Nome" [img]\` • Muda a foto\n` +
                               `├─ \`list\` • Lista seus personagens\n` +
                               `├─ \`export\` • Baixa backup (JSON)\n` +
                               `└─ \`delete "Nome"\` • Apaga um personagem` 
                    },
                    { 
                        name: '📥 Inserir no Chat (Insert)', 
                        value: `**${p}insert**\n` +
                               `├─ \`start "Nome"\` • Invoca personagem\n` +
                               `├─ \`start "Nome" auto\` • Modo automático (IA)\n` +
                               `├─ \`delay [segundos]\` • Tempo de resposta IA\n` +
                               `├─ \`memories "Nome"\` • Adiciona memórias\n` +
                               `└─ \`end\` • Remove personagem do chat` 
                    },
                    {
                        name: '🤖 Conversa Rápida',
                        value: `**${p}ai [texto]** • Fala com o Bot padrão`
                    }
                ]
            },
            {
                title: '🎲 Diversão & Social',
                description: 'Jogos e interações entre servidores.',
                fields: [
                    { 
                        name: '☎️ Telefone (Phone)', 
                        value: `**${p}phone**\n` +
                               `├─ \`call [ID]\` • Liga para outro server\n` +
                               `├─ \`register\` • Instala o telefone no canal\n` +
                               `├─ \`accept\` • Atende chamada\n` +
                               `└─ \`end\` • Desliga chamada` 
                    },
                    { 
                        name: '♟️ Xadrez (Chess)', 
                        value: `**${p}chess**\n` +
                               `├─ \`start [cor]\` • Inicia jogo vs Stockfish\n` +
                               `├─ \`jogar [lance]\` • Faz movimento (Ex: e4)\n` +
                               `└─ \`solve [fen]\` • Analisa posição` 
                    },
                    { 
                        name: '🎲 Dados & Quotes', 
                        value: `**${p}roll [fórmula]**\n` +
                               `└─ Rola dados (Ex: 2d20+5)\n` +
                               `**Quote (Citação)**\n` +
                               `└─ Responda msg com: \`@RPTool anota\`` 
                    },
                    { 
                        name: '👀 Averiguador de Resenha', 
                        value: `**${p}resenha**\n` +
                               `└─ averigua possível resenha 👁️` 
                    }
                ]
            }
        ];

        let currentPage = 0;

        const generateEmbed = (index) => {
            const page = pages[index];
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`📚 Manual do RPTool`)
                .setDescription(`**Categoria:** ${page.title}\n${page.description}`)
                .setFooter({ text: `Página ${index + 1}/${pages.length} • Use as setas para navegar` });

            page.fields.forEach(field => {
                embed.addFields({ name: field.name, value: field.value, inline: false });
            });

            return embed;
        };

        const generateButtons = (index) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(index === 0),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(index === pages.length - 1)
            );
        };

        const payload = { embeds: [generateEmbed(0)], components: [generateButtons(0)] };
        let sentMessage;

        if (isSlash) sentMessage = await target.reply({ ...payload, fetchReply: true });
        else sentMessage = await target.reply(payload);

        const collector = sentMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 120000 
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== (isSlash ? target.user.id : target.author.id)) {
                return i.reply({ content: "❌ Use seu próprio `/help`!", ephemeral: true });
            }

            if (i.customId === 'prev' && currentPage > 0) currentPage--;
            else if (i.customId === 'next' && currentPage < pages.length - 1) currentPage++;

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
            });
        });

        collector.on('end', async () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev').setLabel('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('next').setLabel('➡️').setStyle(ButtonStyle.Secondary).setDisabled(true)
            );
            try {
                if (isSlash) await target.editReply({ components: [disabledRow] });
                else await sentMessage.edit({ components: [disabledRow] });
            } catch (e) {}
        });
    }
};