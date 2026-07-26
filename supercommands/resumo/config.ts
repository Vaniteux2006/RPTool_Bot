// RPTool/supercommands/resumo/config.ts
// ─── Constantes e limites do ecossistema de resumo ───────────────────────────
// Tudo que é "número mágico" mora aqui, com o porquê de cada valor.

// Teto de mensagens puxadas do Discord por execução.
export const MAX_MENSAGENS = 1200;

// Teto de caracteres por requisição à IA — é isto que segura o custo em 1 requisição.
// Medido com 1200 mensagens (o teto do fetch), a ~3,5 chars/token em português:
//   mensagens curtas/mistas → 1 req | RP típico (~400c) → 1 req (~142k tokens)
//   prosa longa (~800c) → 2 req | extremo (~1900c) → 4 req
// Subir para 1.5M fecharia tudo em 1-2 req, mas geraria requisições de ~650k tokens,
// que arriscam o limite de tokens/minuto e a latência. 600k é o ponto de equilíbrio.
export const MAX_CHARS_POR_BLOCO = 600_000;

// Limites do Discord: 1024 por field, 4096 por description, 6000 por embed.
export const LIMITE_FIELD = 1024;
export const LIMITE_DESCRIPTION = 4096;
export const LIMITE_EMBED = 6000;

// Itens (tópicos / ações) por página de embed.
export const MAX_ITENS_POR_PAGINA = 30;

// Escada de espera do retry. O comando é "manda e esquece", então o retry segue
// infinito para erros transitórios — só deixa de martelar de 5 em 5 segundos.
export const ESCADA_BACKOFF = [5, 10, 30, 60];

// Quanto tempo uma sessão de paginação continua clicável (ver interactions.ts).
export const TTL_SESSAO_MS = 6 * 60 * 60 * 1000;

// Tempo de espera do clique de confirmação antes de cancelar por segurança.
export const TIMEOUT_CONFIRMACAO_MS = 120_000;

// Tokens que pulam a confirmação de custo (ex.: rp!resumo 15/03 -y).
export const TOKENS_PULAR = new Set(['-y', '--sim', 'sim', 'confirmar']);

// Subcomando de ajuda. Sem isto, "help" cairia no parser de data e viraria
// silenciosamente "últimas 3 horas".
export const TOKENS_AJUDA = new Set(['help', 'ajuda', 'h', '?']);

// Janela padrão quando nenhuma data é informada.
export const JANELA_PADRAO_MS = 3 * 60 * 60 * 1000;
