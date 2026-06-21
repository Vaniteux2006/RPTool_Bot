# 📖 Documentação Técnica — RPTool

> Gerada em 11/06/2026 a partir da leitura do código-fonte (branch `main`, commit `b251e61`).
> Cobre: arquitetura, função de cada arquivo, padrões usados, duplicações, código morto e recomendações.
>
> **Atualizada em 21/06/2026** após a sessão de correções dos problemas críticos (ver §0).

---

## 0. Atualização 21/06/2026 — Problemas críticos corrigidos

Todos os P0 do §13 foram resolvidos nesta sessão. Resumo (detalhes nas seções):

- **Logs religados** — `LogConfig` movido para a `mainConnection` (era a conexão default, nunca conectada). O sistema de logs inteiro voltou a funcionar. (§4.1)
- **Handlers órfãos reconectados** ao `EventCheckout.onMessageCreate`:
  - `oc:proxy` → `tools/webhook.ts` (proxy de OC/tupper);
  - `oc:ai` → `tools/utils/aiUtils.ts` (IA de OC) + `await` corrigido;
  - `phone:relay` → `supercommands/phone` (mensagens da chamada). (§11.1)
- **IA de OC completa** — `activeChannelId` agora é setado ao ativar; `autoMode` ganhou comando (`rp!oc auto`) e lógica de disparo "menção + periódico" com cooldown; `persona` reativado. (§9.1)
- **Conflito tempo/clima resolvido** — `commands/time.ts` e `commands/clima.ts` (antigos) **deletados**; o boot inicia o motor novo `startClockEngine`. Model `Clock` agora só tem o schema novo (com `guildId`/`paused`). (§11.2)
- **`status` virou supercommand** (`supercommands/status/`) com shim em `commands/`. Ganhou: layout estilo Statbot (14 dias), 4 rankings paginados + modal "Ranking do Dia" (`interactions.ts`), backfill do passado `rp!status docpast` (`handlers/backfill.ts`), e coleta de OCs por webhook (novo campo `ocs` no `ServerStats`). (§7, §9)
- **Coleta de stats** — `command_checkout` agora conta mensagens de webhook (OCs: RPTool/Tupperbox/PluralKit) no campo `ocs`; `webhook.ts` parou de poluir `users` com `_id` de OC.

Pendências conhecidas que **permanecem**: `events/` morta, `dist/`/`stockfish` no git, versão dessincronizada, `cleanWrapper` bugado, retry 503 infinito em `ai.ts`/`resenha.ts`, conexões Mongo duplicadas.

---

## 1. Visão Geral

O RPTool é um bot de Discord (discord.js v14) focado em servidores de Roleplay, escrito em **TypeScript executado via ts-node** (sem build em produção — o `loader.js` registra o `ts-node/register` e puxa o `index.ts` direto). Persistência em **MongoDB via Mongoose**, com várias conexões separadas por domínio. IA via **Google Gemini e OpenAI**, com chaves por usuário/servidor.

O projeto tem **três camadas de comandos**:

| Camada | Pasta | O que é |
|---|---|---|
| Comandos simples | `commands/` | Um arquivo = um comando (`rp!x` e às vezes `/x`) |
| Supercomandos | `supercommands/<nome>/` | Ecossistemas com `index.ts` (roteador) + `handlers/` (subcomandos) |
| Subscribers de evento | `EventCheckout.onX(...)` | Qualquer módulo se inscreve em eventos do Discord ao ser importado |

---

## 2. Fluxo de Boot

```
node loader.js
 └─ require('ts-node/register') + require('./index.ts')
     ├─ chmod no binário do Stockfish (caminho fixo /home/node/stockfish — só faz sentido no Discloud)
     ├─ new Client(...) com 16 intents (documentados inline, incluindo os privilegiados)
     ├─ 1º: carrega supercommands/*/index.ts  → client.commands.set(name, cmd)
     ├─ 2º: loadCommands('commands/')          → client.commands.set(name, cmd)
     │       └─ se cmd.data && cmd.executeSlash → entra no commandsArray (deploy de slash)
     │       ℹ️ comandos de `commands/` SOBRESCREVEM supercomandos de mesmo nome — usado de propósito
     │          nos shims (help, logs, status) que delegam pro supercommand e existem só pro deploy de slash
     ├─ initEventCheckout(client)              → client.on(evento) → dispatch() p/ registry
     ├─ ClientReady:
     │    ├─ rotação de status a cada 15s (BotStatusModel, suporta {version})
     │    ├─ startClockEngine(client)  ✅ inicia o motor NOVO de relógios (supercommands/tempo/clockEngine)
     │    └─ REST.put → registra os slash commands globalmente
     ├─ InteractionCreate: runInteractionChecks (ficha_/fb_) → roteia slash
     └─ messageCreate: runSystemChecks → anti-spam (8 cmds/10s → cooldown 30s) → roteia rp!
```

**Anti-spam de prefixo:** janela de 10s, 8 comandos por guild → 30s de cooldown para a guild inteira. Implementado com dois `Map`s em memória no `index.ts`.

---

## 3. Arquitetura de Eventos — `EventCheckout`

