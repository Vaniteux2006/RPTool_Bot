# 📖 Documentação Técnica — RPTool

> Retrato do estado atual do código (branch `main`). Última revisão: 21/06/2026.
> Descreve a arquitetura, o que cada parte faz e as dívidas técnicas que ainda existem.

---

## 1. Visão Geral

Bot de Discord (**discord.js v14**) para servidores de Roleplay, escrito em **TypeScript rodando via ts-node** (sem build em produção: `loader.js` registra o `ts-node/register` e puxa o `index.ts`). Persistência em **MongoDB via Mongoose** (várias conexões por domínio). IA via **Google Gemini e OpenAI**, com chaves por usuário/servidor.

Duas camadas de comando + uma de eventos:

| Camada | Pasta | O que é |
|---|---|---|
| Comandos simples | `commands/` | Um arquivo = um comando. Alguns são **shims** que só existem para o deploy de slash e delegam para um supercommand. |
| Supercomandos | `supercommands/<nome>/` | Ecossistemas: `index.ts` (roteador) + `handlers/` + (quando há UI) `interactions.ts`. |
| Subscribers de evento | `EventCheckout.onX(...)` | Qualquer módulo se inscreve em eventos do Discord ao ser importado. |

**Princípio de design:** comando complexo vira supercommand; o núcleo de cada feature vive em `supercommands/` e se auto-registra, de modo que o bot continua funcionando mesmo se os arquivos de `commands/` forem apagados (objetivo "open-source desmontável").

---

## 2. Fluxo de Boot

```
node loader.js → ts-node/register → index.ts
 ├─ chmod no binário do Stockfish (caminho fixo /home/node/stockfish — Discloud)
 ├─ new Client(...) com 16 intents (documentados inline, privilegiados incluídos)
 ├─ 1º: carrega supercommands/*/index.ts  → client.commands.set(name, cmd)
 ├─ 2º: loadCommands('commands/')          → client.commands.set(name, cmd)
 │       └─ se cmd.data && cmd.executeSlash → entra no commandsArray (deploy de slash)
 │       ℹ️ comandos de commands/ sobrescrevem supercomandos de mesmo nome — é o
 │          mecanismo dos shims (help/logs/status), que só existem pro deploy de slash
 ├─ initEventCheckout(client)              → client.on(evento) → dispatch() p/ registry
 ├─ ClientReady:
 │    ├─ rotação de status a cada 15s (BotStatusModel, suporta {version})
 │    ├─ startClockEngine(client)          → motor de relógios RP (supercommands/tempo)
 │    └─ REST.put → registra os slash commands globalmente
 ├─ InteractionCreate: runInteractionChecks (ficha_/fb_/stats_/token_) → senão roteia slash
 └─ messageCreate: anti-spam (8 cmds/10s → cooldown 30s/guild) → roteia rp!
```

---

## 3. Arquitetura de Eventos — `EventCheckout`

`tools/event_checkout.ts` é a espinha dorsal do projeto:

- **Registry interno** `Map<evento, {name, fn}[]>`; `subscribe()` deduplica por nome.
- **API tipada**: `EventCheckout.onMessageCreate(name, fn)`, `onGuildMemberAdd(...)`, etc. — um wrapper por evento, agrupados por intent.
- **initEventCheckout(client)** faz o bind de ~55 eventos do client para o `dispatch()`.
- **Auto-inscrição**: cada módulo chama `EventCheckout.onX()` no escopo do arquivo. Importar = registrar; apagar o arquivo = registro some. Nenhuma mudança no `index.ts`.

**Subscribers ativos hoje:**

| Origem | Inscrição | Função |
|---|---|---|
| `commands/42.ts` | `42` | easter egg na MessageCreate |
| `commands/welcome.ts` | `welcome:join` / `welcome:leave` | boas-vindas/saída (detecta kick/ban via audit log) |
| `commands/autorole.ts` | `autorole` | cargo automático na entrada |
| `tools/reactionListener.ts` | `reactionRole` | reaction roles (add/remove) |
| `tools/command_checkout.ts` | `__system.checkout` | estatísticas (humanos + OCs por webhook) + rotinas |
| `tools/webhook.ts` | `oc:proxy` | proxy de OC (prefixo → webhook com nome/avatar) |
| `tools/utils/aiUtils.ts` | `oc:ai` | IA de OC (gatilho manual + autoMode) |
| `supercommands/ficha/index.ts` | `ficha:autodetect` | detecta fichas postadas no canal |
| `supercommands/phone/index.ts` | `phone:relay` | repassa mensagens da chamada |
| `supercommands/logs/events/*` | `logs:*` (~40) | sistema de auditoria |

**Interações** (botões/modais/selects) são roteadas pelo `tools/interaction_checkout.ts` por prefixo de `customId`: `ficha_` → ficha, `fb_` → futebol, `stats_` → status, `token_` → token.

