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
                summary: 'Dashboard de atividade do servidor (últimos 14 dias).',
                usage: ['rp!status'],
                details: 'Gera gráficos de atividade a partir das mensagens registradas. Aceita um alvo específico (usuário, canal ou OC) pra filtrar o gráfico. A suíte histórica (heatmap, historico, perfil, wrapped, explorar, trending) usa todo o histórico coletado — rode `rp!status docpast` (admin) uma vez pra importar o passado do servidor.',
                subs: [
                    { usage: 'rp!status', desc: 'Dashboard geral de atividade dos últimos 14 dias' },
                    { usage: 'rp!status rank user', desc: 'Top 5 usuários mais ativos (gráfico)' },
                    { usage: 'rp!status rank channel', desc: 'Top 5 canais mais ativos (gráfico)' },
                    { usage: 'rp!status rank words', desc: 'Top 15 palavras mais usadas' },
                    { usage: 'rp!status [@user|#canal|"OC"]', desc: 'Gráfico específico do alvo escolhido' },
                    { usage: 'rp!status heatmap [@user]', desc: 'Mapa de calor dia × hora' },
                    { usage: 'rp!status historico [@user]', desc: 'Linha do tempo mensal de atividade' },
                    { usage: 'rp!status perfil @user', desc: 'Perfil temporal de um usuário' },
                    { usage: 'rp!status wrapped [ano] [@user]', desc: 'Retrospectiva estilo Wrapped' },
                    { usage: 'rp!status explorar', desc: 'Explorador interativo: período × dimensão, Ngram, alvo' },
                    { usage: 'rp!status trending [dia|semana|mes] [DD/MM/AAAA]', desc: 'O que está em alta + momentos quentes' },
                    { usage: 'rp!status docpast [DD/MM/AAAA | reset]', desc: '⚠️ Varre o histórico do servidor (admin) — rodar 2x sem reset DOBRA os números' },
                ],
                keywords: ['estatisticas', 'atividade', 'grafico', 'rank', 'mensagens', 'heatmap', 'wrapped', 'trending', 'historico'],
            },
            {
                id: 'ignorar', name: 'ignorar', emoji: '🙈',
                summary: 'Lista negra de palavras do rank words do rp!status.',
                usage: ['rp!ignorar add|remove|list|clean'],
                subs: [
                    { usage: 'rp!ignorar add [palavra]', desc: 'Para de contar a palavra daqui pra frente' },
                    { usage: 'rp!ignorar remove [palavra]', desc: 'Volta a contar a palavra' },
                    { usage: 'rp!ignorar list', desc: 'Mostra a lista negra atual' },
                    { usage: 'rp!ignorar clean', desc: 'Apaga as palavras bloqueadas também do histórico já contado' },
                ],
                admin: true,
                aliases: ['blockword', 'ignoreword'],
                keywords: ['palavra', 'rank', 'filtro', 'blocklist'],
            },
            {
                id: 'download', name: 'download', emoji: '📥',
                summary: 'Baixa mídia de um link e anexa no canal.',
                usage: ['rp!download [link]'],
                details: 'Aceita links diretos de imagem/vídeo/áudio e páginas de sites de vídeo (TikTok, X/Twitter, YouTube, Reddit...). A mídia é baixada e anexada respeitando o limite de upload do servidor (10/50/100 MB conforme o boost). Links do Instagram e conteúdo restrito podem exigir cookies configurados pelo dono do bot.',
                aliases: ['dl', 'baixar'],
                keywords: ['baixar', 'video', 'tiktok', 'youtube', 'twitter', 'midia', 'salvar'],
            },
            {
                id: 'img', name: 'img', emoji: '🖼️',
                summary: 'Pesquisa imagens na web com navegação por botões.',
                usage: ['rp!img [termo de busca]'],
                details: 'Busca imagens (via DuckDuckGo, SafeSearch ativo) e mostra os resultados um a um com botões de navegação. A imagem é anexada direto no canal.',
                aliases: ['imagem', 'image', 'googleimg'],
                keywords: ['imagem', 'foto', 'buscar', 'pesquisar', 'google'],
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
                id: 'censura', name: 'censura', emoji: '🔇', admin: true,
                summary: 'Censura palavrões sem impedir a mensagem de sair.',
                usage: ['rp!censura on', 'rp!censura'],
                details: 'Com o filtro ligado, mensagens com palavrão (lista padrão em português e inglês) são apagadas e reenviadas via webhook com o nome/avatar do autor, trocando cada letra do termo por █ — o resto da mensagem continua visível. Vale também pra fala de personagem (proxy de OC). A detecção ignora acento, maiúscula e leet (p0rr@ ≡ porra). Reagir ❌ apaga a versão censurada. Requer que o bot tenha Gerenciar Mensagens e Gerenciar Webhooks.',
                subs: [
                    { usage: 'rp!censura on|off', desc: 'Liga/desliga o filtro no servidor' },
                    { usage: 'rp!censura', desc: 'Status: termos ativos, ajustes e canais isentos' },
                    { usage: 'rp!censura add <termo>', desc: 'Adiciona palavra ou frase à lista' },
                    { usage: 'rp!censura remove <termo>', desc: 'Remove termo custom ou desativa um da lista padrão' },
                    { usage: 'rp!censura ignore #canal', desc: 'Alterna isenção do canal (ex: +18/OOC)' },
                    { usage: 'rp!censura test <frase>', desc: 'Simula como uma frase sairia censurada' },
                ],
                aliases: ['censurar', 'filtro', 'palavrao'],
                keywords: ['palavrão', 'xingamento', 'filtro', 'automod', 'bloquear', 'block'],
            },
            {
                id: 'lockdown', name: 'lockdown', emoji: '🔒', admin: true,
                summary: 'Tranca o servidor: todos veem os chats, ninguém fala.',
                usage: ['rp!lockdown on', 'rp!lockdown off'],
                details: 'Com o lockdown ativo, todo mundo continua vendo os canais mas ninguém envia mensagem, reação, enquete, thread nem fala em call. O estado anterior de cada canal é salvo — `off` restaura tudo exatamente como estava. Administradores não são afetados, canais já fechados/ocultos pro @everyone (anúncios, staff) não são tocados, e canal criado durante o lockdown já nasce trancado. Requer que o bot tenha Gerenciar Cargos.',
                subs: [
                    { usage: 'rp!lockdown on|off', desc: 'Tranca o servidor / restaura tudo como estava' },
                    { usage: 'rp!lockdown access @membro', desc: 'Alterna liberação individual (cargo bypass)' },
                    { usage: 'rp!lockdown free #canal', desc: 'Alterna liberação de um canal pra todo mundo' },
                    { usage: 'rp!lockdown status', desc: 'Situação atual: canais trancados, liberados e bypass' },
                ],
                aliases: ['lock'],
                keywords: ['trancar', 'fechar', 'silenciar', 'panico', 'emergencia', 'raid', 'mutar servidor'],
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
                details: 'Sem intervalo, exporta o histórico completo. O bot escaneia os dias com mensagens, processa em paralelo e envia os arquivos HTML **na sua DM**. Exportações grandes pedem confirmação antes de começar.\n\n**Funciona no meu PV também:** como não dá pra mencionar canal por lá, mande o **link** do canal (botão direito no canal → Copiar link) ou o ID. Em qualquer um dos casos você só exporta canais que você mesmo consegue ler.',
                subs: [
                    { usage: 'rp!exportchat <link do canal>', desc: 'No PV — link ou ID no lugar da menção' },
                    { usage: 'rp!export end', desc: 'Cancela o export em andamento' },
                ],
                aliases: ['exportar', 'backupchat'],
                keywords: ['backup', 'html', 'exportar', 'historico', 'transcript', 'pv', 'dm', 'privado'],
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
                    { usage: 'rp!oc info ["Nome"]', desc: 'Info técnica: gatilho, mensagens, grupo, IA, duo' },
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
                    { usage: 'rp!oc wiki emoji ["Nome"] ["Tópico"] [Emoji]', desc: 'Muda o ícone do tópico no menu (padrão ou custom do servidor)' },
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
                id: 'resumo', name: 'resumo', emoji: '📜',
                summary: 'IA resume a história do RP em um período.',
                usage: ['rp!resumo', 'rp!resumo [data] -> [data]'],
                details: 'Lê as mensagens do canal no intervalo informado e devolve páginas navegáveis: 📌 Tópicos, 👥 Ações e Participantes e 📜 Linha do Tempo. O botão 🌟 **Resumo Definitivo** junta tudo numa narrativa só. Sem data, resume as últimas 3 horas. Lê no máximo 1200 mensagens por execução; períodos grandes custam mais de uma requisição da cota de IA — nesse caso o bot pergunta antes. Os botões duram 6h (ou até o bot reiniciar).',
                subs: [
                    { usage: 'rp!resumo', desc: 'Últimas 3 horas do canal atual' },
                    { usage: 'rp!resumo #canal', desc: 'Mesma janela, em outro canal' },
                    { usage: 'rp!resumo DD/MM', desc: 'O dia inteiro (ano atual)' },
                    { usage: 'rp!resumo DD/MM -> DD/MM', desc: 'Intervalo (aceita HH:MM e ano)' },
                    { usage: 'rp!resumo [período] -y', desc: 'Pula a confirmação de custo' },
                    { usage: 'rp!resumo help', desc: 'Ajuda do comando' },
                ],
                aliases: ['resume', 'recap'],
                keywords: ['resumo', 'recap', 'historia', 'resume', 'linha do tempo'],
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
                    { usage: 'rp!oc persona ["Nome"]', desc: 'Escreve a personalidade em várias mensagens (END pra salvar)' },
                    { usage: 'rp!oc insert ["Nome"] [auto]', desc: 'IA começa a observar/falar no canal' },
                    { usage: 'rp!oc auto ["Nome"] [on|off]', desc: 'Modo vivo: responde sozinho no canal (alias: livre)' },
                    { usage: 'rp!oc delay ["Nome"] [segundos]', desc: 'Tempo de espera no modo auto' },
                    { usage: 'rp!oc end', desc: 'Tira o OC com IA do canal' },
                    { usage: 'rp!oc puppet ["Nome"]', desc: 'Desliga a IA (o OC volta a ser manual)' },
                ],
                keywords: ['persona', 'npc', 'automatico', 'inserir', 'auto', 'livre'],
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
                details: 'Funde clubes, monte elencos (na mão ou gerados por IA), defina táticas e simule partidas e torneios completos: pontos corridos, grupos, mata-mata (ida/volta, byes e pênaltis) e sistema suíço, com transição automática de fases. Flags do `match`: `-n` campo neutro, `-r` resultado direto, `-irl [10-60]` partida ao vivo. Flags do `tourney create`: `-ida`, `-turno`, `-grupos N`, `-avanca N`, `-min N`, `-max N`.',
                subs: [
                    { usage: 'rp!futebol match "Time A" "Time B"', desc: 'Simula uma partida' },
                    { usage: 'rp!futebol create "Nome" [emoji]', desc: 'Funda um clube' },
                    { usage: 'rp!futebol add "Nome" [OVR] [emoji] -ai', desc: 'Gera 22 jogadores via IA 🤖' },
                    { usage: 'rp!futebol addplayer "Time" "Jogador" POS OVR', desc: 'Adição rápida de jogador' },
                    { usage: 'rp!futebol player create|view|edit|remove', desc: 'Jogadores customizados com stats FIFA' },
                    { usage: 'rp!futebol squad "Time"', desc: 'Exibe o elenco' },
                    { usage: 'rp!futebol tatic "Time" FORMAÇÃO ESTILO', desc: 'Define a tática' },
                    { usage: 'rp!futebol suggest "Time"', desc: 'IA sugere a melhor tática 🧠' },
                    { usage: 'rp!futebol global "Time" [on|off]', desc: 'Time global: joga torneios de outros servidores 🌍' },
                    { usage: 'rp!futebol list serverlist|userlist', desc: 'Times do servidor / seus times' },
                    { usage: 'rp!futebol tourney create|start "Nome" [FORMATO] [flags]', desc: 'Cria e inicia torneios (ADM)' },
                    { usage: 'rp!futebol tourney view "Nome"', desc: 'Visão geral: fase, rodada atual e chaveamento completo' },
                    { usage: 'rp!futebol join "Torneio" "Time"', desc: 'Inscreve seu time (aceita globais)' },
                    { usage: 'rp!futebol standings "Torneio"', desc: 'Tabela de classificação (por grupo na fase de grupos)' },
                    { usage: 'rp!futebol round sim|next|view "Torneio"', desc: 'Simula, avança rodadas/fases e exibe chaveamento' },
                    { usage: 'rp!futebol admin punish|ban|postpone|resume', desc: 'Tribunal STJD (ADM)' },
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
    // ═══════════════════════════════════════════════════════════════════════
    {
        id: 'economia',
        label: 'Economia & RP',
        emoji: '💰',
        desc: 'Carteira e inventário POR PERSONAGEM (OC) — dinheiro, itens e loja',
        entries: [
            {
                id: 'wallet', name: 'wallet', emoji: '🪙', essential: true,
                summary: 'Carteira de cada OC — dinheiro isolado por personagem e servidor.',
                usage: ['rp!wallet ["Nome"]', 'rp!wallet pay "MeuOC" <valor> "AlvoOC"'],
                details: 'Inspirado no UnbelievaBoat, mas o saldo pertence ao **tupper**, não à conta Discord. Cada OC tem uma carteira por servidor. Sem nome, mostra a carteira do seu único OC (se houver só um).',
                aliases: ['bank', 'saldo', 'money', 'carteira', 'w'],
                subs: [
                    { usage: 'rp!wallet ["Nome"]', desc: 'Mostra o saldo (e itens) do OC' },
                    { usage: 'rp!wallet pay "MeuOC" <valor> "AlvoOC"', desc: 'Transfere dinheiro entre OCs' },
                    { usage: 'rp!wallet top', desc: 'Ranking dos OCs mais ricos do servidor' },
                    { usage: 'rp!wallet economia', desc: 'Painel macroeconômico (M, PIB, inflação, câmbio)' },
                    { usage: 'rp!wallet economia avancada on/off', desc: '⚙️ Staff: liga a simulação de inflação/PIB/dólar' },
                    { usage: 'rp!wallet economia reajuste on/off', desc: '⚙️ Staff: preços da loja acompanham a inflação' },
                    { usage: 'rp!wallet economia dolar <valor>', desc: '⚙️ Staff: define o câmbio fictício→dólar' },
                    { usage: 'rp!wallet add/remove/set "Nome" <valor>', desc: '⚙️ Staff: ajusta saldo' },
                    { usage: 'rp!wallet setcurrency "Nome" <símbolo>', desc: '⚙️ Staff: define a moeda do servidor' },
                ],
                keywords: ['dinheiro', 'saldo', 'banco', 'carteira', 'moeda', 'economia', 'pagar', 'unbelieva', 'unbelievaboat', 'grana', 'inflacao', 'inflação', 'pib', 'dolar', 'dólar', 'cambio'],
            },
            {
                id: 'inventory', name: 'inventory', emoji: '🎒',
                summary: 'Mochila de cada OC e loja do servidor — itens por personagem.',
                usage: ['rp!inventory ["Nome"]', 'rp!inventory buy "SeuOC" "item" [qtd]'],
                details: 'Cada OC tem sua própria mochila, **por servidor** — mas o personagem pode viajar: `rp!levar` **move** (não copia) itens pra outro servidor onde o OC tem mochila (use `rp!bag` lá uma vez pra registrar o destino). Há dois tipos de item: **de loja** (a staff cria com `additem`, têm preço, dá pra comprar/vender) e **pessoais** (você mesmo cria com `add` — coisas de RP como uma carta, um amuleto, a espada do pai; sem preço, fora da loja, mas dá pra dar/usar/descartar). Itens pessoais aparecem com ✎ na mochila e viajam intactos; itens de loja que o destino não conhece viram pessoais; `tradable: false` não viaja; o saldo nunca viaja (cada servidor tem sua moeda). O emoji do item pode ser padrão **ou personalizado do servidor** — é só colar o emoji custom no lugar.',
                aliases: ['inv', 'bag', 'mochila', 'itens', 'i'],
                subs: [
                    { usage: 'rp!inventory ["Nome"]', desc: 'Lista a mochila do OC (✎ = item pessoal)' },
                    { usage: 'rp!levar ["OC"]', desc: 'Move a mochila INTEIRA pra outro servidor (menu de escolha)' },
                    { usage: 'rp!levar "item" [qtd] "OC"', desc: 'Move só um item pra outro servidor (qtd omitida = tudo)' },
                    { usage: 'rp!inventory onde ["OC"]', desc: 'Em quais servidores o OC tem mochila (só o dono vê)' },
                    { usage: 'rp!inventory add "MeuOC" "Nome do item" [qtd] [emoji]', desc: 'Cria um item PESSOAL na sua mochila (RP)' },
                    { usage: 'rp!inventory drop "MeuOC" "item" [qtd]', desc: 'Descarta um item da mochila' },
                    { usage: 'rp!inventory give "MeuOC" "item" [qtd] "AlvoOC"', desc: 'Dá um item (de loja ou pessoal) pra outro OC' },
                    { usage: 'rp!inventory use "Nome" "item"', desc: 'Consome 1 unidade do item' },
                    { usage: 'rp!inventory shop', desc: 'Mostra a loja do servidor' },
                    { usage: 'rp!inventory buy "SeuOC" "item" [qtd]', desc: 'Compra um item da loja' },
                    { usage: 'rp!inventory sell "SeuOC" "item" [qtd]', desc: 'Vende um item de loja de volta (50%)' },
                    { usage: 'rp!inventory additem "Nome" <preço> [emoji] ["desc"]', desc: '⚙️ Staff: cria item na loja' },
                    { usage: 'rp!inventory edititem/removeitem/giveitem/takeitem', desc: '⚙️ Staff: gerencia catálogo e mochilas' },
                ],
                keywords: ['inventario', 'inventário', 'mochila', 'item', 'itens', 'loja', 'shop', 'comprar', 'vender', 'bag', 'unbelieva', 'pessoal', 'anotar', 'criar item', 'descartar', 'drop', 'levar', 'transferir', 'transferencia', 'transferência', 'viajar', 'mudar de servidor', 'onde', 'outro servidor'],
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
