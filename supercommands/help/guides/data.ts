// RPTool/supercommands/help/guides/data.ts
// ─── Conteúdo dos guias visuais do rp!help ────────────────────────────────────
// Um guia por categoria (id = id da categoria no registry) e guias próprios para
// comandos grandes (id = id da entrada). Depois de editar, regere os PNGs:
//   npx ts-node --transpile-only supercommands/help/guides/render.ts [id ...]
import type { Guide } from './template';

export const GUIDES: Guide[] = [
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'utilidades',
        title: 'Utilidades do', command: 'rp!', emoji: '🛠️',
        subtitle: 'Informações do servidor, mídia, buscas e organização — tudo sem sair do Discord.',
        tip: 'Atividade e gráficos do servidor? **rp!help status** tem guia próprio.',
        columns: [
            {
                title: 'Informações', who: 'qualquer pessoa', accent: 'green',
                steps: [
                    { cmd: 'rp!**serverinfo** geral', what: 'Dados do servidor, membros e o **membro mais antigo**. Com `photo`, só o ícone.' },
                    { cmd: 'rp!**userinfo** @pessoa info', what: 'Ficha completa, datas e rank de entrada. Com `photo`, manda o avatar.' },
                    { cmd: 'rp!**helloworld**', what: 'Testa se o bot está vivo (ping).' },
                    { cmd: 'rp!**version**', what: 'Versão atual e créditos da equipe.' },
                ],
            },
            {
                title: 'Mídia & buscas', who: 'qualquer pessoa', accent: 'blue',
                steps: [
                    { cmd: 'rp!**download** https://tiktok.com/…', what: 'Baixa vídeo/imagem/áudio (TikTok, X, YouTube, Reddit…) e **anexa no canal**.' },
                    { cmd: 'rp!**img** gato de chapéu', what: 'Busca imagens na web; navegue pelos resultados com os botões.' },
                    { cmd: 'rp!**math** x^2 - 5x + 6 = 0', what: 'Resolve equações e contas pelo Wolfram Alpha.' },
                    { cmd: 'rp!**console** 0.1 + 0.2', what: 'Roda JavaScript isolado e mostra o valor. Aceita bloco de código com várias linhas.' },
                ],
            },
            {
                title: 'Organização', who: 'tarefas do servidor', accent: 'gold',
                steps: [
                    { cmd: 'rp!**kanban add** TODO Arrumar o mapa', what: 'Cria uma tarefa na coluna **TODO**, **DOING** ou **DONE**.' },
                    { cmd: 'rp!**kanban move** 3 DOING', what: 'Move a tarefa pelo ID. `del 3` apaga.' },
                    { cmd: 'rp!**kanban show** #tarefas', what: 'Painel fixo que se **atualiza sozinho**. `ver` mostra o quadro aqui.' },
                    { cmd: 'rp!**ignorar add** kkkk', what: '(ADM) Tira a palavra do ranking de palavras do `rp!status`.' },
                ],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'status',
        title: 'Como usar o', command: 'rp!status', emoji: '📊',
        subtitle: 'Gráficos da atividade do servidor: quem fala, onde, quando e sobre o quê.',
        tip: 'Primeira vez? Um ADM roda **rp!status docpast** para importar o passado.',
        columns: [
            {
                title: 'Painel', who: 'últimos 14 dias', accent: 'green',
                steps: [
                    { cmd: 'rp!**status**', what: 'Dashboard geral de atividade do servidor.' },
                    { cmd: 'rp!**status** @pessoa', what: 'Gráfico de um alvo: também aceita **#canal** ou **"Nome do OC"**.' },
                    { cmd: ['rp!**status rank** user', 'rp!**status rank** channel', 'rp!**status rank** words'], what: 'Top 5 pessoas, top 5 canais e top 15 palavras.' },
                ],
            },
            {
                title: 'Histórico', who: 'todo o histórico coletado', accent: 'blue',
                steps: [
                    { cmd: 'rp!**status heatmap** @pessoa', what: 'Mapa de calor **dia da semana × hora**.' },
                    { cmd: 'rp!**status historico**', what: 'Linha do tempo mês a mês.' },
                    { cmd: 'rp!**status perfil** @pessoa', what: 'Perfil temporal: quando a pessoa costuma aparecer.' },
                    { cmd: 'rp!**status wrapped** 2026 @pessoa', what: 'Retrospectiva do ano, estilo **Wrapped**.' },
                ],
            },
            {
                title: 'Explorar', who: 'para fuçar', accent: 'gold',
                steps: [
                    { cmd: 'rp!**status explorar**', what: 'Explorador interativo: período × dimensão, Ngram e alvo.' },
                    { cmd: 'rp!**status trending** semana', what: 'O que está em alta e os momentos quentes (`dia`, `semana`, `mes`).' },
                    { cmd: 'rp!**status docpast**', what: '(ADM) Varre o histórico do servidor. ⚠️ Rodar 2× sem `reset` **dobra os números**.' },
                ],
            },
        ],
        boxes: [
            { kind: 'note', title: 'Palavras que poluem o ranking', text: 'Use **rp!ignorar add palavra** (ADM) para parar de contar uma palavra, e **rp!ignorar clean** para apagá-la também do que já foi contado.' },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'moderacao',
        title: 'Moderação com o', command: 'rp!', emoji: '🛡️',
        subtitle: 'Punições, proteção do chat e recepção de membros novos.',
        tip: 'Todos estes comandos exigem **permissão de staff**.',
        columns: [
            {
                title: 'Punições', who: 'só staff', accent: 'red',
                steps: [
                    { cmd: 'rp!**ban** @pessoa motivo', what: 'Também aceita **ID**: dá para banir quem já saiu. Desfaz com `unban ID`.' },
                    { cmd: 'rp!**kick** @pessoa motivo', what: 'Expulsa do servidor (pode voltar com convite).' },
                    { cmd: 'rp!**mute** @pessoa 2h', what: 'Timeout: `10m`, `2h`, `1d`. Tira antes com `unmute @pessoa`.' },
                    { cmd: 'rp!**clear** 50', what: 'Apaga as últimas 1–100 mensagens do canal.' },
                ],
            },
            {
                title: 'Proteção do chat', who: 'só staff', accent: 'gold',
                steps: [
                    { cmd: 'rp!**censura** on', what: 'Palavrão vira █████ e a mensagem **continua saindo** (também na fala de OC).' },
                    { cmd: ['rp!**censura add** termo', 'rp!**censura ignore** #canal-18'], what: 'Termos próprios e canais isentos. `test frase` simula.' },
                    { cmd: 'rp!**lockdown** on', what: 'Todo mundo vê, **ninguém fala**. `off` restaura tudo como estava.' },
                    { cmd: ['rp!**lockdown access** @pessoa', 'rp!**lockdown free** #canal'], what: 'Libera uma pessoa ou um canal durante o lockdown.' },
                ],
            },
            {
                title: 'Membros novos', who: 'só staff', accent: 'green',
                steps: [
                    { cmd: 'rp!**welcome** #entrada', what: 'Liga o registro de entradas e saídas nesse canal.' },
                    { cmd: 'rp!**welcome change** Bem-vindo, {user}!', what: '**{user}** vira a menção. Saídas: `change leave|kick|ban texto`.' },
                    { cmd: 'rp!**autorole add** @Novato', what: 'Cargo automático para quem entra. `list` mostra a configuração.' },
                    { cmd: 'rp!**reaction** 1234567890 @Cargo 🎨', what: 'Quem reagir com o emoji na mensagem ganha o cargo.' },
                ],
            },
        ],
        boxes: [
            { kind: 'note', title: 'Permissões do bot', text: 'A **censura** precisa de Gerenciar Mensagens e Gerenciar Webhooks; o **lockdown** e os cargos automáticos precisam de **Gerenciar Cargos**.' },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'logs',
        title: 'Logs & backups com o', command: 'rp!', emoji: '📋',
        subtitle: 'Auditoria do servidor para a staff e exportação de conversas para qualquer pessoa.',
        columns: [
            {
                title: 'Logs de auditoria', who: 'só staff', accent: 'blue',
                steps: [
                    { cmd: 'rp!**logs set** #auditoria', what: 'Escolhe o canal e **liga** os logs (mensagens, membros, moderação, voz…).' },
                    { cmd: 'rp!**logs status**', what: 'Mostra o que está ligado e a lista de categorias.' },
                    { cmd: 'rp!**logs categoria** reactions on', what: '`reactions` e `polls` vêm desligadas: **geram muito volume**.' },
                    { cmd: ['rp!**logs off**', 'rp!**logs on**'], what: 'Pausa e retoma. `logs test` manda uma mensagem de teste.' },
                ],
            },
            {
                title: 'Exportar um chat', who: 'qualquer pessoa', accent: 'green',
                steps: [
                    { cmd: 'rp!**exportchat** #canal', what: 'Histórico **completo** em HTML, entregue **na sua DM**.' },
                    { cmd: 'rp!**exportchat** #canal 01/10/2026 -> 31/10/2026', what: 'Só um período. Aceita hora: `14:00 01/10/2026 -> …`.' },
                    { cmd: 'rp!**exportchat readable** #canal', what: '`.txt` com uma linha por mensagem (`Nick, HH:MM - texto`) — **ideal para jogar numa IA**.' },
                    { cmd: 'rp!**exportchat** https://discord.com/channels/…', what: 'No **PV do bot**, use o link do canal no lugar da menção. `rp!export end` cancela.' },
                ],
            },
        ],
        boxes: [
            { kind: 'note', title: 'Privacidade', text: 'Você só consegue exportar canais que **você mesmo** consegue ler. Exportações grandes pedem confirmação antes de começar.' },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'oc',
        title: 'Como usar o', command: 'rp!oc', emoji: '🎭',
        subtitle: 'Personagens com nome e avatar próprios, no estilo Tupperbox.',
        tip: 'Funciona com **rp!tul**, **rp!tupper** e **rp!t** também.',
        columns: [
            {
                title: 'Crie seu OC', who: 'qualquer pessoa', accent: 'green',
                steps: [
                    { cmd: 'rp!**oc create** "Kaito" k:texto', what: 'O prefixo é o **gatilho** do personagem.' },
                    { cmd: 'k:Alguém viu minha espada?', what: 'Toda mensagem com `k:` é apagada e **reenviada como o Kaito**.' },
                    { cmd: 'rp!**oc avatar** "Kaito" [imagem ou link]', what: 'Foto do personagem. Renomear: `oc name "Kaito" "Kai"`.' },
                    { cmd: ['rp!**oc prefix** "Kaito" kai:texto', 'rp!**oc birthday** "Kaito" 15/03'], what: 'Troca o gatilho e define o aniversário.' },
                ],
            },
            {
                title: 'Gerencie', who: 'seus OCs', accent: 'blue',
                steps: [
                    { cmd: 'rp!**oc list**', what: 'Seus OCs, com botões para navegar.' },
                    { cmd: 'rp!**oc info** "Kaito"', what: 'Gatilho, mensagens, grupo, IA e duo. `oc find` mostra a ficha.' },
                    { cmd: 'rp!**oc edit** texto corrigido', what: 'Edita a **última mensagem** que o OC mandou.' },
                    { cmd: ['rp!**oc duo** "Kaito" @amigo', 'rp!**oc solo** "Kaito" @amigo'], what: 'Divide o controle do OC e depois retoma.' },
                    { cmd: 'rp!**oc delete** "Kaito"', what: 'Apaga um OC. `oc purge` apaga **todos** (cuidado).' },
                ],
            },
            {
                title: 'Organize & salve', who: 'grupos e backup', accent: 'gold',
                steps: [
                    { cmd: 'rp!**oc group create** "Kaito" "Família"', what: 'Cria o grupo já com um OC dentro.' },
                    { cmd: ['rp!**oc group add** "Aiko" "Família"', 'rp!**oc group list** "Família"'], what: 'Coloca mais OCs e lista o grupo. `group list` sozinho mostra os grupos.' },
                    { cmd: 'rp!**oc export**', what: 'Gera um JSON com **todos** os seus OCs.' },
                    { cmd: 'rp!**oc import**', what: 'Lê o JSON de volta — **aceita o export do Tupperbox**.' },
                ],
            },
        ],
        boxes: [
            {
                kind: 'chips', title: 'Seu OC também tem',
                items: [
                    { name: 'rp!oc wiki', desc: 'Página de lore com tópicos e galeria.' },
                    { name: 'rp!oc ai', desc: 'O OC fala sozinho com IA.' },
                    { name: 'rp!wallet', desc: 'Carteira própria do personagem.' },
                    { name: 'rp!inventory', desc: 'Mochila e itens do personagem.' },
                ],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'wiki',
        title: 'A wiki do seu OC no', command: 'rp!oc wiki', emoji: '📖',
        subtitle: 'Uma página interativa com biografia, tópicos de lore, galeria e ligações com outros OCs.',
        columns: [
            {
                title: 'Abra', who: 'qualquer pessoa', accent: 'green',
                steps: [
                    { cmd: 'rp!**oc wiki** "Kaito"', what: 'Abre a wiki: menu de seções, tópicos paginados, galeria e **referências** clicáveis.' },
                    { cmd: 'rp!**oc wiki bio** "Kaito"', what: 'Escreve a **introdução** principal (também aceita `intro`).' },
                    { cmd: 'rp!**oc wiki extra** "Kaito" "Idade" "17"', what: 'Informações curtas da ficha: idade, altura, cidade…' },
                ],
            },
            {
                title: 'Escreva a lore', who: 'dono do OC', accent: 'blue',
                steps: [
                    { cmd: 'rp!**oc wiki add** "Kaito" "Infância"', what: 'Cria uma **página de lore** nova.' },
                    { cmd: ['rp!**oc wiki edit** "Kaito" "Infância"', 'rp!**oc wiki remove** "Kaito" "Infância"'], what: 'Edita ou apaga um tópico.' },
                    { cmd: 'rp!**oc wiki emoji** "Kaito" "Infância" 🧸', what: 'Ícone do tópico no menu (aceita emoji do servidor).' },
                    { cmd: 'rp!**oc wiki ref** "Kaito" "Aiko"', what: 'Liga com a wiki de **outro OC**.' },
                ],
            },
            {
                title: 'Galeria', who: 'imagens por categoria', accent: 'gold',
                steps: [
                    { cmd: 'rp!**oc wiki gallery** "Kaito" "Infância"', what: 'Envie as imagens nessa categoria.' },
                    { cmd: 'Categoria = nome de um tópico', what: 'As imagens aparecem **junto da página** desse tópico.' },
                    { cmd: 'rp!**oc wiki gallery undo** "Kaito" "Infância" 2', what: 'Remove a imagem da página **2** da galeria.' },
                ],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'ia',
        title: 'Inteligência artificial no', command: 'rp!', emoji: '🤖',
        subtitle: 'NPCs, OCs que falam sozinhos e resumos da história — usando a sua própria chave de IA.',
        tip: 'Comece pelo **rp!token**: sem chave, os comandos de IA não funcionam.',
        columns: [
            {
                title: 'Comece por aqui', who: 'qualquer pessoa', accent: 'gold',
                steps: [
                    { cmd: 'rp!**token**', what: 'Abre um painel **na DM** para cadastrar sua chave Gemini/OpenAI sem vazar no chat.' },
                    { cmd: 'rp!**ai** qual o nome desta taverna?', what: 'Conversa rápida com o **NPC padrão**.' },
                    { cmd: 'rp!**resenha**', what: 'A IA dá uma nota para o **caos/zoeira** do chat.' },
                ],
            },
            {
                title: 'Resumo da história', who: 'lê o canal e resume', accent: 'blue',
                steps: [
                    { cmd: 'rp!**resumo**', what: 'Últimas **3 horas** do canal: tópicos, participantes e linha do tempo.' },
                    { cmd: 'rp!**resumo** 25/10', what: 'O dia inteiro. Em outro canal: `rp!resumo #canal`.' },
                    { cmd: 'rp!**resumo** 20/10 -> 25/10', what: 'Um intervalo (aceita hora e ano). Períodos grandes **pedem confirmação**; `-y` pula.' },
                    { cmd: '🌟 Resumo Definitivo', what: 'Botão que junta tudo numa **narrativa só**.' },
                ],
            },
            {
                title: 'OC com IA', who: 'o personagem ganha vida', accent: 'green',
                steps: [
                    { cmd: 'rp!**oc persona** "Kaito"', what: 'Escreva a personalidade em várias mensagens; **END** salva.' },
                    { cmd: 'rp!**oc insert** "Kaito"', what: 'O OC passa a **observar e responder** no canal.' },
                    { cmd: ['rp!**oc auto** "Kaito" on', 'rp!**oc delay** "Kaito" 30'], what: 'Modo vivo: fala por conta própria após 30 s de silêncio.' },
                    { cmd: ['rp!**oc end**', 'rp!**oc puppet** "Kaito"'], what: 'Tira o OC do canal / desliga a IA de vez.' },
                ],
            },
        ],
        boxes: [
            {
                kind: 'chips', title: 'Memórias da IA do OC',
                items: [
                    { name: 'oc memories "Kaito"', desc: 'Lista o que ele aprendeu.' },
                    { name: 'oc gaslight "Kaito"', desc: 'Implanta uma memória **nova ou falsa**.' },
                    { name: 'oc forget "Kaito" ID', desc: 'Apaga uma memória específica.' },
                    { name: 'oc alzheimer "Kaito"', desc: 'Zera **todas** as memórias.' },
                ],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'rpg',
        title: 'RPG & mundo com o', command: 'rp!', emoji: '🎲',
        subtitle: 'Fichas aprovadas pela staff, dados e o calendário de eventos do servidor.',
        columns: [
            {
                title: 'Fichas', who: 'staff monta · jogador preenche', accent: 'green',
                steps: [
                    { cmd: 'rp!**ficha template**', what: '(ADM) Cria o **modelo** de ficha do servidor.' },
                    { cmd: ['rp!**ficha check** #aprovação', 'rp!**ficha show** #fichas'], what: '(ADM) Onde a staff aprova e onde a ficha aprovada aparece.' },
                    { cmd: 'rp!**ficha new**', what: 'O jogador preenche **na DM**, campo a campo.' },
                    { cmd: 'rp!**ficha new +oc**', what: 'Igual, e o **OC é criado** quando a ficha for aprovada.' },
                ],
            },
            {
                title: 'Dados', who: 'qualquer pessoa', accent: 'blue',
                steps: [
                    { cmd: 'rp!**roll** 1d20+5', what: 'Um d20 com **+5** de bônus.' },
                    { cmd: 'rp!**roll** 4d6', what: 'Quatro dados de seis faces somados.' },
                    { cmd: 'rp!**roll** 2d10-1', what: 'Aceita **soma e subtração** de modificadores.' },
                ],
            },
            {
                title: 'Aniversários & eventos', who: 'calendário do servidor', accent: 'gold',
                steps: [
                    { cmd: 'rp!**birthday** #eventos', what: '(ADM) Instala o **painel** que se atualiza de hora em hora.' },
                    { cmd: 'rp!**birthday add** 15/03 Aniversário do Kaito', what: 'Adiciona uma data. Em lote: `{ 01/01 -> Ano Novo }`.' },
                    { cmd: 'rp!**birthday list**', what: 'Mostra o calendário completo.' },
                ],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'tempo',
        title: 'Tempo & clima com o', command: 'rp!', emoji: '🕰️',
        subtitle: 'Relógios de RP que andam na velocidade que você quiser, com clima de verdade.',
        columns: [
            {
                title: 'Relógio de RP', who: 'qualquer pessoa', accent: 'gold',
                steps: [
                    { cmd: 'rp!**tempo** #cidade Seattle', what: 'Relógio simples, na **hora real**.' },
                    { cmd: 'rp!**tempo set** Seattle 01/01/2005 15:30 + 1m -> 10m', what: 'Começa em 01/01/2005 e **1 min real = 10 min de RP**.' },
                    { cmd: 'rp!**tempo skip** Seattle 3d', what: 'Avança o RP (`2h`, `3d`…).' },
                    { cmd: ['rp!**tempo pause** Seattle', 'rp!**tempo resume** Seattle'], what: 'Congela e retoma. `delete` remove o relógio.' },
                ],
            },
            {
                title: 'Consultas', who: 'contas com o relógio', accent: 'blue',
                steps: [
                    { cmd: 'rp!**tempo list**', what: 'Todos os relógios do servidor. `info Seattle` mostra um.' },
                    { cmd: 'rp!**tempo conv** Seattle 2h', what: 'Quanto tempo de RP passa em **2 h reais**.' },
                    { cmd: 'rp!**tempo msg** Seattle 1 5m', what: 'Calcula o ritmo se **cada mensagem = 5 min de RP**.' },
                ],
            },
            {
                title: 'Clima', who: 'real ou da data do RP', accent: 'green',
                steps: [
                    { cmd: 'rp!**clima** Porto Alegre', what: 'Clima **real** de qualquer lugar do mundo.' },
                    { cmd: 'rp!**clima sync** Seattle Seattle', what: 'Liga o relógio a um lugar real: o clima segue a **data do RP**.' },
                    { cmd: 'rp!**clima** #cidade', what: 'Clima do relógio desse canal.' },
                    { cmd: ['rp!**clima force** Seattle Neve', 'rp!**clima force** Seattle auto'], what: 'Força uma condição e depois volta ao automático. `clima def` lista as condições.' },
                ],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'social',
        title: 'Diversão no', command: 'rp!', emoji: '🎮',
        subtitle: 'Telefone entre servidores, xadrez, futebol e alguns segredos.',
        tip: 'Futebol tem guia próprio: **rp!help futebol**.',
        columns: [
            {
                title: 'Telefone', who: 'converse com outro servidor', accent: 'blue',
                steps: [
                    { cmd: 'rp!**phone register** Central', what: 'Instala uma **linha telefônica** neste canal.' },
                    { cmd: 'rp!**phone call** Taverna', what: 'Liga para outro servidor que também tenha telefone (nome ou ID).' },
                    { cmd: ['rp!**phone accept**', 'rp!**phone decline**'], what: 'Atende ou recusa. Na chamada, as mensagens **passam de um canal para o outro**.' },
                    { cmd: ['rp!**phone end**', 'rp!**phone off**'], what: 'Desliga a chamada / desinstala o telefone.' },
                ],
            },
            {
                title: 'Xadrez', who: 'contra gente ou contra o Stockfish', accent: 'gold',
                steps: [
                    { cmd: 'rp!**chess** @oponente', what: 'Desafia alguém — **quem chama joga de pretas**.' },
                    { cmd: 'rp!**chess bot**', what: 'Contra o Stockfish: Fácil, Médio ou Difícil (você de brancas).' },
                    { cmd: 'e4 · Nf3 · De4 · e2e4 · O-O', what: 'Lances no botão **Fazer Lance**, em várias notações (até em português).' },
                    { cmd: '🤝 Empate · 🏳️ Desistir', what: 'O bot só aceita empate se a posição estiver equilibrada.' },
                ],
            },
            {
                title: 'E mais', who: 'para descontrair', accent: 'green',
                steps: [
                    { cmd: 'rp!**futebol**', what: 'Clubes, partidas ao vivo e torneios completos.' },
                    { cmd: 'rp!**não**', what: 'Uma desculpa criativa (e traduzida) para dizer não.' },
                    { cmd: 'a resposta para a pergunta fundamental…', what: 'Escreva **a pergunta fundamental sobre a vida, o universo e tudo mais** em qualquer mensagem. 🌌' },
                ],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'economia',
        title: 'Economia de OCs no', command: 'rp!', emoji: '💰',
        subtitle: 'Dinheiro e itens pertencem ao **personagem**, não à conta — cada OC tem carteira e mochila por servidor.',
        tip: 'Atalhos: **rp!w** (wallet) e **rp!i** / **rp!bag** (inventory).',
        columns: [
            {
                title: 'Carteira', who: 'cada OC tem a sua', accent: 'gold',
                steps: [
                    { cmd: 'rp!**wallet** "Kaito"', what: 'Saldo e itens do OC. Com um OC só, nem precisa do nome.' },
                    { cmd: 'rp!**wallet pay** "Kaito" 50 "Aiko"', what: 'Transfere dinheiro **entre OCs**.' },
                    { cmd: 'rp!**wallet top**', what: 'Ranking dos OCs mais ricos do servidor.' },
                    { cmd: 'rp!**wallet economia**', what: 'Painel da economia: moeda em circulação, PIB, inflação e câmbio.' },
                ],
            },
            {
                title: 'Mochila & loja', who: 'itens por personagem', accent: 'green',
                steps: [
                    { cmd: ['rp!**inventory** "Kaito"', 'rp!**inventory shop**'], what: 'A mochila do OC e a loja do servidor.' },
                    { cmd: 'rp!**inventory buy** "Kaito" "Poção" 2', what: 'Compra da loja. `sell` vende de volta por **50%**; `use` gasta 1.' },
                    { cmd: 'rp!**inventory give** "Kaito" "Poção" 1 "Aiko"', what: 'Dá um item para outro OC.' },
                    { cmd: 'rp!**inventory add** "Kaito" "Carta do pai" 1 ✉️', what: 'Item **pessoal** de RP (✎): sem preço, fora da loja.' },
                ],
            },
            {
                title: 'Viagem & staff', who: 'outros servidores e ajustes', accent: 'blue',
                steps: [
                    { cmd: 'rp!**levar** "Kaito"', what: '**Move** a mochila para outro servidor (rode `rp!bag` lá antes). O saldo não viaja.' },
                    { cmd: 'rp!**wallet setcurrency** "Ouro" 🪙', what: '(staff) Nome e símbolo da moeda do servidor.' },
                    { cmd: ['rp!**wallet add** "Kaito" 100', 'rp!**inventory additem** "Poção" 30 🧪'], what: '(staff) Ajusta saldo e cria itens na loja.' },
                    { cmd: 'rp!**wallet economia avancada** on', what: '(staff) Liga a simulação de **inflação, PIB e dólar**.' },
                ],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'futebol',
        title: 'Como usar o', command: 'rp!futebol', emoji: '⚽',
        subtitle: 'Monte o clube, jogue partidas e organize torneios — o motor é o do Brasfoot.',
        tip: 'Perdeu algo? **rp!futebol** sozinho mostra todos os comandos.',
        columns: [
            {
                title: 'Monte seu clube', who: 'qualquer pessoa', accent: 'green',
                steps: [
                    { cmd: 'rp!futebol **create** "Meu Time" 🦅', what: 'Funda o clube (você vira o dono).' },
                    { cmd: 'rp!futebol **add** "Meu Time" 75 **-ai**', what: 'Gera **22 jogadores** com OVR perto de 75.' },
                    { cmd: 'rp!futebol **addplayer** "Meu Time" "Pedro" ATK 85', what: 'Ou adiciona um a um. Posições: **GK DEF MID ATK**.' },
                    { cmd: 'rp!futebol **tatic** "Meu Time" 4-3-3 PRESSAO', what: 'Formação + estilo. Na dúvida: **suggest "Meu Time"**.' },
                    { cmd: 'rp!futebol **squad** "Meu Time"', what: 'Mostra o elenco titular e o banco.' },
                ],
            },
            {
                title: 'Jogue uma partida', who: 'qualquer pessoa', accent: 'blue',
                steps: [
                    { cmd: 'rp!futebol **match** "Time A" "Time B"', what: 'O primeiro é o **mandante**. Time que não existe é gerado na hora pela IA.' },
                    { cmd: 'rp!futebol **match** "Time A" "Time B" **-irl** 15', what: 'Ao vivo: **1 minuto de jogo = 15 s**. No intervalo, os donos fazem trocas.' },
                    { cmd: '📋 Táticas · ⭐ Notas · 📰 Narração', what: 'Botões no resultado: posse, chutes, desarmes, nota 0–10 de cada jogador e o lance a lance.' },
                    { cmd: 'rp!futebol **export** <ID>', what: 'A súmula **some em 48h**; exporte para guardar.' },
                ],
            },
            {
                title: 'Faça um torneio', who: 'ADM cria e roda · donos inscrevem', accent: 'gold',
                steps: [
                    { cmd: 'rp!futebol **tourney create** "Copa" BR', what: 'Cria com um formato: BR, EU, COPA, CONMEBOL, UEFA_NEW…' },
                    { cmd: 'rp!futebol **join** "Copa" "Meu Time"', what: 'Cada dono inscreve o seu time.' },
                    { cmd: 'rp!futebol **tourney start** "Copa"', what: 'Fecha inscrições e gera a tabela.' },
                    { cmd: ['rp!futebol **round sim** "Copa"', 'rp!futebol **round next** "Copa"'], what: 'Simula a rodada, depois avança. Repita até o **campeão** 🏆.' },
                    { cmd: 'rp!futebol **standings** "Copa"', what: 'Tabela. Chaveamento: **tourney view "Copa"**.' },
                ],
            },
        ],
        boxes: [
            {
                kind: 'chips', title: 'Estilos de jogo', width: 1.35,
                items: [
                    { name: 'BALANCEADO', desc: 'Sem bônus nem fraquezas.' },
                    { name: 'POSSE', desc: 'Domina o meio. Bate Retranca, sofre com Pressão.' },
                    { name: 'CONTRA_ATAQUE', desc: 'Defende firme e sai rápido. Bate Pressão.' },
                    { name: 'RETRANCA', desc: 'Fecha a defesa, ataca pouco. Bate Contra-ataque.' },
                    { name: 'PRESSAO', desc: 'Ataque total, cansa mais e leva cartão. Bate Posse.' },
                ],
            },
            {
                kind: 'flags', title: 'Flags do match',
                items: [
                    { flag: '-n', desc: 'campo neutro (sem vantagem de mandante)' },
                    { flag: '-r', desc: 'só o resultado, sem narração' },
                    { flag: '-irl 10-60', desc: 'ao vivo, segundos por minuto (padrão 15)' },
                ],
            },
        ],
    },
];