---

## 4. Banco de Dados

### 4.1 Conexões (`tools/database.ts` + models)
Várias `mongoose.createConnection()` por domínio. Há **duplicação** (várias conexões para o mesmo `DB_RESTANTE`), candidata a centralização:

| Env var | Usada por | Observação |
|---|---|---|
| `DB_OC` / `DB_OC_WIKI` | OCs / Wiki de OCs | conexões dedicadas |
| `DB_RESTANTE` | `database.ts` (mainConnection), Outros, Token, GuildConfig, Kanban, Birthday | **~7 conexões para o mesmo banco** |
| `DB_STATUS` | ServerStats | estatísticas |
| `DB_FICHA` | Ficha, ReactionRole | fichas + reaction roles |
| `DB_FB_USER` / `DB_FB_REPORT` | Futebol | times/relatórios |

### 4.2 Models (`tools/models/`)
| Model | Arquivo | Conexão | Usado por |
|---|---|---|---|
| `OCModel`, `WikiModel` | `OCSchema.ts` | DB_OC / DB_OC_WIKI | oc/*, webhook, aiUtils, status |
| `TokenModel` | `TokenSchema.ts` | DB_RESTANTE | token, tokenHelper |
| `WelcomeModel`, `BotStatusModel`, `WikiArticleModel`, `PhoneRegistryModel` | `Outros.ts` | DB_RESTANTE | welcome, index, phone |
| `ServerStats`, `BlockedWordsModel` | `ServerStats.ts` | DB_STATUS | command_checkout, status (rankings/docpast), ignorar |
| `BirthdayModel`, `BirthdayConfigModel` | `BirthdaySchema.ts` | DB_RESTANTE | birthday |
| `KanbanItemModel`, `KanbanPainelModel` | `KanbanSchema.ts` | DB_RESTANTE | kanban |
| `AutoroleModel` | `AutoroleConfig.ts` | DB_RESTANTE | autorole |
| `ReactionRoleModel` | `ReactionRoleSchema.ts` | DB_FICHA | reaction, reactionListener |
| `ClockModel` | `ClockSchema.ts` | mainConnection | tempo, clima (schema único, com `guildId`/`paused`) |
| `LogModel` | `LogConfig.ts` | mainConnection | logs |
| `FichaModel`, `TemplateModel` | `FichaSchema.ts` | DB_FICHA | ficha |
| `TeamModel` etc., `MatchReportModel` | `FutebolSchema.ts` / `FutebolReportSchema.ts` | DB_FB_* | futebol |
| `GuildConfigModel` | `GuildConfig.ts` | DB_RESTANTE | só o `tools/utils/LogMinister.ts` antigo (morto) |

**`ServerStats`** guarda por `(guildId, date, hour)`: `total`, `users`, `channels`, `words`, **`ocs`** (mensagens de webhook por nome do personagem — RPTool/Tupperbox/PluralKit).

---

## 5. `commands/` — Comandos Simples e Shims

Convenção: `export default { name, description, aliases?, data?, executeSlash?, execute }`. Comandos com slash montam um `fakeMessage` (adaptador que finge ser `Message`) e delegam pro `execute`.

**Shims** (só existem porque apenas `commands/` entra no deploy de slash): `help.ts` → `supercommands/help`, `logs.ts` → `supercommands/logs`, `status.ts` → `supercommands/status`.

| Comando | Aliases | Slash | O que faz |
|---|---|---|---|
| `42` | — | ❌ | easter egg da Pergunta Fundamental |
| `ai` | — | ✅ | chat avulso com a IA do servidor |
| `autorole` | — | ✅ | cargos automáticos na entrada |
| `ban` / `kick` / `unban` | — | ✅ | moderação com confirmação por botões |
| `birthday` | niver, eventos, calendario | ❌ | aniversários/eventos com painel auto-atualizável |
| `chess` | — | ✅ | xadrez vs Stockfish |
| `clear` | limpar, clean | ✅ | bulk delete 1–100 |
| `console` | — | ❌ | executa JS na sandbox Piston |
| `fatos` | — | ❌ | "maratona de cultura" com artigos hardcoded |
| `helloworld` | ping, test | ✅ | ping/latência |
| `help` (shim) | ajuda, comandos | ✅ | → supercommands/help |
| `ignorar` | blockword | ❌ | blocklist de palavras das estatísticas |
| `kanban` | kb, tasks | ❌ | quadro TODO/DOING/DONE com painel fixo |
| `logs` (shim) | log, auditoria… | ❌ | → supercommands/logs |
| `math` | — | ✅ | Wolfram Alpha |
| `mute` / `unmute` | — | ✅ | timeout flexível |
| `não` | nao, no… | ❌ | desculpa aleatória |
| `reaction` | reactionrole, rr | ❌ | configura reaction role |
| `resenha` | — | ✅ | IA julga o caos do chat |
| `resume` | — | ❌ | resumo de RP por IA |
| `roll` | — | ✅ | dados de RPG |
| `serverinfo` / `userinfo` | — | ✅ | embeds de info |
| `status` (shim) | stats, dashboard, rank | ✅ | → supercommands/status |
| `version` | creditos, credits, info | ✅ | versão + créditos |
| `welcome` | boasvindas, setwelcome | ✅ | mensagens de entrada/saída |

---

## 6. `supercommands/` — Ecossistemas

Padrão comum: `index.ts` com roteador `switch` + `sendHelp()`, handlers em arquivos separados, cabeçalho de comentário explicando a arquitetura, `try/catch` no roteador com tag `[Nome]`.

| Supercommand | Slash | Descrição |
|---|---|---|
| **`oc/`** | ❌ (prefix) | Personagens (tupper): CRUD, grupos, export/import, wiki, social, e **IA** (`ai/` — persona, memórias, autoMode, delay, gaslight/forget/insert). O proxy de webhook está em `tools/webhook.ts`. |
| **`logs/`** | shim | Auditoria. `index.ts` importa ~17 arquivos de `events/`; `utils/LogMinister.ts` (factory + categorias + paleta). Owner log opcional via `OWNER_LOG_CHANNEL_ID`. |
| **`help/`** | shim | Central de ajuda interativa. `registry.ts` (todo o conteúdo), `search.ts`, `views.ts`. |
| **`status/`** | shim | Dashboard de estatísticas (14 dias, layout Statbot). `interactions.ts` (rankings paginados Users/Chats/OCs + modal "Ranking do Dia"); `handlers/backfill.ts` (`rp!status docpast` — varre o histórico e popula o `ServerStats`, idempotente, com progresso ao vivo). |
| **`token/`** | ❌ (prefix) | Painel de chaves de IA por DM. `index.ts` (painel) + `interactions.ts` (CRUD via customId/modais: criar, renomear, trocar modelo, deletar, vincular/desvincular a servidores, **testar chave** com `api.generateRaw`). |
| **`tempo/`** | ❌ (prefix) | Relógios RP. `clockEngine.ts` (motor de 30s, iniciado no boot) edita a mensagem do relógio com hora/data/clima/velocidade. Comandos: set/skip/pause/resume/list/info/conv/msg. |
| **`clima/`** | ❌ (prefix) | Clima RP vinculado aos relógios (Open-Meteo). Lookup em tempo real, consulta RP por canal, histórico, `sync` (lat/lon), `force` (override/Anomalia). |
| **`ficha/`** | shim parcial | Fichas de personagem. Template via DM, aprovação por botões (com `+oc` cria o OC). `interactions.ts` roteado por `ficha_`. |
| **`futebol/`** | ❌ (prefix) | Simulador de futebol (o maior ecossistema): `engines/` (matchEngine, mathEngine, aiDirector, advancedEngine), torneios, escalações, táticas. `interactions.ts` roteado por `fb_`. |
| **`exportchat/`** | ❌ (prefix) | Export de canal para HTML: scan paralelo → 3 workers → merger (7,5 MB) → DM → cleanup. Módulo mais "engenheirado". |
| **`phone/`** | ✅ | Telefone inter-servidores: register/call/accept/decline/end; `phone:relay` repassa as mensagens da chamada. |

---

## 7. `tools/` — Núcleo

| Arquivo | O que faz |
|---|---|
| `event_checkout.ts` | Dispatcher pub/sub central (§3). |
| `command_checkout.ts` | Registra `__system.checkout`: estatísticas de **humanos** (users/channels/words) e de **OCs via webhook** (`trackWebhookStats` → `ocs`), + rotina horária de aniversários. Importa os módulos auto-registráveis (`42`, `roll`, `phone`, `tempo`, `webhook`, `utils/aiUtils`). |
| `interaction_checkout.ts` | Roteia botões/selects/modais por prefixo de `customId` (ficha/fb/stats/token). |
| `database.ts` | Conexões Mongo (uma duplicada). |
| `api.ts` | Classe `RPToolAPI` (singleton `api`): `chat()`, `generateRaw()`. Gemini (SDK, safety OFF) + OpenAI (fetch). |
| `webhook.ts` | Proxy de OC (`handleOCMessage`, inscrito como `oc:proxy`): parse multi-OC por prefixo/sufixo, envia via webhook, conta no `ocs`, apaga a original. |
| `utils/aiUtils.ts` | IA de OC (`handleAIMessage`/`triggerAIGeneration`, inscrito como `oc:ai`): contexto, persona, memórias com auto-aprendizado, autoMode (menção + periódico com cooldown). `chamarIA` (Gemini/OpenAI). |
| `utils/tokenHelper.ts` | `getGuildAIConfig(guildId)`: resolve a chave de IA do servidor (assignments), com fallback para `GEMINI_API_KEY` do `.env`. |
| `reactionListener.ts` | Reaction roles (inscrito no EventCheckout). |
| `HtmlTranscript.ts` | Gerador de transcript HTML, compartilhado por exportchat e logs. |
| `ReturnVersion.ts` | Lê `tools/Data/version.json` (⚠️ não existe → sempre retorna o fallback). |
| `check_models.ts` | Script CLI avulso (lista modelos Gemini). Não é carregado pelo bot. |
| `messageTracker.ts` | Tracker de stats **antigo** (morto); só `loadBlockedWords` ainda é usado (pelo `rp!ignorar`). |
| `utils/textUtils.ts` | `sanitizeOutput`, `extractArgs`, `extractName`, `formatLongContent`, `cleanWrapper` (⚠️ bugado — ver §9). |
| `utils/reading.ts` | `parseWikiText`, `readLongText` (paginador). |
| `interfaces/Command.ts` | Interface `Command` (poucos comandos a usam). |
| `utils/LogMinister.ts`, `utils/ocHandlers.ts` | Versões **antigas/mortas** (as ativas estão nos supercommands). |

---

## 8. Padrões Consolidados ✅

1. **EventCheckout** — pub/sub tipado, documentado por intent, com dedupe e isolamento de erro por handler.
2. **Supercomandos** — mesmo esqueleto: cabeçalho de arquitetura, `index.ts` roteador fino, handlers pequenos, `sendHelp()`, try/catch com tag.
3. **Shims** (`help`/`logs`/`status`) — resolvem "só `commands/` deploya slash" e explicam o porquê no comentário.
4. **Roteamento de interação por customId** (`interaction_checkout`) — botões/modais/selects roteados por prefixo, stateless, sem collectors (ficha, futebol, status, token).
5. **Logging de console** — convenção emoji + `[TAG]` em praticamente tudo.
6. **Comentários de intent no `index.ts`** — cada intent justificado, inclusive os removidos.

---

## 9. Dívidas Técnicas Conhecidas ⚠️

Pendências reais que **ainda valem** (não foram resolvidas):

- **Versão dessincronizada**: `package.json` (1.4.0), footers hardcoded (`v1.4`/`v1.4.1` em roll/serverinfo/userinfo), `ReturnVersion` caindo no fallback (`tools/Data/version.json` não existe), commits em 1.5.x.
- **Retry 503 infinito** em `commands/ai.ts` e `commands/resenha.ts` (`while` sem teto) — um outage da API prende o handler.
- **`cleanWrapper`** (`tools/utils/textUtils.ts`) corta o 1º/último caractere de qualquer string (`startsWith('')` sempre `true`). Só o `ocHandlers` morto usa, mas é uma mina.
- **`rp!ignorar add/remove`** não afeta a coleta atual (o tracker ativo não lê a blocklist; só o `clean` retroativo funciona).
- **Conexões Mongo duplicadas** (~7× `DB_RESTANTE`) — centralizar em `database.ts`.
- **Chaves de IA em texto plano** no Mongo (`TokenSchema.value`).
- **Código morto remanescente**: `tools/utils/LogMinister.ts`, `tools/utils/ocHandlers.ts`, `tools/messageTracker.ts` (tracker; manter só `loadBlockedWords`), `tools/models/GuildConfig.ts` (só o LogMinister morto usa).
- **`tsconfig` com `strict: false`** — mascara `any` implícito e awaits faltando.
- **Git**: `dist/` (build antigo) trackeado; binário `stockfish` (~40 MB) versionado — deveria ser baixado no deploy.
- **`readme.md`** desatualizado (estrutura antiga; cita `DISCORD_TOKEN`, o código usa `xdTOKEN`).

### Duplicações candidatas a universalização
`sanitizeOutput` (5 cópias), cliente de IA (`api.ts` vs `aiUtils.chamarIA` vs `resume.chamarIAResumo`), loop de retry, `fakeMessage` (adaptador slash→texto em ~8 comandos), confirmação Sim/Não com botões (ban/kick/fatos/exportchat). Mover para utils compartilhados.

### Variáveis de ambiente
`xdTOKEN`, `CLIENT_ID`, `DB_OC`, `DB_OC_WIKI`, `DB_RESTANTE`, `DB_STATUS`, `DB_FICHA`, `DB_FB_USER`, `DB_FB_REPORT`, `GEMINI_API_KEY`, `WOLFRAM_IDS`, `OWNER_LOG_CHANNEL_ID` (opcional).