`tools/event_checkout.ts` é o coração do projeto e o padrão mais bem executado:

- **Registry interno**: `Map<evento, {name, fn}[]>`. `subscribe()` deduplica por nome.
- **API tipada**: `EventCheckout.onMessageCreate(name, fn)`, `onGuildMemberAdd(...)` etc. — um wrapper por evento do Discord, agrupados por intent com comentários (`// ── GUILD_MESSAGES (1<<9) ──`).
- **initEventCheckout(client)**: faz o bind de ~55 eventos do client para o `dispatch()` interno. Eventos sem enum no djs v14 (integrations, soundboard) usam string literal — documentado.
- **Auto-inscrição**: cada módulo chama `EventCheckout.onX()` no escopo do arquivo. Carregar o arquivo = registrar o handler. Apagar o arquivo = registro some. Nenhuma alteração no `index.ts` é necessária.

Quem usa hoje (handlers efetivamente registrados):
- `commands/42.ts` → easter egg em MessageCreate
- `commands/welcome.ts` → welcome:join / welcome:leave (com detecção de kick/ban via audit log)
- `commands/autorole.ts` → autorole em GuildMemberAdd
- `tools/reactionListener.ts` → reaction roles (add/remove)
- `tools/command_checkout.ts` → `__system.checkout` (estatísticas + rotinas)
- `supercommands/ficha/index.ts` → ficha:autodetect
- `supercommands/logs/events/*` → ~40 handlers de log

⚠️ **Atenção**: os arquivos de `events/` também chamam `EventCheckout.onX()`, mas **nunca são carregados** (ver §8).

---

## 4. Banco de Dados

### 4.1 Conexões

Hoje existem **15 chamadas a `mongoose.createConnection()`** espalhadas pelo projeto, várias para a MESMA URI:

| Env var | Criada em | Observação |
|---|---|---|
| `DB_OC` | `tools/database.ts` (`OCConnection`) | OCs (leve) |
| `DB_OC_WIKI` | `tools/database.ts` (`WikiConnection`) | Wiki de OCs (pesada) |
| `DB_RESTANTE` | `database.ts` (`mainConnection`), `database.ts` (`restanteConnection`, **não exportada**), `Outros.ts`, `TokenSchema.ts`, `GuildConfig.ts`, `KanbanSchema.ts`, `BirthdaySchema.ts` | **7 conexões duplicadas para o mesmo banco** |
| `DB_STATUS` | `ServerStats.ts`, `AnalyticsSchema.ts` | 2 conexões |
| `DB_FICHA` | `FichaSchema.ts`, `ReactionRoleSchema.ts` | 2 conexões |
| `DB_FB_USER` | `FutebolSchema.ts` | futebol |
| `DB_FB_REPORT` | `FutebolReportSchema.ts` | relatórios de partida |

✅ **Corrigido (21/06):** `tools/models/LogConfig.ts` agora usa a `mainConnection` (antes usava a conexão default do mongoose, e `mongoose.connect()` nunca era chamado → toda query do `LogModel` ficava em buffer e estourava timeout, fazendo o `LogMinister.for()` retornar `null` e o sistema de logs falhar em silêncio). Logs voltaram a funcionar.

**Recomendação remanescente:** centralizar TODAS as conexões em `tools/database.ts` (uma por URI) e importar de lá nos models.

### 4.2 Models

