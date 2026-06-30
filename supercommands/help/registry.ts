// RPTool/supercommands/help/registry.ts
// ─── Banco de dados da Central de Ajuda ───────────────────────────────────────
// Para adicionar/atualizar um comando no help, edite APENAS este arquivo.
//
//   HelpCategory → grupo exibido no menu de categorias
//   HelpEntry    → um comando (ou grupo lógico de subcomandos) dentro da categoria
//   HelpSub      → uma linha de subcomando dentro da página de detalhes
//
// Convenções:
//   - `usage` e `subs[].usage` já incluem o prefixo (rp!...)
//   - `essential: true` faz o comando aparecer na página inicial do rp!help
//   - `keywords` alimentam a busca (🔍) — inclua sinônimos e termos comuns

export const PREFIX = 'rp!';

export interface HelpSub {
    usage: string;
    desc:  string;
}

export interface HelpEntry {
    id:        string;     // identificador único (kebab-case, sem espaços)
    name:      string;     // como aparece pro usuário (ex: 'oc wiki')
    emoji:     string;
    summary:   string;     // 1 linha — listagem da categoria
    usage:     string[];   // linhas de uso principais
    details?:  string;     // texto longo — como funciona / o que esperar
    subs?:     HelpSub[];  // subcomandos
    aliases?:  string[];
    keywords?: string[];
    admin?:    boolean;    // exige permissão de staff
    essential?: boolean;   // aparece na página inicial
}

export interface HelpCategory {
    id:      string;
    label:   string;
    emoji:   string;
    desc:    string;       // máx ~90 chars (vai pro select menu)
    entries: HelpEntry[];
}

