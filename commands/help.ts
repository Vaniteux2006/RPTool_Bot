import { 
    EmbedBuilder, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType,
    Message,
    ChatInputCommandInteraction,
    ButtonInteraction
} from 'discord.js';

export default {
    name: 'help',
    description: 'Manual de comandos do RPTool',

    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Mostra a lista de comandos interativa'),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        await this.sendHelpMenu(interaction, true);
    },

    execute(message: Message) {
        this.sendHelpMenu(message, false);
    },

    async sendHelpMenu(target: Message | ChatInputCommandInteraction, isSlash: boolean) {
        const p = isSlash ? "/" : "rp!";
        
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

        const generateEmbed = (pageIndex: number) => {
            const page = pages[pageIndex];
            return new EmbedBuilder()
                .setTitle(page.title)
                .setDescription(page.description)
                .addFields(page.fields)
                .setFooter({ text: `Página ${pageIndex + 1} de ${pages.length}` })
                .setColor(0x0099FF);
        };

        const generateButtons = (pageIndex: number) => {
            return new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('prev').setLabel('⬅️').setStyle(ButtonStyle.Primary).setDisabled(pageIndex === 0),
                new ButtonBuilder().setCustomId('next').setLabel('➡️').setStyle(ButtonStyle.Primary).setDisabled(pageIndex === pages.length - 1)
            );
        };

        const payload = { embeds: [generateEmbed(0)], components: [generateButtons(0)] };
        let sentMessage;
        
        if (isSlash) sentMessage = await (target as ChatInputCommandInteraction).reply({ ...payload, fetchReply: true });
        else sentMessage = await (target as Message).reply(payload);

        const collector = sentMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 120000 
        });

        collector.on('collect', async (i: ButtonInteraction) => {
            const userId = isSlash ? (target as ChatInputCommandInteraction).user.id : (target as Message).author.id;
            if (i.user.id !== userId) {
                return i.reply({ content: "❌ Use seu próprio `/help`!", ephemeral: true });
            }

            if (i.customId === 'prev' && currentPage > 0) currentPage--;
            else if (i.customId === 'next' && currentPage < pages.length - 1) currentPage++;

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
            });
        });
    }
};