| Model | Arquivo | Conexão | Usado por |
|---|---|---|---|
| `OCModel`, `WikiModel` | `OCSchema.ts` | DB_OC / DB_OC_WIKI | oc/*, webhook, aiUtils, status |
| `TokenModel` | `TokenSchema.ts` | DB_RESTANTE | token, tokenHelper |
| `WelcomeModel`, `BotStatusModel`, `WikiArticleModel`, `PhoneRegistryModel` | `Outros.ts` | DB_RESTANTE | welcome, index, phone (⚠️ `WikiArticleModel` não é usado — `fatos.ts` usa array hardcoded) |
| `ServerStats`, `BlockedWordsModel` | `ServerStats.ts` | DB_STATUS | command_checkout (humanos + OCs via webhook no novo campo `ocs`), status (rankings/docpast), ignorar |
| `BirthdayModel`, `BirthdayConfigModel` | `BirthdaySchema.ts` | DB_RESTANTE | birthday |
| `KanbanItemModel`, `KanbanPainelModel` | `KanbanSchema.ts` | DB_RESTANTE | kanban |
| `AutoroleModel` | `AutoroleConfig.ts` | DB_RESTANTE | autorole |
| `ReactionRoleModel` | `ReactionRoleSchema.ts` | DB_FICHA | reaction, reactionListener |
| `ClockModel` | `ClockSchema.ts` | mainConnection | tempo, clima (✅ schema único — os antigos `commands/time.ts`/`clima.ts` foram deletados) |
| `LogModel` | `LogConfig.ts` | ✅ mainConnection | logs |
| `GuildConfigModel` | `GuildConfig.ts` | DB_RESTANTE | só o `tools/utils/LogMinister.ts` antigo (morto) |
| `FichaModel`, `TemplateModel` | `FichaSchema.ts` | DB_FICHA | ficha |
| `TeamModel` etc. | `FutebolSchema.ts` | DB_FB_USER | futebol |
| `MatchReportModel` | `FutebolReportSchema.ts` | DB_FB_REPORT | futebol |
| `MessageModel`, `JoinModel`, `VoiceModel` | `AnalyticsSchema.ts` | DB_STATUS | só `analytics.ts` (morto) |

---

## 5. Raiz do Projeto

| Arquivo | Função | Estado |
|---|---|---|
| `loader.js` | Entry point: `ts-node/register` + `require('./index.ts')` | OK |
| `index.ts` | Client, intents, loaders, anti-spam, roteamento (ver §2) | Bem comentado |
| `package.json` | Deps. **Versão diz 1.4.0** (commits estão em 1.5.14) | Desatualizado |
| `tsconfig.json` | `strict: false`, CommonJS, allowJs | `strict` desligado mascara bugs (ver §11.4) |
| `discloud.config` | Deploy no Discloud (`node loader.js`, 4 GB RAM) | OK |
| `stockfish` | Binário Linux de **40 MB versionado no git** | Deveria ser baixado no deploy, não versionado |
| `dist/` | Build antigo de TS. Está no `.gitignore`, **mas 53 arquivos continuam trackeados** (foram commitados antes do ignore) | Lixo no repositório — `git rm -r --cached dist` |
| `readme.md` | Descrição geral, instalação | Desatualizado (estrutura antiga, sem supercommands; cita `DISCORD_TOKEN`, o código usa `xdTOKEN`) |

---

## 6. `tools/` — Núcleo

### Infraestrutura ativa

| Arquivo | O que faz |
|---|---|
| `event_checkout.ts` | Dispatcher pub/sub central (ver §3). ⭐ Melhor arquivo do projeto. |
| `command_checkout.ts` | Registra `__system.checkout` no MessageCreate: coleta estatísticas de **humanos** (users/channels/words) e de **OCs via webhook** (`trackWebhookStats` → campo `ocs`, por nome) no `ServerStats`, e inicializa a rotina horária de aniversários. Importa os módulos auto-registráveis (`42`, `roll`, `phone`, `tempo`, `webhook`, `utils/aiUtils`) — ✅ agora todos com `EventCheckout.onX` de fato. |
| `interaction_checkout.ts` | Roteia botões/modais por prefixo de `customId`: `ficha_` → ficha, `fb_` → futebol, `stats_` → status (rankings/modal). Hardcoded — poderia usar `EventCheckout.onInteractionCreate` (que existe e ninguém usa). |
| `database.ts` | 4 conexões (uma duplicada e não exportada). Ver §4.1. |
| `api.ts` | Classe `RPToolAPI` (singleton `api`): `chat()` (prompt de persona p/ NPC) e `generateRaw()`. Suporta Gemini (SDK oficial, safety OFF) e OpenAI (fetch direto). |
| `tokenHelper.ts` (`utils/`) | `getGuildAIConfig(guildId)`: resolve a chave de IA do servidor via `TokenModel` (assignments), com fallback para `GEMINI_API_KEY` do `.env` (modelo hardcoded `gemini-3-flash-preview`). |
| `reactionListener.ts` | Reaction roles: busca `ReactionRoleModel` por messageId+emoji e dá/tira cargo. Auto-inscrito no EventCheckout. |
| `ReturnVersion.ts` | Lê `tools/Data/version.json` → **arquivo não existe** → sempre retorna o fallback `"1.5.1"`. |
| `HtmlTranscript.ts` | Gerador de transcript HTML (escape, markdown inline, chunking de 7,5 MB). Compartilhado entre `exportchat` e `logs` (bulk delete). Cabeçalho avisa do acoplamento. |
| `check_models.ts` | Script CLI avulso: lista modelos Gemini disponíveis para a chave do `.env`. Não é carregado pelo bot (não exporta comando). |
| `interfaces/Command.ts` | Interface `Command` ({name, description, aliases?, data?, executeSlash?, execute}). ⚠️ Só 3 comandos a usam (`kanban`, `reaction`, `ignorar`, `resume`); o resto exporta objeto literal sem tipo. |
| `types.d.ts` | `declare module 'stockfish'` (1 linha). |

### Código morto / órfão em `tools/`

| Arquivo | Situação |
|---|---|
| `webhook.ts` (`handleOCMessage`) | ✅ **Religado (21/06):** registra `oc:proxy` no `EventCheckout.onMessageCreate` (carregado via `command_checkout`). O proxy de OC (prefixo → webhook com nome/avatar) voltou a funcionar. Também parou de gravar `users.${oc._id}` no `ServerStats` (agora os OCs contam no campo `ocs`). |
| `utils/aiUtils.ts` (`handleAIMessage`, `triggerAIGeneration`) | ✅ **Religado (21/06):** registra `oc:ai`; `await getGuildAIConfig()` corrigido; `autoMode` reescrito (menção + periódico com cooldown). Ver §9.1. |
| `messageTracker.ts` | Tracker de estatísticas ANTIGO (com suporte a blocklist). Substituído pelo `trackMessageStats` do `command_checkout`, **que não consulta a blocklist**. Só o `loadBlockedWords` ainda é usado (pelo `rp!ignorar`). |
| `analytics.ts` | Coletor + dashboard em canvas, inacabado (comentário "COLA O RESTO DO CÓDIGO DO CANVAS DO IVANOL AQUI"). Nunca importado. Importa `canvas`, **que nem está no package.json** — se alguém importar, crasha. |
| `utils/LogMinister.ts` | Versão antiga do LogMinister (usa `GuildConfigModel`). Nunca importado — a versão ativa é `supercommands/logs/utils/LogMinister.ts`. |
| `utils/ocHandlers.ts` | `handleCreate`/`handleDelete` antigos de OC. Nunca importados (os ativos estão em `supercommands/oc/handlers/`). |
| `utils/eventLoader.ts` | `loadEventSubscribers()` para carregar `events/` — **nunca é chamado**. |

### `tools/utils/` ativos

| Arquivo | Funções |
|---|---|
| `textUtils.ts` | `sanitizeOutput` (neutraliza @everyone/@here/cargos), `extractArgs` (split respeitando aspas), `extractName` (nome entre aspas + resto), `formatLongContent` (>1024 chars → anexo .txt), `cleanWrapper` ⚠️ (bug: `str.startsWith('')` é sempre `true` → corta o primeiro e último caractere de QUALQUER string; só o `ocHandlers` morto usa, mas é uma mina esperando pisada). |
| `reading.ts` | `parseWikiText` (extrai `[[refs]]`), `readLongText` (paginador de embed >4096 chars com botões ⬅️➡️, coletor de 5 min). Usado pela wiki de OC. |

---

## 7. `commands/` — Comandos Simples

Convenção dominante: `export default { name, description, aliases?, data?, executeSlash?, execute }`. Comandos com slash costumam montar um **`fakeMessage`** (objeto que finge ser `Message` com `reply` redirecionado pra interaction) e delegar pro `execute` — padrão repetido em ~8 arquivos (candidato nº 1 a universalização, ver §12).

| Comando | Aliases | Slash | O que faz | Notas |
|---|---|---|---|---|
| `42` | — | ❌ | Easter egg: responde "42" à Pergunta Fundamental | Modelo exemplar de subscriber do EventCheckout |
| `ai` | — | ✅ | Chat avulso com a IA do servidor | Retry **infinito** para 503 (sem limite de tentativas); tratamento rico de 429/quota |
| `autorole` | — | ✅ (subcommands) | Cargos automáticos na entrada | Lógica `giveRole` separada do comando — bom padrão |
| `ban` | — | ✅ | Ban por menção ou ID com confirmação por botões | Fluxo de confirmação duplicado com `kick` |
| `birthday` | niver, eventos, calendario | ❌ | Aniversários/eventos com painel auto-atualizável (rotina horária) | Suporta cadastro em lote `{ DD/MM -> nome }`; timezone resolvida na mão (`-3h`) |
| `chess` | — | ✅ | Xadrez vs Stockfish (spawn do binário, UCI, skill 5) | Singleton `ChessBot`; depende do binário na raiz/`/home/node` |
| `clear` | limpar, clean | ✅ | Bulk delete 1–100 | OK |
| `console` | — | ❌ | Executa JS na sandbox remota Piston (timeout 3s) | Execução é remota — seguro |
| `fatos` | — | ❌ | "Maratona de cultura": spamma N parágrafos de artigos hardcoded no PV/canal do alvo | 26 KB sendo ~240 linhas de dados hardcoded (`wikiData`) — o `WikiArticleModel` do banco existe e não é usado |
| `helloworld` | ping, test | ✅ | Ping/latência | Primeiro comando do projeto |
| `help` | ajuda, comandos | ✅ | **Shim** → `supercommands/help` | Existe porque só `commands/` entra no deploy de slash; padrão documentado |
| `ignorar` | blockword | ❌ | Blocklist de palavras das estatísticas + purge retroativo (`clean` com `$unset`) | ⚠️ A blocklist só era consultada pelo tracker antigo morto; o tracker ativo ignora ela (só o `clean` tem efeito real) |
| `kanban` | kb, tasks | ❌ | Quadro TODO/DOING/DONE com painel fixo auto-atualizável | Limpa registro se o painel for apagado à mão |
| `kick` | — | ✅ | Kick com confirmação por botões | Duplicado com `ban` |
| `logs` | log, auditoria... | ❌ | **Shim** → `supercommands/logs` | OK |
| `math` | — | ✅ | Wolfram Alpha (resultado + gráfico) | Rotaciona tokens de `WOLFRAM_IDS`; `sendReply` é um mini-adaptador message/interaction |
| `mute` / `unmute` | — | ✅ | Timeout flexível (`parseDuration` aceita "10 minutos", "1d", "mês") | `parseDuration` é local — útil em outros lugares |
| `não` | nao, no, nein... | ❌ | Desculpa aleatória do no-as-a-service, traduzida pra PT | Diversão |
| `reaction` | reactionrole, rr | ❌ | Configura reaction role | Execução fica no `reactionListener` |
| `resenha` | — | ✅ | IA julga se o chat está em caos (r-01) ou paz (r-00) | Retry 503 infinito; `sanitizeOutput` duplicado local |
| `resume` | — | ❌ | Resumo de RP por IA com filtro por data (converte data → snowflake) e paginação | Tem o **3º cliente de IA do projeto** (`chamarIAResumo`); `sanitizeOutput` duplicado |
| `roll` | — | ✅ | Dados de RPG (XdY±Z, até 50.000 dados), cores pra nat 20/1 | Footer hardcoded "RPTool v1.4"; URL de avatar do CDN do Discord com token de expiração (vai quebrar) |
| `serverinfo` / `userinfo` | — | ✅ | Embeds de info (server por ID inclusive; rank de antiguidade do membro) | Footers hardcoded "v1.4.1"; fakeMessage |
| `status` (shim) | stats, dashboard, rank | ✅ | **Movido para `supercommands/status/`** — shim só pro deploy de slash. Dashboard 14 dias + rankings paginados + `docpast`. Ver §9.9 | Maior consumidor do `ServerStats` |
| `token` | — | ❌ | Painel completo de chaves de IA via DM (add/del/rename/assign por servidor, validação da chave, listagem de modelos) | Bem completo; chaves em texto plano no Mongo |
| `unban` | — | ✅ | Unban por ID | OK |
| `version` | creditos, credits, info | ✅ | Versão + créditos | Usa `ReturnVersion` (que sempre retorna o fallback, ver §6) |
| `welcome` | boasvindas, setwelcome | ✅ (stub) | Mensagens de entrada/saída/kick/ban com `{user}/{server}/{count}`, cor pela média do avatar | Distingue kick/ban via audit log dos últimos 5s |

---

## 8. `events/` — 🔴 Pasta Morta

Os 13 arquivos (`memberEvents`, `messageEvents`, `guildEvents`, ...) são "subscriber registrars" que chamam `EventCheckout.onX()` ao serem importados. **Porém ninguém os importa**: o `loadCommands()` só varre `commands/`, e o `loadEventSubscribers()` do `eventLoader.ts` nunca é chamado no `index.ts`.

Consequências:
- A maioria registra handlers **vazios** ("Slot reservado") — sem perda funcional.
- `memberEvents.ts` contém uma **cópia completa** da lógica de welcome + autorole. Como os arquivos ativos (`commands/welcome.ts`, `commands/autorole.ts`) já se registram sozinhos, **é bom que a pasta não carregue** — se alguém chamar o `loadEventSubscribers()` um dia, as mensagens de boas-vindas sairão **duplicadas**.
- `reactionEvents.ts` re-registra `reactionRole` (deduplicado pelo nome no registry, então seria inócuo).

**Recomendação:** deletar a pasta `events/` e o `eventLoader.ts`, ou esvaziá-los de vez. Hoje só confundem.

---

## 9. `supercommands/` — Ecossistemas

Padrão comum (e bom): `index.ts` com roteador `switch` + `sendHelp()`, handlers em arquivos separados, cabeçalho de comentário explicando a arquitetura, `try/catch` no roteador com log `[Nome]`.

### 9.1 `oc/` — Personagens (Tupper)
- `index.ts`: roteia ~25 subcomandos para `handlers/` (CRUD: create, delete, rename, avatar, group, export/import JSON, list, edit, prefix, purge), `ai/` (persona, memórias, gaslight/forget/insert, delay, end, puppet), `social_handlers/` (duo, solo, birthday, info) e `wiki/` (add, edit, emoji, extra, gallery, intro, ref, remove, view — view com paginação e navegação por `[[links]]`).
- Easter egg: 5 `rp!oc` vazios seguidos → cria o OC "Nosferatu".
- `utils.ts`: `extractName`/`cleanWrapper` próprios (versões CORRETAS, diferentes das de `textUtils.ts`).
- ✅ **Religado (21/06):** o proxy de webhook (OC "falar") e a IA de OC voltaram a funcionar. A IA ganhou `autoMode` real (`rp!oc auto "Nome" [on/off]`), `activeChannelId` setado ao ativar, `persona` reativado, `delay` aceitando minutos, e disparo **menção + periódico** com cooldown (lê a conversa e participa sozinho). Ver §11.1.

### 9.2 `logs/` — Auditoria
- `index.ts`: importa 17 arquivos de `events/` (auto-inscrição), define `LOG_CATEGORIES` (11 padrão + 2 opt-in: reactions, polls), comandos `set/on/off/status/cat/test`.
- `utils/LogMinister.ts`: classe com factory `LogMinister.for(guild)` → null se desativado; `allows(categoria)`; `send/sendWithFiles/sendMany/sendText`; paleta `LogColor`. **Padrão exemplar.**
- `events/*.ts`: um arquivo por domínio (Member, Message, Guild, Moderation, Voice, Invite, Integration, Expression, AutoMod, Poll, Reaction, Pins, Stage, Lifecycle, VoiceEffect, ScheduledEvent). Bulk delete gera transcript HTML via `HtmlTranscript`.
- 🔴 Tudo isso está **inoperante por causa do `LogConfig` na conexão default desconectada** (§4.1).

### 9.3 `help/` — Central de Ajuda
- `registry.ts` (37 KB): TODO o conteúdo (categorias → entries → subcomandos, keywords). Editar o help = editar só este arquivo. Bem separado.
- `search.ts`: normalização de acentos + scoring. `views.ts`: renderizadores (home/categoria/comando/busca). `index.ts`: collector de botões/menus + modal de pesquisa, dono da mensagem protegido.
- Exposto via shim `commands/help.ts` (necessário pro deploy de slash).

### 9.4 `ficha/` — Fichas de Personagem
- Fluxo: admin define `template` (até 10 perguntas via DM), `check`/`show`/`submit` definem canais; jogador faz `rp!ficha new [+oc]` na DM; ficha vai pro canal de aprovação com botões.
- `interactions.ts`: aprovar/rejeitar (modal de motivo), aprovação com `+oc` **cria o OC automaticamente**.
- `handlers/autodetect.ts`: registrado no MessageCreate — detecta fichas postadas direto no canal de submit.
- Botões roteados pelo `interaction_checkout` (prefixo `ficha_`).

### 9.5 `futebol/` — Simulador de Futebol
- O maior ecossistema. `index.ts` roteia: match, create/delete team, addplayer/player, squad, tactics/suggest, emoji, list, tourney/join/standings, round (sim/next/view), admin (punish/ban/postpone), history, io (export/import).
- `engines/`: `matchEngine.ts` (33 KB — simulação minuto a minuto com narração, cartões, stats, modo IRL com segundos por minuto), `mathEngine.ts` (ratings/macros dos jogadores), `aiDirector.ts` (narração/elencos via IA), `advancedEngine.ts`.
- `data/`: `formats.json` (formações), `tactics.json`.
- `interactions.ts`: botões `fb_` (via interaction_checkout).

### 9.6 `tempo/` + `clima/` — Tempo e Clima RP (a dupla nova)
- `tempo/index.ts`: relógios RP (`set` com âncoras real/RP e velocidade customizada `1m -> 10m`, skip, pause/resume, list, info, conversões, taxa por mensagem).
- `tempo/clockEngine.ts`: motor de 30s que recalcula `anchorRPG + (Δreal × velocity)` e edita a mensagem do relógio (header com emoji de período do dia, clima, velocidade).
- `clima/`: lookup em tempo real (Open-Meteo geocoding + forecast), consulta RP por canal, histórico por data, `sync` (vincula lat/lon ao relógio), `force` (override/Anomalia), tabela WMO em `weatherUtils.ts`.
- Compartilham `tools/models/ClockSchema.ts` (com `guildId`, `paused` — schema novo e documentado).
- ✅ **Resolvido (21/06):** o boot inicia `startClockEngine` (motor novo); os comandos antigos `commands/time.ts` e `commands/clima.ts` foram **deletados**, eliminando o conflito de schema do model `Clock`. `rp!time` agora é alias do supercommand `tempo`. Ver §11.2.

### 9.7 `exportchat/` — Export de Canal p/ HTML
- Arquitetura v2 documentada no cabeçalho: `parseArgs` → fila de dias → **3 workers paralelos** escrevendo segmentos em disco → `merger` (arquivos de 7,5 MB) → envio por DM → `cleanup` (+ limpeza de sessões órfãs no boot).
- `SegmentRenderer` com fixes documentados para webhooks/Tupperbox. RAM O(batch), disco O(export). **Módulo mais "engenheirado" do projeto.**

### 9.8 `phone/` — Telefone Inter-Servidores
- `system.ts`: classe `PhoneSystem` em memória + `PhoneRegistryModel` (registro persistente). Estados idle/ringing/connected, `call` por ID ou apelido, `transmit` repassa mensagens.
- `index.ts`: register/off/call/accept/decline/end (texto e slash via fakeMessage).
- ✅ **Religado (21/06):** `processPhoneMessage` registrado como `phone:relay` no `EventCheckout.onMessageCreate` — as mensagens agora atravessam a chamada. Ver §11.1.

---

### 9.9 `status/` — Dashboard de Estatísticas (novo, 21/06)
- Migrado de `commands/status.ts` para `supercommands/status/` (shim em `commands/status.ts` pro deploy de slash, padrão help/logs).
- `index.ts`: roteador — overview (14 dias, layout estilo Statbot), `rank user/channel/words` (gráficos QuickChart), status por alvo (`@user`/`#canal`/`"OC"`).
- `interactions.ts`: botões `stats_` (rankings paginados de Users/Chats/OCs, 10/página) + modal "Ranking do Dia" (data flexível `DD/MM`). Travado a quem rodou o comando. Roteado pelo `interaction_checkout`.
- `handlers/backfill.ts`: `rp!status docpast [DD/MM/AAAA]` — varre o histórico dos canais e popula o `ServerStats` (skip-if-exists via `$setOnInsert`, idempotente). Admin-only.
- `ServerStats` ganhou o campo `ocs` (mensagens de webhook por nome: RPTool/Tupperbox/PluralKit), populado pelo `command_checkout`.

---

## 10. O Que Está Bem Padronizado ✅

1. **EventCheckout** — pub/sub consistente, tipado, documentado por intent, com dedupe e isolamento de erro por handler. É a espinha dorsal certa.
2. **Supercomandos novos** (logs, help, exportchat, tempo, clima, ficha, futebol) — mesmo esqueleto: cabeçalho explicando arquitetura, `index.ts` roteador fino, handlers pequenos, `sendHelp()` padronizado, try/catch com tag `[Nome]`.
3. **Shims documentados** (`commands/help.ts`, `commands/logs.ts`, `commands/status.ts`) — resolvem a limitação "só `commands/` deploya slash" e explicam o porquê no comentário.
4. **Logging de console** — convenção emoji + `[TAG]` em praticamente tudo (`✅ [MongoDB]`, `🔗 [EventCheckout]`, `⚡ [SLASH]`). Facilita ler o stdout.
5. **LogMinister novo** — factory + categorias + paleta de cores. Modelo a copiar.
6. **Comentários de intent no `index.ts`** — cada intent justificado, inclusive os removidos.
7. **Sanitização de output de IA/webhook** — a preocupação existe em todo lugar certo (só está quintuplicada, ver §12).

---

## 11. Problemas Críticos 🔴

### 11.1 Recursos "soltos da tomada" (handlers nunca registrados) — ✅ RESOLVIDO
✅ **Resolvido (21/06).** O refactor para EventCheckout estava no meio do caminho — estes módulos existiam, compilavam, mas ninguém os chamava. Todos foram religados (tabela abaixo é o estado *anterior*):

| Recurso | Função órfã | Efeito |
|---|---|---|
| **Proxy de OC (tupper)** | `tools/webhook.ts → handleOCMessage` | Mensagens com prefixo de OC **não viram webhook** — o recurso central do bot está desligado no código atual |
| **IA de OC (auto-responder)** | `tools/utils/aiUtils.ts → handleAIMessage` | NPCs não respondem (e tem o bug do `await` faltando na linha 122 que quebraria mesmo se ligado) |
| **Telefone (relay)** | `supercommands/phone → processMessage` | Chamadas conectam mas mensagens não atravessam |
| Sistema de logs | `LogModel` em conexão desconectada (§4.1) | Logs nunca enviam, silenciosamente |

O `command_checkout.ts` importa os módulos auto-registráveis (agora inclui `webhook` e `utils/aiUtils`); cada um chama `EventCheckout.onMessageCreate(...)` no escopo do arquivo, como o `42.ts`.

**Correção aplicada** (uma linha em cada arquivo, seguindo o padrão do `42.ts`):
```ts
// tools/webhook.ts
EventCheckout.onMessageCreate('oc:proxy', (m) => handleOCMessage(m));
// tools/utils/aiUtils.ts
EventCheckout.onMessageCreate('oc:ai', (m) => handleAIMessage(m));   // + await na linha 122
// supercommands/phone/index.ts
EventCheckout.onMessageCreate('phone:relay', (m) => phoneSystem.processPhoneMessage(m));
```

### 11.2 Conflito antigo × novo: `time`/`clima` — ✅ RESOLVIDO
- `commands/clima.ts` (antigo) e `supercommands/clima` (novo) têm **o mesmo `name: 'clima'`**. Como `commands/` carrega DEPOIS, **o antigo sobrescreve o novo** — `rp!clima` executa a versão velha.
- `commands/time.ts` (antigo, `name: 'time'`) convive com `supercommands/tempo` (alias `time`). `rp!time` → antigo; `rp!tempo` → novo.
- O `index.ts` inicia **o motor antigo** (`timeCommand.checkAndRestoreClocks` importado de `commands/time`). O `startClockEngine` novo **nunca roda no boot** — relógios criados pelo `rp!tempo` ficam parados até... nada.
- Os dois usam o model `'Clock'` na mesma `mainConnection` com **schemas diferentes** (o novo exige `guildId` e tem `paused`). Qual schema vale depende da ordem de import; criações pelo fluxo antigo podem falhar validação, e o motor antigo reescreve mensagens no formato antigo.

✅ **Resolvido (21/06):** `commands/time.ts` e `commands/clima.ts` foram **deletados**; o `index.ts` agora chama `startClockEngine` de `supercommands/tempo/clockEngine` no boot. O model `Clock` ficou só com o schema novo (`guildId`/`paused`). `rp!time` é alias do `tempo`; `rp!clima` usa o supercommand novo.

### 11.3 Outras inconsistências
- **Versão em 4 lugares discordando**: package.json `1.4.0`, footers `v1.4`/`v1.4.1` hardcoded em roll/serverinfo/userinfo, `ReturnVersion` caindo no fallback `1.5.1` (o `tools/Data/version.json` não existe), commits em `1.5.14`.
- **Retry infinito de 503** em `ai.ts`/`resenha.ts` (`while (!success)` sem teto) — um outage da API prende o handler pra sempre.
- `cleanWrapper` de `textUtils.ts` corta o 1º/último caractere de qualquer string (condição `startsWith('')` sempre verdadeira).
- `rp!ignorar add/remove` não tem efeito na coleta atual (só o `clean` retroativo funciona) — o tracker ativo não lê a blocklist.
- `git`: `dist/` (53 arquivos velhos) ainda trackeado; binário `stockfish` de 40 MB no repositório.

### 11.4 `strict: false`
Com o strict desligado e o uso massivo de `any` (fakeMessage, handlers), erros como o `await` faltando do §11.1 passam batido. Ligar `strict` de uma vez vai gritar em 200 lugares — vale ligar por flag (`noImplicitAny` primeiro) e ir corrigindo por pasta.

---

## 12. Duplicações — Candidatas a Universalização ♻️

| O quê | Onde está duplicado | Pra onde ir |
|---|---|---|
| `sanitizeOutput` | `tools/webhook.ts`, `tools/utils/textUtils.ts`, `commands/ai.ts`, `commands/resenha.ts`, `commands/resume.ts` (5 cópias idênticas) | Só `tools/utils/textUtils.ts`; importar nos demais |
| Cliente de IA | `tools/api.ts` (SDK+fetch), `tools/utils/aiUtils.ts → chamarIA` (axios+JSON mode), `commands/resume.ts → chamarIAResumo` | Um único `tools/api.ts` com opção `jsonMode` |
| Loop de retry 503 | `ai.ts`, `resenha.ts`, `aiUtils.ts` (3 implementações quase iguais) | Helper `withRetry(fn, {max, delay})` dentro do `api.ts` — e com TETO de tentativas |
| ✅ Tabela WMO + emojis de clima | (resolvido) só `supercommands/clima/weatherUtils.ts` — os antigos `commands/time.ts`/`clima.ts` foram deletados | — |
| `extractName` / `cleanWrapper` | `tools/utils/textUtils.ts` (bugada) vs `supercommands/oc/utils.ts` (correta) | Manter a do OC, mover pra `textUtils.ts`, deletar a bugada |
| `fakeMessage` (adaptador slash→texto) | roll, serverinfo, userinfo, resenha, status, phone, math (`sendReply`)… | Criar `tools/utils/context.ts` com um adaptador único (`makeCtx(messageOrInteraction)`) — elimina ~80 linhas de `any` |
| Confirmação Sim/Não com botões | `ban.ts`, `kick.ts`, `fatos.ts`, `exportchat/confirm.ts` | Helper `confirm(ctx, texto): Promise<boolean>` |
| Estatísticas de mensagens | `command_checkout.trackMessageStats` (ativo) vs `messageTracker.ts` (morto) vs `analytics.ts` (morto) | Manter um; fazer ele ler a blocklist do `rp!ignorar` |
| `LogMinister` | `tools/utils/` (morto) vs `supercommands/logs/utils/` (ativo) | Deletar o morto |
| Welcome/autorole | `commands/*.ts` (ativo) vs `events/memberEvents.ts` (morto) | Deletar `events/` |
| ✅ Schema `Clock` | (resolvido) só `tools/models/ClockSchema.ts` | — |
| Conexões Mongo | 7× `DB_RESTANTE`, 2× `DB_STATUS`, 2× `DB_FICHA` | Tudo em `tools/database.ts`, uma conexão por URI |
| Paginação de embeds | `reading.ts → readLongText`, wiki `view.ts`, help `views.ts` | Avaliar um paginador único (as UIs diferem, prioridade baixa) |

---

## 13. Plano de Melhoria Recomendado (por prioridade)

**P0 — Religar o que está desligado (bugs de produção) — ✅ CONCLUÍDO (21/06)**
1. Registrar `handleOCMessage`, `handleAIMessage` (+`await` faltando) e `phone relay` no EventCheckout (§11.1).
2. Mover `LogModel` para a `mainConnection` (§4.1) — destrava o supercommand de logs inteiro.
3. Resolver o conflito tempo/clima: apagar `commands/time.ts` e `commands/clima.ts`, iniciar `startClockEngine` no boot (§11.2).

**P1 — Higiene estrutural**
4. Centralizar conexões Mongo em `database.ts` (uma por URI).
5. Deletar código morto: `events/` + `eventLoader.ts`, `tools/utils/LogMinister.ts`, `tools/utils/ocHandlers.ts`, `tools/messageTracker.ts` (após mover a blocklist pro tracker ativo), `tools/analytics.ts` (ou terminar e instalar `canvas`).
6. `git rm -r --cached dist`; tirar o `stockfish` do repo (baixar no deploy).
7. Unificar versão: um `version.json` real lido pelo `ReturnVersion`, footers usando `ReturnVersion()`, package.json sincronizado.

**P2 — Universalização (§12)**
8. `sanitizeOutput` único, cliente de IA único com retry limitado, adaptador de contexto slash/texto, helper de confirmação.

**P3 — Qualidade de longo prazo**
9. Ligar flags do strict gradualmente; tipar os comandos com a interface `Command` (hoje só 4 usam).
10. Migrar `interaction_checkout` para `EventCheckout.onInteractionCreate` (registry de prefixos de customId em vez de ifs hardcoded).
11. Atualizar `readme.md` (estrutura com supercommands, env vars reais: `xdTOKEN`, `DB_OC`, `DB_OC_WIKI`, `DB_RESTANTE`, `DB_STATUS`, `DB_FICHA`, `DB_FB_USER`, `DB_FB_REPORT`, `GEMINI_API_KEY`, `WOLFRAM_IDS`, `CLIENT_ID`).