export const CATEGORIES: HelpCategory[] = [
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'utilidades',
        label: 'Utilidades & Informações',
        emoji: '🛠️',
        desc: 'Ferramentas gerais, status do servidor e utilitários',
        entries: [
            {
                id: 'help', name: 'help', emoji: '🆘', essential: true,
                summary: 'Esta Central de Ajuda interativa.',
                usage: ['rp!help', 'rp!help [comando|categoria|termo]'],
                details: 'Sem argumentos, abre o menu principal com as categorias. Com argumento, pula direto: `rp!help oc` abre os detalhes do comando, `rp!help moderação` abre a categoria, e qualquer outro termo vira uma pesquisa.',
                aliases: ['ajuda', 'comandos'],
                keywords: ['ajuda', 'manual', 'wiki', 'comandos'],
            },
            {
                id: 'helloworld', name: 'helloworld', emoji: '🏓', essential: true,
                summary: 'Teste de latência do bot (ping).',
                usage: ['rp!helloworld'],
                keywords: ['ping', 'latencia', 'online', 'vivo'],
            },
            {
                id: 'version', name: 'version', emoji: '📦', essential: true,
                summary: 'Versão atual do bot e créditos da equipe.',
                usage: ['rp!version'],
                keywords: ['versao', 'creditos', 'changelog'],
            },
            {
                id: 'serverinfo', name: 'serverinfo', emoji: '🏠',
                summary: 'Informações do servidor atual.',
                usage: ['rp!serverinfo'],
                subs: [
                    { usage: 'rp!serverinfo geral', desc: 'Dados gerais, contagem de membros e membro mais antigo' },
                    { usage: 'rp!serverinfo photo', desc: 'Envia apenas o ícone do servidor' },
                ],
                keywords: ['servidor', 'guild', 'icone'],
            },
            {
                id: 'userinfo', name: 'userinfo', emoji: '👤',
                summary: 'Ficha completa de um usuário.',
                usage: ['rp!userinfo [@user]'],
                subs: [
                    { usage: 'rp!userinfo [@user] info', desc: 'Ficha completa, datas e rank de entrada' },
                    { usage: 'rp!userinfo [@user] photo', desc: 'Envia a foto de perfil do usuário' },
                ],
                keywords: ['usuario', 'perfil', 'avatar', 'membro'],
            },
            {
                id: 'status', name: 'status', emoji: '📊',
                summary: 'Dashboard de atividade do servidor (últimos 15 dias).',
                usage: ['rp!status'],
                details: 'Gera gráficos de atividade a partir das mensagens registradas. Aceita um alvo específico (usuário, canal ou OC) pra filtrar o gráfico.',
                subs: [
                    { usage: 'rp!status', desc: 'Dashboard geral de atividade dos últimos 15 dias' },
                    { usage: 'rp!status rank user', desc: 'Top 5 usuários mais ativos (gráfico)' },
                    { usage: 'rp!status rank channel', desc: 'Top 5 canais mais ativos (gráfico)' },
                    { usage: 'rp!status rank words', desc: 'Top 15 palavras mais usadas' },
                    { usage: 'rp!status [@user|#canal|"OC"]', desc: 'Gráfico específico do alvo escolhido' },
                ],
                keywords: ['estatisticas', 'atividade', 'grafico', 'rank', 'mensagens'],
            },
            {
                id: 'ignorar', name: 'ignorar', emoji: '🙈',
                summary: 'Ignora uma palavra no rank words do rp!status.',
                usage: ['rp!ignorar [palavra]'],
                keywords: ['palavra', 'rank', 'filtro'],
            },
            {
                id: 'kanban', name: 'kanban', emoji: '🗂️',
                summary: 'Quadro de tarefas (TODO/DOING/DONE) com painel ao vivo.',
                usage: ['rp!kanban'],
                details: 'Gerencie tarefas direto do Discord. O painel criado com `show` é atualizado em tempo real conforme as tarefas mudam de coluna.',
                subs: [
                    { usage: 'rp!kanban add [TODO|DOING|DONE] [Tarefa]', desc: 'Adiciona uma tarefa na coluna' },
                    { usage: 'rp!kanban move [ID] [NOVO_STATUS]', desc: 'Move a tarefa de coluna' },
                    { usage: 'rp!kanban del [ID]', desc: 'Deleta a tarefa' },
                    { usage: 'rp!kanban show #canal', desc: 'Cria o painel fixo auto-atualizável' },
                    { usage: 'rp!kanban ver', desc: 'Mostra o quadro atual' },
                ],
                aliases: ['kb', 'tasks', 'task'],
                keywords: ['tarefas', 'quadro', 'todo', 'organizacao'],
            },
            {
                id: 'math', name: 'math', emoji: '🧮',
                summary: 'Resolve equações e expressões (Wolfram Alpha).',
                usage: ['rp!math [expressão]'],
                keywords: ['matematica', 'calculadora', 'equacao', 'wolfram'],
            },
            {
                id: 'console', name: 'console', emoji: '💻',
                summary: 'Roda código JavaScript em sandbox.',
                usage: ['rp!console [código]'],
                keywords: ['javascript', 'codigo', 'eval', 'sandbox', 'dev'],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'moderacao',
        label: 'Moderação & Administração',
        emoji: '🛡️',
        desc: 'Punições, gerenciamento de chat, cargos e boas-vindas',
        entries: [
            {
                id: 'ban', name: 'ban', emoji: '🔨', admin: true, essential: true,
                summary: 'Bane um usuário (dentro ou fora do servidor).',
                usage: ['rp!ban [@user|ID] [motivo]'],
                details: 'Aceita menção ou ID direto — dá pra banir alguém que já saiu do servidor usando o ID.',
                keywords: ['banir', 'banimento', 'punir'],
            },
            {
                id: 'unban', name: 'unban', emoji: '🕊️', admin: true,
                summary: 'Remove o banimento de um usuário.',
                usage: ['rp!unban [ID]'],
                keywords: ['desbanir', 'perdao'],
            },
            {
                id: 'kick', name: 'kick', emoji: '👢', admin: true,
                summary: 'Expulsa um usuário do servidor.',
                usage: ['rp!kick [@user] [motivo]'],
                keywords: ['expulsar', 'chutar'],
            },
            {
                id: 'mute', name: 'mute', emoji: '🔇', admin: true,
                summary: 'Dá timeout em um usuário.',
                usage: ['rp!mute [@user] [tempo]'],
                details: 'O tempo aceita sufixos: `10m` (minutos), `2h` (horas), `1d` (dias).',
                keywords: ['castigo', 'timeout', 'silenciar'],
            },
            {
                id: 'unmute', name: 'unmute', emoji: '🔊', admin: true,
                summary: 'Tira o usuário do castigo imediatamente.',
                usage: ['rp!unmute [@user]'],
                keywords: ['descastigar', 'timeout'],
            },
            {
                id: 'clear', name: 'clear', emoji: '🧹', admin: true,
                summary: 'Limpa mensagens do chat.',
                usage: ['rp!clear [1-100]'],
                keywords: ['limpar', 'apagar', 'purge', 'mensagens'],
            },
            {
                id: 'welcome', name: 'welcome', emoji: '👋', admin: true,
                summary: 'Sistema de boas-vindas e registro de entrada/saída.',
                usage: ['rp!welcome #canal'],
                details: 'As mensagens aceitam o marcador `{user}`, substituído pela menção do membro.',
                subs: [
                    { usage: 'rp!welcome #canal', desc: 'Define onde caem os registros e ativa o sistema' },
                    { usage: 'rp!welcome change [msg]', desc: 'Muda o texto de entrada (aceita {user})' },
                    { usage: 'rp!welcome change <leave|kick|ban> [msg]', desc: 'Altera as mensagens de saída/expulsão/ban' },
                    { usage: 'rp!welcome end', desc: 'Desliga e reseta o sistema' },
                ],
                keywords: ['boas-vindas', 'entrada', 'saida', 'registro'],
            },
            {
                id: 'autorole', name: 'autorole', emoji: '🏷️', admin: true,
                summary: 'Cargo automático para novos membros.',
                usage: ['rp!autorole'],
                subs: [
                    { usage: 'rp!autorole add [@cargo]', desc: 'Adiciona cargo automático pra novatos' },
                    { usage: 'rp!autorole del [@cargo]', desc: 'Remove o cargo da lista' },
                    { usage: 'rp!autorole list', desc: 'Mostra a configuração atual' },
                ],
                keywords: ['cargo', 'role', 'automatico', 'novato'],
            },
            {
                id: 'reaction', name: 'reaction', emoji: '🎭', admin: true,
                summary: 'Cargo por reação em mensagem.',
                usage: ['rp!reaction [ID_Msg] [@Cargo] [Emoji]'],
                details: 'Quem reagir com o emoji na mensagem indicada ganha o cargo; remover a reação tira o cargo.',
                keywords: ['cargo', 'reagir', 'reaction role'],
            },
            {
                id: 'fatos', name: 'fatos', emoji: '🧠', admin: true,
                summary: 'Maratona de conhecimento para um usuário.',
                usage: ['rp!fatos [@user] [qtd]'],
                keywords: ['curiosidades', 'conhecimento'],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'logs',
        label: 'Logs & Backups',
        emoji: '📋',
        desc: 'Auditoria de eventos do servidor e exportação de chats',
        entries: [
            {
                id: 'logs', name: 'logs', emoji: '📋', admin: true,
                summary: 'Sistema de logs de auditoria do servidor.',
                usage: ['rp!logs'],
                details: 'Registra eventos do servidor (mensagens, membros, moderação, voz, etc.) em um canal de auditoria pra staff. Categorias como `reactions` e `polls` são opt-in por terem volume alto — ative com cuidado.',
                subs: [
                    { usage: 'rp!logs set #canal', desc: 'Define o canal de logs e ativa o sistema' },
                    { usage: 'rp!logs on', desc: 'Ativa os logs' },
                    { usage: 'rp!logs off', desc: 'Pausa os logs' },
                    { usage: 'rp!logs status', desc: 'Estado atual e lista de categorias' },
                    { usage: 'rp!logs categoria <nome> on|off', desc: 'Liga/desliga uma categoria específica' },
                    { usage: 'rp!logs test', desc: 'Envia uma mensagem de teste no canal' },
                ],
                aliases: ['log', 'auditoria'],
                keywords: ['auditoria', 'registro', 'eventos', 'staff', 'monitorar'],
            },
            {
                id: 'exportchat', name: 'exportchat', emoji: '📤',
                summary: 'Exporta mensagens de um canal para HTML.',
                usage: [
                    'rp!exportchat #canal',
                    'rp!exportchat #canal DD/MM/AAAA -> DD/MM/AAAA',
                    'rp!exportchat #canal HH:MM DD/MM/AAAA -> HH:MM DD/MM/AAAA',
                ],
                details: 'Sem intervalo, exporta o histórico completo. O bot escaneia os dias com mensagens, processa em paralelo e envia os arquivos HTML **na sua DM**. Exportações grandes pedem confirmação antes de começar.',
                aliases: ['exportar', 'backupchat'],
                keywords: ['backup', 'html', 'exportar', 'historico', 'transcript'],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'oc',
        label: 'OCs — Criação & Gestão',
        emoji: '🎭',
        desc: 'Criação, edição e organização de personagens originais',
        entries: [
            {
                id: 'oc', name: 'oc', emoji: '🎭', essential: true,
                summary: 'Sistema completo de personagens originais (estilo Tupperbox).',
                usage: ['rp!oc'],
                details: 'Crie um OC com um prefixo de gatilho — toda mensagem que começar com esse prefixo é reenviada como o personagem (nome + avatar próprios, via webhook). Veja os demais comandos desta categoria, a categoria **OCs — Wiki** e a parte de IA em **Inteligência Artificial**.',
                aliases: ['tul', 'tupper', 'char', 't'],
                keywords: ['personagem', 'tupper', 'tupperbox', 'proxy', 'roleplay'],
            },
            {
                id: 'oc-create', name: 'oc create', emoji: '✨',
                summary: 'Cria e personaliza a identidade do seu OC.',
                usage: ['rp!oc create ["Nome"] [prefixo:texto]'],
                details: 'O prefixo é o gatilho: se for `k:`, toda mensagem começando com `k:` sai como o personagem.',
                subs: [
                    { usage: 'rp!oc create ["Nome"] [prefixo:texto]', desc: 'Cria um novo OC' },
                    { usage: 'rp!oc name ["Antigo"] ["Novo"]', desc: 'Renomeia o OC' },
                    { usage: 'rp!oc avatar ["Nome"] [img/link]', desc: 'Altera a foto do personagem' },
                    { usage: 'rp!oc prefix ["Nome"] [novo:texto]', desc: 'Muda o gatilho do OC' },
                    { usage: 'rp!oc birthday ["Nome"] [DD/MM]', desc: 'Define o aniversário' },
                ],
                keywords: ['criar', 'novo', 'avatar', 'prefixo', 'aniversario', 'renomear'],
            },
            {
                id: 'oc-gestao', name: 'oc list', emoji: '📁',
                summary: 'Listagem, edição e exclusão dos seus OCs.',
                usage: ['rp!oc list'],
                subs: [
                    { usage: 'rp!oc list', desc: 'Lista seus OCs (com botões de navegação)' },
                    { usage: 'rp!oc find ["Nome"]', desc: 'Ficha resumida do OC' },
                    { usage: 'rp!oc edit [novo texto]', desc: 'Edita a última mensagem enviada pelo OC' },
                    { usage: 'rp!oc delete ["Nome"]', desc: 'Apaga um OC específico' },
                    { usage: 'rp!oc purge', desc: '⚠️ Apaga TODOS os seus OCs de uma vez' },
                    { usage: 'rp!oc duo ["Nome"] [@user]', desc: 'Divide o controle do OC com outra pessoa' },
                    { usage: 'rp!oc solo ["Nome"] [@user]', desc: 'Retoma o controle exclusivo' },
                ],
                keywords: ['lista', 'editar', 'apagar', 'deletar', 'compartilhar', 'duo'],
            },
            {
                id: 'oc-group', name: 'oc group', emoji: '🗂️',
                summary: 'Organiza seus OCs em grupos.',
                usage: ['rp!oc group'],
                subs: [
                    { usage: 'rp!oc group create ["OC"] ["Grupo"]', desc: 'Cria o grupo e já adiciona um OC' },
                    { usage: 'rp!oc group add ["OC"] ["Grupo"]', desc: 'Põe um OC no grupo' },
                    { usage: 'rp!oc group list ["Grupo"]', desc: 'Mostra os OCs de um grupo específico' },
                    { usage: 'rp!oc group remove ["OC"]', desc: 'Tira o OC do grupo' },
                    { usage: 'rp!oc group delete ["Grupo"]', desc: 'Exclui o grupo' },
                    { usage: 'rp!oc group list', desc: 'Lista seus grupos criados' },
                ],
                keywords: ['grupo', 'organizar', 'pasta'],
            },
            {
                id: 'oc-backup', name: 'oc import/export', emoji: '💾',
                summary: 'Backup e migração de OCs via JSON (compatível com Tupperbox).',
                usage: ['rp!oc import', 'rp!oc export'],
                subs: [
                    { usage: 'rp!oc import', desc: 'Puxa seus OCs de um arquivo JSON (aceita export do Tupperbox)' },
                    { usage: 'rp!oc export', desc: 'Gera um JSON com todos os seus OCs' },
                ],
                keywords: ['backup', 'json', 'tupperbox', 'migrar', 'importar', 'exportar'],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'wiki',
        label: 'OCs — Wiki',
        emoji: '📖',
        desc: 'Wiki interativa com lore, tópicos e galeria de cada OC',
        entries: [
            {
                id: 'oc-wiki', name: 'oc wiki', emoji: '📖',
                summary: 'Abre a Wiki interativa de um OC.',
                usage: ['rp!oc wiki ["Nome"]'],
                details: 'Mostra a ficha do personagem com menu de seções, tópicos de lore paginados, galeria de imagens e links pra Wikis de OCs citados (referências).',
                keywords: ['lore', 'ficha', 'historia', 'biografia'],
            },
            {
                id: 'oc-wiki-edit', name: 'oc wiki (edição)', emoji: '✏️',
                summary: 'Escreve e organiza o conteúdo da Wiki do OC.',
                usage: ['rp!oc wiki ["Nome"] [subcomando]'],
                subs: [
                    { usage: 'rp!oc wiki bio ["Nome"]', desc: 'Escreve a introdução principal (aceita também `intro`)' },
                    { usage: 'rp!oc wiki add ["Nome"] ["Tópico"]', desc: 'Cria uma nova página de lore' },
                    { usage: 'rp!oc wiki edit ["Nome"] ["Tópico"]', desc: 'Edita um tópico existente' },
                    { usage: 'rp!oc wiki remove ["Nome"] ["Tópico"]', desc: 'Apaga o tópico' },
                    { usage: 'rp!oc wiki extra ["Nome"] ["Chave"] ["Valor"]', desc: 'Adiciona info curta (ex: Idade, Altura)' },
                    { usage: 'rp!oc wiki emoji ["Nome"] ["Tópico"] [Emoji]', desc: 'Muda o ícone do tópico no menu' },
                    { usage: 'rp!oc wiki ref ["Nome"] ["NomeReferência"]', desc: 'Linka com a Wiki de outro OC' },
                ],
                keywords: ['bio', 'topico', 'lore', 'escrever', 'referencia'],
            },
            {
                id: 'oc-wiki-gallery', name: 'oc wiki gallery', emoji: '🖼️',
                summary: 'Galeria de imagens da Wiki, organizada por categorias.',
                usage: ['rp!oc wiki gallery ["NomeOC"] ["Categoria"]'],
                details: 'Imagens em categorias com o mesmo nome de um tópico aparecem junto às páginas dele. Use `undo` com o número da página pra remover uma imagem.',
                subs: [
                    { usage: 'rp!oc wiki gallery ["NomeOC"] ["Categoria"]', desc: 'Adiciona imagens à categoria' },
                    { usage: 'rp!oc wiki gallery undo ["NomeOC"] ["Categoria"] [página]', desc: 'Remove a imagem da página indicada' },
                ],
                keywords: ['galeria', 'imagens', 'fotos', 'album'],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'ia',
        label: 'Inteligência Artificial',
        emoji: '🤖',
        desc: 'NPCs com IA, personas de OC, memórias e resumos',
        entries: [
            {
                id: 'token', name: 'token', emoji: '🔑',
                summary: 'Painel via DM pra gerenciar suas chaves de API (Gemini/OpenAI).',
                usage: ['rp!token'],
                details: 'Os recursos de IA usam a SUA chave de API. O painel é enviado por DM pra chave não vazar no chat.',
                keywords: ['api', 'chave', 'gemini', 'openai', 'configurar'],
            },
            {
                id: 'ai', name: 'ai', emoji: '💬',
                summary: 'Conversa rápida com o NPC padrão.',
                usage: ['rp!ai [texto]'],
                keywords: ['npc', 'conversar', 'chat', 'gpt'],
            },
            {
                id: 'resume', name: 'resume', emoji: '📜',
                summary: 'IA resume a história do RP em um período.',
                usage: ['rp!resume [data] -> [data]'],
                details: 'Lê as mensagens do canal no intervalo informado e gera um resumo narrativo dos acontecimentos.',
                keywords: ['resumo', 'recap', 'historia'],
            },
            {
                id: 'resenha', name: 'resenha', emoji: '🍿',
                summary: 'IA avalia o nível de caos/zoeira do chat.',
                usage: ['rp!resenha'],
                keywords: ['zoeira', 'caos', 'avaliar'],
            },
            {
                id: 'oc-ai', name: 'oc ai', emoji: '🧠',
                summary: 'Dá vida ao seu OC: persona, modo automático e controle.',
                usage: ['rp!oc ai ["Nome"]'],
                details: 'Defina a persona e insira o OC no canal — ele observa a conversa e responde como o personagem. No modo `auto`, fala por conta própria; com `delay`, espera X segundos de silêncio antes de agir.',
                subs: [
                    { usage: 'rp!oc ai ["Nome"]', desc: 'Define a persona da IA do OC' },
                    { usage: 'rp!oc insert ["Nome"] [auto]', desc: 'IA começa a observar/falar no canal' },
                    { usage: 'rp!oc delay ["Nome"] [segundos]', desc: 'Tempo de espera no modo auto' },
                    { usage: 'rp!oc end', desc: 'Tira o OC com IA do canal' },
                    { usage: 'rp!oc puppet ["Nome"]', desc: 'Desliga a IA (o OC volta a ser manual)' },
                ],
                keywords: ['persona', 'npc', 'automatico', 'inserir'],
            },
            {
                id: 'oc-memories', name: 'oc memories', emoji: '💭',
                summary: 'Gerencia as memórias aprendidas pela IA do OC.',
                usage: ['rp!oc memories ["Nome"]'],
                subs: [
                    { usage: 'rp!oc memories ["Nome"]', desc: 'Lista as memórias aprendidas' },
                    { usage: 'rp!oc gaslight ["Nome"]', desc: 'Implanta uma memória nova/falsa' },
                    { usage: 'rp!oc forget ["Nome"] [ID]', desc: 'Apaga uma memória específica' },
                    { usage: 'rp!oc alzheimer ["Nome"]', desc: 'Zera todas as memórias da IA' },
                ],
                keywords: ['memoria', 'esquecer', 'gaslight', 'lembrar'],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'rpg',
        label: 'RPG & Mundo',
        emoji: '🎲',
        desc: 'Fichas de personagem, dados e eventos do servidor',
        entries: [
            {
                id: 'ficha', name: 'ficha', emoji: '📋',
                summary: 'Sistema automático de fichas de personagem.',
                usage: ['rp!ficha'],
                details: 'O jogador preenche a ficha **na DM**, campo a campo, seguindo o modelo do servidor. A ficha cai no canal de aprovação (`check`) e, quando aprovada, o resultado aparece no canal público (`show`). Com `+oc`, o OC é criado automaticamente na aprovação.',
                subs: [
                    { usage: 'rp!ficha new', desc: 'Preenche a ficha na DM' },
                    { usage: 'rp!ficha new +oc', desc: 'Preenche a ficha e cria o OC ao ser aprovado' },
                    { usage: 'rp!ficha view', desc: 'Exibe o modelo atual e os canais configurados' },
                    { usage: 'rp!ficha template', desc: 'Cria/edita o modelo de ficha do servidor (admin)' },
                    { usage: 'rp!ficha check #canal', desc: 'Define o canal de aprovação (admin)' },
                    { usage: 'rp!ficha show #canal', desc: 'Define o canal público de resultados (admin)' },
                    { usage: 'rp!ficha submit #canal', desc: 'Canal onde jogadores postam fichas direto (admin)' },
                ],
                aliases: ['form', 'sheet'],
                keywords: ['ficha', 'formulario', 'template', 'aprovacao', 'personagem'],
            },
            {
                id: 'roll', name: 'roll', emoji: '🎲', essential: true,
                summary: 'Rola dados no formato clássico de RPG.',
                usage: ['rp!roll [fórmula]'],
                details: 'Exemplos: `rp!roll 1d20+5`, `rp!roll 4d6`, `rp!roll 2d10-1`.',
                keywords: ['dados', 'd20', 'rolar', 'sorte'],
            },
            {
                id: 'birthday', name: 'birthday', emoji: '🎂',
                summary: 'Calendário de aniversários e eventos do servidor.',
                usage: ['rp!birthday'],
                details: 'O painel instalado com `#canal` é atualizado automaticamente a cada hora.',
                subs: [
                    { usage: 'rp!birthday #canal', desc: 'Instala o painel automático de eventos' },
                    { usage: 'rp!birthday add [DD/MM]', desc: 'Adiciona evento/aniversário (aceita em lote)' },
                    { usage: 'rp!birthday list', desc: 'Mostra o calendário completo do servidor' },
                ],
                keywords: ['aniversario', 'niver', 'evento', 'calendario'],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'tempo',
        label: 'Tempo & Clima',
        emoji: '🕰️',
        desc: 'Relógios de RP com velocidade própria e clima sincronizado',
        entries: [
            {
                id: 'tempo', name: 'tempo', emoji: '🕰️',
                summary: 'Motor de Tempo RP — relógios, velocidade, saltos e conversões.',
                usage: ['rp!tempo #canal [Nome]'],
                details: 'Cria relógios que correm na velocidade que você definir (ex: 1 minuto real = 10 minutos de RP). Exemplo completo:\n`rp!tempo set Seattle 01/01/2005 15:30 + 1m -> 10m`\nCombine com `rp!clima sync` pra ter clima automático por localização.',
                subs: [
                    { usage: 'rp!tempo #canal [Nome]', desc: 'Relógio simples sincronizado com a hora real' },
                    { usage: 'rp!tempo set <Nome> [#canal] <DD/MM/AAAA> <HH:MM> [+ Xm -> Yh]', desc: 'Relógio RP com data e velocidade customizadas' },
                    { usage: 'rp!tempo skip <Nome> <Tempo>', desc: 'Avança o tempo RP (ex: 2h, 3d)' },
                    { usage: 'rp!tempo pause <Nome>', desc: 'Congela o relógio' },
                    { usage: 'rp!tempo resume <Nome>', desc: 'Retoma o relógio' },
                    { usage: 'rp!tempo delete <Nome>', desc: 'Remove o relógio' },
                    { usage: 'rp!tempo list', desc: 'Todos os relógios ativos no servidor' },
                    { usage: 'rp!tempo info <Nome>', desc: 'Detalhes de um relógio' },
                    { usage: 'rp!tempo conv <Nome> <Tempo Real>', desc: 'Quanto tempo RP passa em X de tempo real' },
                    { usage: 'rp!tempo msg <Nome> <N> <Duração RP>', desc: 'Taxa de tempo por mensagem' },
                ],
                aliases: ['time', 'clock', 'relogio'],
                keywords: ['relogio', 'hora', 'data', 'velocidade', 'skip', 'tempo'],
            },
            {
                id: 'clima', name: 'clima', emoji: '🌦️',
                summary: 'Sistema de clima — real ou vinculado aos relógios de RP.',
                usage: ['rp!clima <Local>'],
                details: 'Consulta o clima real de qualquer lugar do mundo, ou o clima histórico da data RP de um relógio sincronizado com `sync`. Use `force` pra impor uma condição na marra (condições fora da lista padrão viram Anomalia 🚫); `force <Relógio> auto` volta ao automático.',
                subs: [
                    { usage: 'rp!clima <Local>', desc: 'Consulta rápida do clima real (ex: Porto Alegre)' },
                    { usage: 'rp!clima #canal', desc: 'Clima da data RP do relógio ativo no canal' },
                    { usage: 'rp!clima sync <Relógio|#canal> <Local>', desc: 'Vincula uma localização real ao relógio' },
                    { usage: 'rp!clima force <Relógio> <Condição>', desc: 'Força uma condição climática (use `auto` pra resetar)' },
                    { usage: 'rp!clima def', desc: 'Lista as condições climáticas padrão (WMO)' },
                ],
                aliases: ['weather', 'chuva', 'sol'],
                keywords: ['clima', 'temperatura', 'chuva', 'previsao', 'weather'],
            },
        ],
    },
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'social',
        label: 'Diversão & Social',
        emoji: '🎮',
        desc: 'Minigames, telefone inter-servidores e easter eggs',
        entries: [
            {
                id: 'phone', name: 'phone', emoji: '☎️',
                summary: 'Telefone inter-servidores — converse com outros servers.',
                usage: ['rp!phone register [Nome]'],
                details: 'Instale uma linha telefônica num canal e disque pra outros servidores que também tenham o telefone. As mensagens fluem entre os canais enquanto a chamada estiver ativa.',
                subs: [
                    { usage: 'rp!phone register [Nome]', desc: 'Instala a linha telefônica no canal' },
                    { usage: 'rp!phone call [ID/Nome]', desc: 'Disca para outro servidor' },
                    { usage: 'rp!phone accept', desc: 'Atende uma chamada recebida' },
                    { usage: 'rp!phone decline', desc: 'Recusa a chamada' },
                    { usage: 'rp!phone end', desc: 'Desliga a chamada ativa' },
                    { usage: 'rp!phone off', desc: 'Desinstala o telefone do servidor' },
                ],
                keywords: ['telefone', 'ligar', 'chamada', 'servidor'],
            },
            {
                id: 'chess', name: 'chess', emoji: '♟️',
                summary: 'Xadrez: membro vs membro ou contra o Stockfish.',
                usage: ['rp!chess @oponente', 'rp!chess bot'],
                details: 'Os lances são digitados no botão **Fazer Lance** e aceitam várias notações: `e4`, `Nf3`, `De4` (português), `e2e4` (bruto), `Qxd4`, `Qe4+`, `O-O`. Também dá pra **propor empate** 🤝 (o oponente aceita/recusa; contra o bot, ele topa só se a posição estiver equilibrada) e **desistir** 🏳️. No desafio PvP, quem chama joga de **pretas**; contra o bot você escolhe a dificuldade e joga de brancas.',
                subs: [
                    { usage: 'rp!chess @oponente', desc: 'Desafia um membro (você joga de pretas)' },
                    { usage: 'rp!chess bot', desc: 'Joga contra o Stockfish (escolhe Fácil/Médio/Difícil)' },
                ],
                aliases: ['xadrez'],
                keywords: ['xadrez', 'stockfish', 'jogo', 'tabuleiro', 'pvp'],
            },
            {
                id: 'futebol', name: 'futebol', emoji: '⚽',
                summary: 'Motor de simulação tática de futebol — clubes, torneios e partidas.',
                usage: ['rp!futebol'],
                details: 'Funde clubes, monte elencos (na mão ou gerados por IA), defina táticas e simule partidas e torneios completos com tabela, rodadas e tribunal (STJD). Flags do `match`: `-n` campo neutro, `-r` resultado direto, `-irl [10-60]` partida ao vivo.',
                subs: [
                    { usage: 'rp!futebol match "Time A" "Time B"', desc: 'Simula uma partida' },
                    { usage: 'rp!futebol create "Nome" [emoji]', desc: 'Funda um clube' },
                    { usage: 'rp!futebol add "Nome" [OVR] [emoji] -ai', desc: 'Gera 22 jogadores via IA 🤖' },
                    { usage: 'rp!futebol addplayer "Time" "Jogador" POS OVR', desc: 'Adição rápida de jogador' },
                    { usage: 'rp!futebol player create|view|edit|remove', desc: 'Jogadores customizados com stats FIFA' },
                    { usage: 'rp!futebol squad "Time"', desc: 'Exibe o elenco' },
                    { usage: 'rp!futebol tatic "Time" FORMAÇÃO ESTILO', desc: 'Define a tática' },
                    { usage: 'rp!futebol suggest "Time"', desc: 'IA sugere a melhor tática 🧠' },
                    { usage: 'rp!futebol list serverlist|userlist', desc: 'Times do servidor / seus times' },
                    { usage: 'rp!futebol tourney create|start "Nome"', desc: 'Cria e inicia torneios (ADM)' },
                    { usage: 'rp!futebol join "Torneio" "Time"', desc: 'Inscreve seu time' },
                    { usage: 'rp!futebol standings "Torneio"', desc: 'Tabela de classificação' },
                    { usage: 'rp!futebol round sim|next|view "Torneio"', desc: 'Simula, avança e exibe rodadas' },
                    { usage: 'rp!futebol admin punish|ban|postpone', desc: 'Tribunal STJD (ADM)' },
                    { usage: 'rp!futebol export <ID> / import', desc: 'Exporta/importa súmulas em JSON' },
                    { usage: 'rp!futebol history "Torneio"', desc: 'Gráfico de campeões históricos' },
                ],
                aliases: ['fb', 'fut', 'football'],
                keywords: ['futebol', 'time', 'torneio', 'partida', 'campeonato', 'simulacao'],
            },
            {
                id: 'nao', name: 'não', emoji: '🙅',
                summary: 'Retorna uma desculpa criativa (e traduzida) pra dizer não.',
                usage: ['rp!não'],
                aliases: ['nao', 'no', 'nein', 'nope', 'n'],
                keywords: ['desculpa', 'recusar', 'negativa'],
            },
            {
                id: '42', name: '42', emoji: '🌌',
                summary: 'Easter egg — a Resposta para a Pergunta Fundamental.',
                usage: ['(escreva a pergunta fundamental no chat)'],
                details: 'Não é um comando: basta escrever em qualquer mensagem *"a resposta para a pergunta fundamental sobre a vida, o universo e tudo mais"* e o bot responde.',
                keywords: ['easter egg', 'guia do mochileiro', 'douglas adams'],
            },
        ],
    },
];

// ─── Índices auxiliares ───────────────────────────────────────────────────────
export function findCategory(id: string): HelpCategory | undefined {
    return CATEGORIES.find(c => c.id === id);
}

export function findEntry(catId: string, entryId: string): { cat: HelpCategory; entry: HelpEntry } | undefined {
    const cat = findCategory(catId);
    const entry = cat?.entries.find(e => e.id === entryId);
    return cat && entry ? { cat, entry } : undefined;
}

export function essentialEntries(): { cat: HelpCategory; entry: HelpEntry }[] {
    const out: { cat: HelpCategory; entry: HelpEntry }[] = [];
    for (const cat of CATEGORIES)
        for (const entry of cat.entries)
            if (entry.essential) out.push({ cat, entry });
    return out;
}
