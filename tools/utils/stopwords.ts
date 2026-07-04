// RPTool/tools/utils/stopwords.ts
// ─── Stopwords PT-BR (palavras funcionais) ────────────────────────────────────
// Fonte ÚNICA para a coleta de estatísticas de palavras (commandCheckout + backfill).
// Filtra artigos, preposições, contrações, pronomes, conjunções, advérbios
// funcionais e formas comuns de ser/ter/estar/ir/fazer — para que o ranking de
// palavras mostre conteúdo de verdade, e não "que", "para", "uma"...
// As palavras já chegam em minúsculas e com acentos preservados.
export const STOPWORDS = new Set<string>([
    // Artigos
    'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
    // Preposições
    'de', 'em', 'por', 'para', 'pra', 'pro', 'pras', 'pros', 'com', 'sem', 'sob', 'sobre',
    'entre', 'até', 'ate', 'após', 'apos', 'ante', 'contra', 'desde', 'perante', 'trás', 'tras',
    'conforme', 'durante', 'mediante', 'segundo',
    // Contrações
    'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'ao', 'aos', 'à', 'às',
    'pelo', 'pela', 'pelos', 'pelas', 'num', 'numa', 'nuns', 'numas',
    'dum', 'duma', 'duns', 'dumas',
    'neste', 'nesta', 'nestes', 'nestas', 'nesse', 'nessa', 'nesses', 'nessas',
    'naquele', 'naquela', 'naqueles', 'naquelas', 'nisto', 'nisso', 'naquilo',
    'deste', 'desta', 'destes', 'destas', 'desse', 'dessa', 'desses', 'dessas',
    'daquele', 'daquela', 'daqueles', 'daquelas', 'disto', 'disso', 'daquilo',
    'dele', 'dela', 'deles', 'delas', 'nele', 'nela', 'neles', 'nelas', 'dela',
    // Pronomes
    'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'vos', 'eles', 'elas',
    'me', 'te', 'se', 'lhe', 'lhes', 'mim', 'ti', 'si',
    'comigo', 'contigo', 'consigo', 'conosco', 'convosco',
    'meu', 'minha', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas',
    'seu', 'sua', 'seus', 'suas', 'nosso', 'nossa', 'nossos', 'nossas', 'vosso', 'vossa',
    'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas',
    'aquele', 'aquela', 'aqueles', 'aquelas', 'isto', 'isso', 'aquilo',
    'mesmo', 'mesma', 'mesmos', 'mesmas', 'próprio', 'propria', 'próprios', 'próprias',
    'que', 'quem', 'qual', 'quais', 'cujo', 'cuja', 'cujos', 'cujas',
    'onde', 'quando', 'quanto', 'quanta', 'quantos', 'quantas', 'como',
    // Conjunções
    'e', 'ou', 'mas', 'porém', 'porem', 'contudo', 'todavia', 'entretanto',
    'porque', 'porquê', 'pois', 'embora', 'conquanto', 'caso', 'portanto',
    'então', 'entao', 'assim', 'nem', 'ora', 'logo',
    // Advérbios funcionais
    'não', 'nao', 'sim', 'já', 'ja', 'ainda', 'sempre', 'nunca', 'jamais', 'talvez',
    'muito', 'muita', 'muitos', 'muitas', 'mais', 'menos', 'bem', 'mal', 'demais',
    'bastante', 'tão', 'tao', 'tanto', 'tanta', 'tantos', 'tantas',
    'aqui', 'ali', 'lá', 'la', 'aí', 'ai', 'acolá', 'cá', 'ca',
    'hoje', 'ontem', 'amanhã', 'amanha', 'agora', 'antes', 'depois', 'cedo', 'tarde',
    'apenas', 'só', 'so', 'somente', 'também', 'tambem', 'inclusive', 'sobretudo',
    // Ser / Estar / Ter / Haver / Ir / Fazer / Poder / Querer / Ver / Dizer (formas comuns)
    'é', 'foi', 'fui', 'ser', 'sou', 'somos', 'são', 'sao', 'era', 'eram', 'será', 'serão', 'serao',
    'sendo', 'sido', 'seja', 'sejam',
    'estar', 'está', 'esta', 'estou', 'estás', 'estamos', 'estão', 'estao',
    'estava', 'estavam', 'esteve', 'estive', 'estiver',
    'ter', 'tem', 'têm', 'tenho', 'tens', 'temos', 'tinha', 'tinham', 'teve', 'tive', 'tido', 'tendo',
    'haver', 'há', 'ha', 'houve', 'havia', 'haviam',
    'ir', 'vou', 'vai', 'vamos', 'vão', 'vao', 'ia', 'iam', 'foram',
    'fazer', 'faz', 'faço', 'faco', 'fez', 'fazem', 'fazia',
    'poder', 'pode', 'podem', 'posso', 'pode', 'podia', 'pôde', 'pude',
    'querer', 'quer', 'quero', 'queria', 'querem',
    'ver', 'vê', 've', 'vejo', 'viu', 'vem', 'vir', 'vinha',
    'dizer', 'diz', 'disse', 'dizem',
    'dar', 'dá', 'dou', 'deu', 'dão', 'dao',
    // Ruídos comuns de chat
    'pq', 'vc', 'vcs', 'tbm', 'tb', 'pfv', 'msm', 'oi', 'olá', 'ola', 'rs', 'kk', 'kkk', 'kkkk',
]);
