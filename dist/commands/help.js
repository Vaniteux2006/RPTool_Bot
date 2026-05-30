"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    name: 'help',
    description: 'Manual de comandos do RPTool',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('help')
        .setDescription('Mostra a lista de comandos interativa'),
    async executeSlash(interaction) {
        await this.sendHelpMenu(interaction, true);
    },
    execute(message) {
        this.sendHelpMenu(message, false);
    },
    async sendHelpMenu(target, isSlash) {
        const p = isSlash ? "/" : "rp!";
        const pages = [
            {
                title: '🛠️ Utilidades & Informações',
                description: 'Ferramentas gerais, status do servidor e utilitários.',
                fields: [
                    {
                        name: '🔍 Informações',
                        value: `**${p}serverinfo**\n` +
                            `├─ \`geral\` • Dados gerais, membros e ancião\n` +
                            `└─ \`photo\` • Envia apenas o ícone do servidor\n` +
                            `**${p}userinfo [@user]**\n` +
                            `├─ \`info\` • Ficha completa, datas e rank de entrada\n` +
                            `└─ \`photo\` • Envia a foto de perfil do usuário`
                    },
                    {
                        name: '📊 Estatísticas (Status)',
                        value: `**${p}status**\n` +
                            `├─ \`[vazio]\` • Dashboard de atividade dos últimos 15 dias\n` +
                            `├─ \`rank user\` • Top 5 usuários mais ativos (Gráfico)\n` +
                            `├─ \`rank channel\` • Top 5 canais mais ativos (Gráfico)\n` +
                            `├─ \`rank words\` • Top 15 palavras mais usadas\n` +
                            `└─ \`[@user|#canal|"OC"]\` • Gráfico específico do alvo` +
                            `**${p}ignorar**\n` +
                            `└─ \`[vazio]\` • Ignora uma palavra no rank words`
                    },
                    {
                        name: '🧮 Ferramentas de Desenvolvedor',
                        value: `**${p}math [expressão]** • Resolve equações (Wolfram Alpha)\n` +
                            `**${p}console [código]** • Roda código JS em Sandbox\n` +
                            `**${p}helloworld** • Teste de latência (Ping)\n` +
                            `**${p}version** • Versão atual e créditos da equipe`
                    }
                ]
            },
            {
                title: '🛡️ Moderação & Administração',
                description: 'Gerenciamento de usuários, chat e sistemas de entrada.',
                fields: [
                    {
                        name: '🚫 Punições & Castigos',
                        value: `**${p}ban [@user/ID] [motivo]** • Bane (dentro ou fora do server)\n` +
                            `**${p}unban [ID]** • Remove o banimento\n` +
                            `**${p}kick [@user] [motivo]** • Expulsa do servidor\n` +
                            `**${p}mute [@user] [tempo]** • Dá timeout (Ex: 10m, 1d)\n` +
                            `**${p}unmute [@user]** • Tira do castigo imediatamente`
                    },
                    {
                        name: '🧹 Gerenciamento de Chat',
                        value: `**${p}clear [1-100]** • Limpa mensagens do chat\n` +
                            `**${p}welcome**\n` +
                            `├─ \`#canal\` • Define onde caem os registros\n` +
                            `├─ \`change [msg]\` • Muda texto de entrada (Aceita {user})\n` +
                            `├─ \`change <leave|kick|ban> [msg]\` • Altera outras msgs\n` +
                            `└─ \`end\` • Desliga e reseta o sistema`
                    },
                    {
                        name: '🏷️ Cargos & Utilitários',
                        value: `**${p}reaction [ID_Msg] [@Cargo] [Emoji]** • Cargo por reação\n` +
                            `**${p}autorole**\n` +
                            `├─ \`add [@cargo]\` • Cargo automático pra novatos\n` +
                            `├─ \`del [@cargo]\` • Remove da lista\n` +
                            `└─ \`list\` • Mostra configuração atual\n` +
                            `**${p}fatos [@user] [qtd]** • Maratona de conhecimento (Admin)`
                    }
                ]
            },
            {
                title: '🎭 Personagens Originais (OCs)',
                description: 'Criação, edição e organização de Tuppers.',
                fields: [
                    {
                        name: '👤 Criação e Identidade',
                        value: `**${p}oc create ["Nome"] [prefixo:text]** • Cria um novo OC\n` +
                            `**${p}oc name ["Antigo"] ["Novo"]** • Renomeia o OC\n` +
                            `**${p}oc avatar ["Nome"] [img/link]** • Altera a foto\n` +
                            `**${p}oc prefix ["Nome"] [novo:text]** • Muda o gatilho\n` +
                            `**${p}oc birthday ["Nome"] [DD/MM]** • Define o aniversário`
                    },
                    {
                        name: '📁 Gerenciamento Geral',
                        value: `**${p}oc list** • Lista seus OCs (com botões de navegação)\n` +
                            `**${p}oc find ["Nome"]** • Ficha resumida do OC\n` +
                            `**${p}oc edit [novo texto]** • Edita a última msg enviada\n` +
                            `**${p}oc delete ["Nome"]** • Apaga um OC específico\n` +
                            `**${p}oc purge** • ⚠️ Apaga TODOS os seus OCs de uma vez\n` +
                            `**${p}oc duo/solo ["Nome"] [@user]** • Divide controle do OC`
                    },
                    {
                        name: '🗂️ Organização & Backups',
                        value: `**${p}oc group**\n` +
                            `├─ \`create ["Grupo"] ["OC"]\` • Cria grupo e já add OC\n` +
                            `├─ \`add ["Grupo"] ["OC"]\` • Põe OC no grupo\n` +
                            `├─ \`remove ["OC"]\` • Tira do grupo\n` +
                            `├─ \`delete ["Grupo"]\` • Exclui o grupo\n` +
                            `└─ \`list\` • Lista seus grupos criados\n` +
                            `**${p}oc import** • Puxa seus OCs de um JSON (Tupperbox)\n` +
                            `**${p}oc export** • Gera um JSON com todos os seus OCs`
                    },
                    {
                        name: '📖 Wiki do OC',
                        value: `**${p}oc wiki ["Nome"]** • Abre a Wiki interativa do OC\n` +
                            `├─ \`bio/intro\` • Escreve a introdução principal\n` +
                            `├─ \`add ["Tópico"]\` • Cria nova página de Lore\n` +
                            `├─ \`edit/remove ["Tópico"]\` • Edita ou apaga tópico\n` +
                            `├─ \`extra ["Chave"] ["Valor"]\` • Add info curta (Ex: Idade)\n` +
                            `├─ \`emoji ["Tópico"] [Emoji]\` • Muda ícone do menu\n` +
                            `└─ \`ref ["NomeReferência"]\` • Linka com Wiki de outro OC`
                    }
                ]
            },
            {
                title: '🤖 Inteligência Artificial (IA)',
                description: 'Motores de pensamento, NPCs e IA interpretativa.',
                fields: [
                    {
                        name: '⚙️ Configuração & Utilitários',
                        value: `**${p}token** • Painel PV pra gerenciar APIs (Gemini/OpenAI)\n` +
                            `**${p}ai [texto]** • Conversa rápida com NPC padrão\n` +
                            `**${p}resume [data]->[data]** • IA resume a história do RP\n` +
                            `**${p}resenha** • IA avalia o nível de caos/zoeira do chat`
                    },
                    {
                        name: '🧠 IA dos OCs (Persona & Ação)',
                        value: `**${p}oc ai ["Nome"]** • Define a Persona da IA do OC\n` +
                            `**${p}oc insert ["Nome"] [auto]** • IA começa a observar/falar\n` +
                            `**${p}oc delay ["Nome"] [segundos]** • Espera no modo auto\n` +
                            `**${p}oc end** • Tira o OC com IA do canal\n` +
                            `**${p}oc puppet ["Nome"]** • Desliga a IA (volta a manual)`
                    },
                    {
                        name: '💭 Memórias e Manipulação',
                        value: `**${p}oc memories ["Nome"]** • Lista memórias aprendidas\n` +
                            `**${p}oc gaslight ["Nome"]** • Implanta memória nova/falsa\n` +
                            `**${p}oc forget ["Nome"] [ID]** • Apaga memória específica\n` +
                            `**${p}oc alzheimer ["Nome"]** • Zera todas as memórias da IA`
                    }
                ]
            },
            {
                title: '🎲 Sistemas RPG & Mundo',
                description: 'Rolagem de dados, Fichas, Clima e Eventos.',
                fields: [
                    {
                        name: '📋 Fichas Universais',
                        value: `**${p}ficha**\n` +
                            `├─ \`create new\` • Cria Template com tags (|string|, |if|)\n` +
                            `├─ \`check [#canal]\` • Define canal de avaliação (Aprovar)\n` +
                            `├─ \`hall [#canal]\` • Define canal das fichas aprovadas\n` +
                            `├─ \`oc on ["Prefixo: |prefix|"]\` • Integra ficha com OCs\n` +
                            `├─ \`edit\` • Vê o template de ficha atual\n` +
                            `├─ \`end ["Nome"]\` • Deleta uma ficha específica\n` +
                            `├─ \`purge\` • Expulsa todas as fichas aprovadas\n` +
                            `└─ \`reset\` • Formata o sistema inteiro de fichas`
                    },
                    {
                        name: '🕰️ Tempo e Clima',
                        value: `**${p}time**\n` +
                            `├─ \`[#canal]\` • Cria relógio sincronizado com a vida real\n` +
                            `├─ \`set [Nome] [Data] [Hora]\` • Cria motor de tempo custom\n` +
                            `├─ \`skip [Nome] [Tempo]\` • Avança tempo do RP\n` +
                            `├─ \`delete [Nome]\` • Apaga relógio\n` +
                            `└─ \`list\` • Ver relógios ativos\n` +
                            `**${p}clima**\n` +
                            `├─ \`[Local]\` • Consulta temp real no mundo\n` +
                            `├─ \`[#canal]\` • Vê clima do relógio RP ativo\n` +
                            `├─ \`sync [Relógio] [Local]\` • Sincroniza relógio RP com IRL\n` +
                            `├─ \`force [Relógio] [Condição]\` • Muda clima na marra\n` +
                            `└─ \`def\` • Lista climas padrão do sistema`
                    },
                    {
                        name: '🎉 Eventos & Dados',
                        value: `**${p}birthday**\n` +
                            `├─ \`[#canal]\` • Instala painel automático de eventos\n` +
                            `├─ \`add [DD/MM]\` • Adiciona evento/niver (aceita em lote)\n` +
                            `└─ \`list\` • Mostra calendário completo do servidor\n` +
                            `**${p}roll [fórmula]** • Rola dados (Ex: 1d20+5, 4d6)`
                    }
                ]
            },
            {
                title: '🎮 Diversão & Social',
                description: 'Minigames e interações imersivas.',
                fields: [
                    {
                        name: '☎️ Telefone Inter-Servidores',
                        value: `**${p}phone**\n` +
                            `├─ \`register [Nome]\` • Instala a linha telefônica no canal\n` +
                            `├─ \`call [ID/Nome]\` • Disca para outro servidor\n` +
                            `├─ \`accept\` / \`decline\` • Atende/Recusa chamada recebida\n` +
                            `├─ \`end\` • Desliga a chamada ativa\n` +
                            `└─ \`off\` • Desinstala o telefone do servidor`
                    },
                    {
                        name: '♟️ Xadrez contra Stockfish',
                        value: `**${p}chess**\n` +
                            `├─ \`start\` • Inicia uma nova partida\n` +
                            `├─ \`move [lance]\` • Faz lance na partida (Ex: e4, Nf3)\n` +
                            `└─ \`fen\` • Pega o código FEN da posição atual`
                    }
                ]
            }
        ];
        let currentPage = 0;
        const generateEmbed = (pageIndex) => {
            const page = pages[pageIndex];
            return new discord_js_1.EmbedBuilder()
                .setTitle(page.title)
                .setDescription(page.description)
                .addFields(page.fields)
                .setFooter({ text: `Página ${pageIndex + 1} de ${pages.length} • Use os botões abaixo para navegar` })
                .setColor(0x0099FF);
        };
        const generateButtons = (pageIndex) => {
            return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('prev').setLabel('⬅️ Anterior').setStyle(discord_js_1.ButtonStyle.Primary).setDisabled(pageIndex === 0), new discord_js_1.ButtonBuilder().setCustomId('next').setLabel('Próximo ➡️').setStyle(discord_js_1.ButtonStyle.Primary).setDisabled(pageIndex === pages.length - 1));
        };
        const payload = { embeds: [generateEmbed(0)], components: [generateButtons(0)] };
        let sentMessage;
        if (isSlash)
            sentMessage = await target.reply({ ...payload, fetchReply: true });
        else
            sentMessage = await target.reply(payload);
        const collector = sentMessage.createMessageComponentCollector({
            componentType: discord_js_1.ComponentType.Button,
            time: 120000
        });
        collector.on('collect', async (i) => {
            const userId = isSlash ? target.user.id : target.author.id;
            if (i.user.id !== userId) {
                return i.reply({ content: "❌ Ei! Esse menu pertence a outra pessoa. Use `/help` para abrir o seu.", ephemeral: true });
            }
            if (i.customId === 'prev' && currentPage > 0)
                currentPage--;
            else if (i.customId === 'next' && currentPage < pages.length - 1)
                currentPage++;
            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
            });
        });
        collector.on('end', () => {
            const disabledRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('prev').setLabel('⬅️ Anterior').setStyle(discord_js_1.ButtonStyle.Primary).setDisabled(true), new discord_js_1.ButtonBuilder().setCustomId('next').setLabel('Próximo ➡️').setStyle(discord_js_1.ButtonStyle.Primary).setDisabled(true));
            sentMessage.edit({ components: [disabledRow] }).catch(() => { });
        });
    }
};
