# 📖 Documentação Técnica — RPTool

> Retrato do estado atual do código (branch `main`). Última revisão: 25/07/2026.
> Descreve a arquitetura, o que cada parte faz e as dívidas técnicas que ainda existem.
>
> **Novidade (25/07):** `rp!resumo` deixou de ser um comando de arquivo único e virou o supercommand **`supercommands/resumo/`** (roteador + `modules/` + `interactions.ts`) — ver **§11**. E o `rp!exportchat` passou a funcionar **pelo PV**, com checagem de acesso ao canal — ver **§12**.
>
> **Novidade (01/07):** sistema de **Economia de OCs** (`rp!wallet` + `rp!inventory`) — carteira e inventário por personagem, com camada macroeconômica opt-in (inflação/PIB/dólar). Ver **§10** e o diagrama UML em `diagrams/economia.puml`.

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
 ├─ messageCreate: anti-spam (8 cmds/10s → cooldown 30s/guild) → roteia rp!
 └─ messageUpdate: se a edição VIRA um comando válido (que o antigo não era) → roteia rp!
      (roteamento extraído em routePrefixCommand/resolveCommand, compartilhado com o create)
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
| `tools/webhook.ts` | `oc:proxy` / `oc:proxy:edit` / `oc:reactionDelete` | proxy de OC (prefixo → webhook com nome/avatar), reprocessa na **edição** da mensagem, e apaga o próprio proxy reagindo ❌ |
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
| `DB_ECONOMY` | Economia (Wallet/Item/GuildEconomy/Ledger) | **persistente**; cai em `DB_RESTANTE` se vazio (`EconomySchema.ts`) |

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
| `CensuraConfigModel` | `CensuraConfig.ts` | mainConnection | censura (engine cacheia 5 min por guild) |
| `LockdownConfigModel` | `LockdownConfig.ts` | mainConnection | lockdown (snapshots dos overwrites pré-lockdown; cache 5 min por guild) |
| `FichaModel`, `TemplateModel` | `FichaSchema.ts` | DB_FICHA | ficha |
| `TeamModel` etc., `MatchReportModel` | `FutebolSchema.ts` / `FutebolReportSchema.ts` | DB_FB_* | futebol |
| `GuildConfigModel` | `GuildConfig.ts` | DB_RESTANTE | só o `tools/utils/LogMinister.ts` antigo (morto) |
| `WalletModel`, `ItemModel`, `GuildEconomyModel`, `EconomyLedgerModel` | `EconomySchema.ts` | DB_ECONOMY | wallet, inventory, economyEngine |

**`EconomySchema`** — economia por personagem: `WalletModel` (carteira+mochila por `(guildId, ocId)`), `ItemModel` (catálogo da loja por servidor), `GuildEconomyModel` (moeda + flags/baselines do modo avançado) e `EconomyLedgerModel` (**TTL 30d** — ledger de transações que alimenta velocidade da moeda e PIB). Detalhes em §10.

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
| **`clima/`** | ❌ (prefix) | Clima RP vinculado aos relógios (Open-Meteo). Lookup em tempo real, consulta RP por canal, histórico, `sync` (lat/lon), `force` (override/Anomalia). Resolução de local: coordenadas → estado BR (nome/UF, tabela local) → `Cidade, Qualificador` (filtro por estado/UF/país) → nome livre. |
| **`ficha/`** | shim parcial | Fichas de personagem. Template via DM, aprovação por botões (com `+oc` cria o OC). `interactions.ts` roteado por `ficha_`. |
| **`futebol/`** | ❌ (prefix) | Simulador de futebol (o maior ecossistema): `engines/` (matchEngine, mathEngine, aiDirector, advancedEngine), torneios, escalações, táticas. `interactions.ts` roteado por `fb_`. |
| **`exportchat/`** | ❌ (prefix) | Export de canal para HTML: scan paralelo → 3 workers → merger (7,5 MB) → DM → cleanup. Módulo mais "engenheirado". Roda **no servidor e no PV** (`resolveTarget.ts`: menção, link ou ID + checagem de acesso — ver §12). |
| **`resumo/`** | ❌ (prefix) | Resumo de RP por IA (§11). Pipeline `parseArgs → collector → confirm → pipeline → pages`, com `interactions.ts` (sessões de paginação + Resumo Definitivo). Aliases: `resume`, `recap`. |
| **`phone/`** | ✅ | Telefone inter-servidores: register/call/accept/decline/end; `phone:relay` repassa as mensagens da chamada. |
| **`censura/`** | ❌ (prefix) | Filtro de palavrões estilo proxy: apaga a mensagem e reenvia via webhook com o nome/avatar do autor, termo em █. `wordlist.ts` (listas padrão pt-BR + EN), `engine.ts` (normalização anti-leet/acento, matching por token com fronteira de palavra, cache 5 min). Integra com o proxy de OC via `registerProxyContentFilter` (fala de personagem também sai censurada) e `wasOCProxied` (não reprocessa). O filtro se inscreve no `messageCreate` **dentro do ClientReady** pra garantir que roda depois do `oc:proxy`. |
| **`lockdown/`** | ❌ (prefix) | Tranca o servidor (todos veem, ninguém fala): deny dos LOCK_PERMS no @everyone **por canal** (O(canais), não O(membros)) + cargo `🔓 Lockdown Bypass` com allow (dado ao bot ao ativar). `engine.ts` (snapshot/lock/restore + pool de 4). Snapshot pré-lockdown no Mongo → `off` restaura exato; canais já fechados/ocultos pro @everyone são pulados; categorias não são trancadas de propósito (canal novo copiaria os denies); canal criado durante o lockdown nasce trancado (`lockdown:newChannel`). `access @membro` e `free #canal` alternam liberações. |
| **`wallet/`** | ❌ (prefix) | Carteira por OC (§10). Handlers: `view`, `pay` (transferência atômica), `top`, `admin` (add/remove/set/setcurrency/reset), `economy` (dashboard + toggles do modo avançado). Aliases: `bank`, `saldo`, `money`, `carteira`, `w`. |
| **`inventory/`** | ❌ (prefix) | Mochila por OC + loja do servidor (§10). Handlers: `view`, `give`, `use`, `shop`, `buy`, `sell`, `levar` (move itens entre servidores), `onde` (mapa de mochilas), `admin` (additem/edititem/removeitem/giveitem/takeitem). Aliases: `inv`, `bag`, `mochila`, `itens`, `i`, `levar` (atalho top-level `rp!levar` via shim no index). |

---

## 7. `tools/` — Núcleo

| Arquivo | O que faz |
|---|---|
| `event_checkout.ts` | Dispatcher pub/sub central (§3). |
| `command_checkout.ts` | Registra `__system.checkout`: estatísticas de **humanos** (users/channels/words) e de **OCs via webhook** (`trackWebhookStats` → `ocs`), + rotinas horárias de aniversários e de **recálculo econômico** (`recomputeAllAdvanced`). Importa os módulos auto-registráveis (`42`, `roll`, `phone`, `tempo`, `webhook`, `utils/aiUtils`). |
| `interaction_checkout.ts` | Roteia botões/selects/modais por prefixo de `customId` (ficha/fb/stats/token). |
| `database.ts` | Conexões Mongo (uma duplicada). |
| `api.ts` | Classe `RPToolAPI` (singleton `api`): `chat()`, `generateRaw()`. Gemini (SDK, safety OFF) + OpenAI (fetch). |
| `webhook.ts` | Proxy de OC (`handleOCMessage`, inscrito como `oc:proxy`): parse multi-OC por prefixo/sufixo, envia via webhook, conta no `ocs`, apaga a original. `oc:proxy:edit`: reprocessa quando a mensagem é **editada** para um prefixo de OC (seguro — se já tivesse casado, a original teria sido apagada no create). Também `oc:reactionDelete`: reagir ❌/🗑️ apaga o próprio proxy — só o **autor** (mapa em memória das mensagens recentes) ou o **dono do OC** (fallback por nome, sobrevive a restart), e só em webhooks do **próprio bot** (verificado via `fetchWebhook`). Nunca apaga mensagem normal nem de outro bot. |
| `utils/aiUtils.ts` | IA de OC (`handleAIMessage`/`triggerAIGeneration`, inscrito como `oc:ai`): contexto, persona, memórias com auto-aprendizado, autoMode (menção + periódico com cooldown). `chamarIA` (Gemini/OpenAI). |
| `utils/tokenHelper.ts` | `getGuildAIConfig(guildId)`: resolve a chave de IA do servidor (assignments), com fallback para `GEMINI_API_KEY` do `.env`. |
| `utils/economy.ts` | Helpers compartilhados da economia (§10): `tokenize` (aspas), `slugify`, `parseAmount`, resolução de OC/dono (`resolveOwnedOc`/`resolveTargetOc`/`findOcByName`), `getOrCreateWallet`, `resolveItem`, mutação atômica da mochila (`add/removeItemFromWallet`), `getGuildEconomy`, `formatMoney`, `effectivePrice`, `isStaff`. |
| `utils/economyEngine.ts` | Motor macroeconômico (§10): `snapshotMQ` (M, Q), `windowVolume` (V/PIB via ledger), `recomputeEconomy` (índice de preço), `enableAdvanced`/`rebaseline` (baselines), `recomputeAllAdvanced` (rotina), `recordLedger`, `coinToUsd`. |
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
`sanitizeOutput` (5 cópias), cliente de IA (`api.ts` vs `aiUtils.chamarIA` vs `resumo/modules/aiClient.ts`), loop de retry, `fakeMessage` (adaptador slash→texto em ~8 comandos), confirmação Sim/Não com botões (ban/kick/fatos/exportchat). Mover para utils compartilhados.

### Variáveis de ambiente
`xdTOKEN`, `CLIENT_ID`, `DB_OC`, `DB_OC_WIKI`, `DB_RESTANTE`, `DB_STATUS`, `DB_FICHA`, `DB_FB_USER`, `DB_FB_REPORT`, `DB_ECONOMY` (opcional — cai em `DB_RESTANTE`), `GEMINI_API_KEY`, `WOLFRAM_IDS`, `OWNER_LOG_CHANNEL_ID` (opcional).

---

## 10. Sistema de Economia de OCs (`wallet` + `inventory`)

Carteira, mochila e loja **por personagem (OC)**, isoladas por servidor. Inspirado no UnbelievaBoat, mas o dinheiro/itens pertencem ao **tupper**, não à conta Discord. Só OCs nativos do RPTool (a carteira referencia `OCModel._id`; dono = `adminId`/`duoIds`). Diagrama completo em `diagrams/economia.puml` (PlantUML).

### 10.1 Identidade e escopo
- Carteira única por `(guildId, ocId)` → o mesmo OC tem saldos independentes em cada servidor (cada servidor é uma economia).
- Resolução de OC por nome (via `extractName`/`tokenize`, respeitando aspas). Ações que gastam/movem exigem ownership; visualização aceita `@menção` pra ver o de outra pessoa.
- Permissões de staff = `ManageGuild` (`isStaff`).

**Resolução determinística de nome (`resolveOcInGuild`)** — OCs **não** têm escopo de guild e nomes colidem no bot inteiro (várias "Rem"). Todo comando que aceita um nome de OC alheio resolve nesta ordem: **1)** `@menção` explícita no texto (ping automático de reply é ignorado — `explicitMention`) → OC daquele dono; **2)** OC do próprio autor; **3)** OCs cujo dono está **neste servidor** — exatamente 1 usa, 2+ responde "ambíguo, mencione o dono", 0 não achou. **Nunca** há busca global arbitrária (era o bug em que `add` creditava uma "Rem" e o `view` lia outra). Staff tem um fallback extra (`resolveOcForAdmin`): OCs com carteira já existente neste servidor — permite `reset`/ajuste de carteira órfã cujo dono saiu. Menções também são removidas dos argumentos posicionais (`stripMentionTokens`) pra não deslocar nome/valor/qtd.

### 10.2 Modelos (`tools/models/EconomySchema.ts`, conexão `DB_ECONOMY`)
| Model | Chave | Papel |
|---|---|---|
| `WalletModel` | única `(guildId, ocId)` | saldo + `items[]` (mochila embutida) |
| `ItemModel` | única `(guildId, key)` | catálogo da loja (`basePrice`, `stock`, `tradable`, `usable`, `replyOnUse`) |
| `GuildEconomyModel` | única `guildId` | moeda + flags (`advanced`, `autoReprice`), câmbio, `priceIndex`, baselines de genesis, `history[]` |
| `EconomyLedgerModel` | `guildId` (**TTL 30d**) | ledger de transações (`transfer`/`buy`/`sell`/`faucet`/`sink`) → velocidade e PIB |

### 10.3 Comandos
**`rp!wallet`** — `["Nome"]` (saldo), `pay "De" <valor> "Para"`, `top`, `economia [avancada|reajuste|dolar|reset]`, e admin `add/remove/set/setcurrency/reset`.
**`rp!inventory`** — `["Nome"]` (mochila), `shop`, `buy/sell "OC" "item" [qtd]`, `use "OC" "item"`, `give "De" "item" [qtd] "Para"`, `add`/`drop` (itens pessoais), `onde ["OC"]` (em quais servidores o OC tem mochila — só o dono vê), e admin `additem/edititem/removeitem/giveitem/takeitem`.

**`rp!levar`** (atalho de `rp!inventory levar`) — **move** (nunca copia) itens do OC pro mesmo OC em OUTRO servidor: `rp!levar ["OC"]` (mochila inteira) ou `rp!levar "item" [qtd] "OC"` (qtd omitida = pilha inteira). Roda no servidor de ORIGEM; um **select menu preso ao embed** lista os servidores onde o OC já tem carteira (o `rp!bag` cria ao ser usado) e só o invocador escolhe — componente por mensagem, nunca `awaitMessages` no canal (coletores de execuções antigas capturariam respostas alheias). Regras de chegada: item **pessoal** viaja intacto; item **de loja** mapeia pro catálogo do destino se o `key` existir lá, senão **vira pessoal** (perde preço/venda); `tradable: false` **não viaja**; 💰 **saldo nunca viaja** (cada servidor é uma economia — moeda própria, M/Q/priceIndex próprios). Débito atômico na origem antes do crédito no destino (ordem do `give` — sem duplicação), trava em memória por OC contra transferências concorrentes, e o cap de 1000 tipos do destino é respeitado.

**Dois tipos de item:**
- **De loja (catálogo `ItemModel`)** — staff cria (`additem`), têm `basePrice`, entram em `buy`/`sell`, contam na riqueza real Q, respeitam `tradable`/`usable`.
- **Pessoais (freeform)** — jogador cria na própria mochila com `add "OC" "Nome" [qtd] [emoji]`; vivem só no `WalletModel.items` (campos `name`/`emoji`/`custom:true`), **sem** entrada no catálogo. Sem preço (não compram/vendem, Q=0), mas dá pra `give`/`use`/`drop`. Caps (constantes em `economy.ts`): qty ≤ 2^53−1 (`MAX_ITEM_QTY` = `Number.MAX_SAFE_INTEGER` — teto da precisão do double JS/Mongo, não regra de RP; **acima de 10 mil a exibição vira notação científica** via `formatQty`, ex. 1,5 × 10¹⁰), ≤ 1000 tipos por mochila (`MAX_DISTINCT_ITEMS`, guarda anti-abuso — o `view` trunca o que não cabe no embed), nome ≤ 60 chars; nome que colide com item de loja é barrado (evita item de loja grátis). Emoji do item pode ser unicode ou **custom do servidor** (`<:nome:id>` passa inteiro — `sanitizeEmoji` em `economy.ts`; era truncado em 8 chars, por isso só funcionava emoji padrão).

`give`/`use`/`drop` operam por **posse** (`findHeldItem` — resolve por key ou nome na mochila), servindo os dois tipos; `buy`/`sell` continuam só de loja. `view` mostra pessoais com ✎.

Segurança de concorrência: débitos usam update condicional atômico (`balance: {$gte: valor}` + `$inc`); estoque e itens da mochila idem (`$elemMatch`/`$inc`/`$pull`). Nunca há saldo/estoque negativo por corrida.

### 10.4 Camada macroeconômica (opt-in) — `tools/utils/economyEngine.ts`
Ligada por servidor com `rp!wallet economia avancada on`. Modelo pela **Teoria Quantitativa da Moeda** (M·V = P·Q):

- **M** = oferta monetária = Σ saldos (`snapshotMQ`).
- **Q** = riqueza real = Σ `basePrice × qty` dos itens nas mochilas (`snapshotMQ`).
- **V** = velocidade = volume transacionado na janela (7d) ÷ M (`windowVolume`, sobre o ledger).
- **P** = índice de preço = `clamp( (M/M₀) / max(Q/Q₀, ε) · (V/V₀)^α , 0.1, 10 )`, com `α=0.3`.
  - Mais moeda sem mais riqueza → **inflação**; moeda parada (V↓) → pressão **deflacionária**.
- **Genesis (M₀/Q₀/V₀):** capturados ao ligar o modo (`enableAdvanced`); `rebaseline` recaptura.
- **Reajuste de preços** (`autoReprice`): `effectivePrice()` = `round(basePrice × priceIndex)`; senão `basePrice`.
- **Câmbio fictício→dólar** (`coinToUsd`): `saldo × baseUsdRate / priceIndex` (moeda inflacionada compra menos dólar).
- **PIB**: volume de `buy+sell+transfer` na janela (`windowVolume`).
- **Dashboard** `rp!wallet economia`: M, Q, índice/inflação, V, PIB, câmbio, economia em USD + gráfico do índice (QuickChart **baixado e anexado** via `attachment://`, porque o proxy do Discord não busca imagem externa).
- **Rotina**: `recomputeAllAdvanced()` roda de hora em hora (`command_checkout.ts`), só nos servidores com `advanced=true`.

Faucets/sinks alimentam o ledger: `pay→transfer`, `buy→buy`, `sell→sell`, admin `add→faucet`, `remove→sink`.

> **Reservado (ainda não implementado):** `GuildEconomyModel.dailyAmount`/`workAmount` — campos previstos pra faucets `daily`/`work` (não há comando ainda). Definidos com default pra evolução futura sem migração.

---

## 11. Resumo de RP por IA (`supercommands/resumo/`)

`rp!resumo` lê o histórico de um canal num intervalo, manda pra IA do servidor e devolve páginas navegáveis. Era `commands/resume.ts` (um arquivo de ~810 linhas com fetch, chunking, cliente HTTP, retry, embeds e botões juntos); virou supercommand quando a lógica de custo/retry passou a ser mais complexa que o próprio resumo. **Sem estado persistente** — nada de Mongo ou disco, só um `Map` de sessões em memória.

### 11.1 Estrutura
```
supercommands/resumo/
├── index.ts            roteador: orquestra o pipeline e imprime o resultado + sendHelp()
├── config.ts           todos os limites/constantes, com o porquê de cada número
├── types.ts            BlocoResumo, Interrupcao, SessaoResumo
├── interactions.ts     Map de sessões + botões (paginação e Resumo Definitivo)
└── modules/
    ├── parseArgs.ts    canal (#menção), datas (DD/MM[/AAAA] [HH:MM], "->"), flag -y, `help`
    ├── collector.ts    fetch por snowflake + filtro de RP + fatiamento por caracteres
    ├── confirm.ts      preview de custo (só quando custa 2+ requisições)
    ├── pipeline.ts     laço de blocos: 1 requisição por bloco, retry, ETA
    ├── pages.ts        Tópicos / Ações / Linha do Tempo dentro dos limites do embed
    ├── prompts.ts      prompts + responseSchema (JSON garantido)
    ├── aiClient.ts     chamada Gemini/OpenAI + parse do JSON
    ├── errors.ts       classificação da falha (é transitória?) + textos de erro
    └── text.ts         truncar() e sanitizeOutput()
```

### 11.2 Fluxo
```
rp!resumo [#canal] [DD/MM[/AAAA] [HH:MM] [-> ...]] [-y]
 ├─ parseArgs      → canal, intervalo (padrão: últimas 3h), pularConfirmacao, ajuda
 ├─ coletarMensagens → fetch de 100 em 100, `before` = snowflake sintético da data
 │                     filtra: descarta rp!/bots/vazias, MANTÉM webhook (fala de OC)
 │                     teto de 1200 msgs → `atingiuTeto` vira aviso no resultado
 ├─ montarBlocos   → fatia por CARACTERES (600k), não por contagem de mensagens
 ├─ confirmarCusto → só se blocos > 1 e sem -y; expirar (120s) = cancelar
 ├─ processarBlocos→ 1 requisição por bloco
 │                   503/rate limit → retry infinito com backoff [5,10,30,60]s
 │                   cota/bloqueio/outro → PARA, mas devolve os blocos já prontos
 ├─ montarPaginas  → 📌 Tópicos · 👥 Ações · 📜 Linha do Tempo
 └─ criarSessao    → registra no Map e envia com os botões
```

### 11.3 Decisões que explicam o código
- **"Manda e esquece"** — o usuário dispara e volta depois. Por isso a paginação **não** usa collector (morria em 10 min): a sessão vive num `Map` chaveado pelo id da mensagem, com **TTL de 6h**, servida por um handler global (`EventCheckout.onInteractionCreate('resumo:paginacao')`). Não sobrevive a restart do bot — nesse caso o clique responde com aviso claro em vez de não fazer nada. Só o autor mexe nos botões.
- **A cota da IA é o recurso escasso** (não CPU/RAM). Daí: fatiamento por caracteres (na prática **1 requisição por resumo**), preview de custo antes de gastar, e o botão do Resumo Definitivo somindo depois de usado (cada clique repetido era outra requisição).
- **Requisição paga nunca é descartada** — falha não recuperável no meio do laço interrompe, mas o que já foi processado vira **resumo parcial** com o motivo no cabeçalho.
- **`responseSchema`** nos prompts: sem ele o modelo devolvia markdown/preâmbulo e queimava a requisição por erro de parse.
- **Cota diária ≠ rate limit** — o Gemini manda a mesma `message` genérica nos dois casos; quem distingue é o `quotaId` dentro de `error.details` (`errors.ts`). Sem isso, cota diária virava "rate limit" e o bot martelava por horas à toa.
- **Bloco único ganha o arco geral de graça** — o prompt já pede `arco_geral`/`conclusoes` junto, então o 🌟 **Resumo Definitivo** não custa segunda requisição (com 2+ blocos, custa 1).
- **Safety OFF** no Gemini: RP tem violência/palavrão, senão o bloqueio é o caso comum. E tudo que volta da IA passa por `sanitizeOutput` — o log de origem pode conter `@everyone`.

### 11.4 Limites (`config.ts`)
| Constante | Valor | Por quê |
|---|---|---|
| `MAX_MENSAGENS` | 1200 | teto do fetch por execução; ultrapassar vira aviso de resumo parcial |
| `MAX_CHARS_POR_BLOCO` | 600.000 | equilíbrio entre nº de requisições e risco de estourar tokens/minuto |
| `LIMITE_FIELD/DESCRIPTION/EMBED` | 1024 / 4096 / 6000 | limites do Discord — estourar derrubaria o comando **depois** de pagar as requisições |
| `TTL_SESSAO_MS` | 6h | tempo que os botões continuam clicáveis |
| `TIMEOUT_CONFIRMACAO_MS` | 120s | sem clique = cancelado (padrão seguro pra cota) |
| `ESCADA_BACKOFF` | 5/10/30/60s | espera do retry transitório (o `retryDelay` do Gemini tem prioridade) |

### 11.5 Contrato com o sistema de chaves (`rp!token`)
- A chave vem de `getGuildAIConfig(guildId)` (`tools/utils/tokenHelper.ts`) → `AIConfig { provider, key, model }`, tipada ponta a ponta (`types.ts` reexporta o `AIConfig`, sem `any` no caminho).
- **Só roda em servidor.** Em DM não há `guildId`, e `getGuildAIConfig(null)` cairia no fallback do `.env` — qualquer um queimaria a cota global do dono do bot. O comando recusa com mensagem explicando que a chave é a do servidor.
- **A sessão guarda `guildId`, nunca o `AIConfig`.** A sessão vive até 6h; nesse intervalo a chave pode ser trocada ou removida no `rp!token`. O Resumo Definitivo resolve a chave **na hora do clique** — pega troca de chave sem precisar refazer o resumo, avisa direito se a chave sumiu, e a chave não fica pendurada em memória por horas.
- Quem consome a cota é a chave **do servidor**, não a de quem digitou — a confirmação de custo existe justamente por isso.

---

## 12. Export de chat pelo PV (`supercommands/exportchat/`)

`rp!exportchat` continua idêntico no servidor e passou a rodar também na **DM do bot**. Faz sentido porque o resultado sempre foi entregue por DM — só o disparo é que exigia estar no servidor.

### 12.1 O que muda entre servidor e PV
| | Servidor | PV |
|---|---|---|
| Alvo | `#canal` (menção) | **link** (`.../channels/<guild>/<canal>`), **ID** cru ou `<#id>` colado |
| Confirmação (>3 dias) | no canal do comando | na própria DM |
| `rp!export end` | no canal do comando | na própria DM |
| Entrega dos HTMLs | DM | DM |

`resolveTarget.ts` aceita as três formas nos dois contextos. O link **não** podia passar pelo `replace(/\D/g,'')` do parser antigo (grudaria guild+canal+mensagem num número só), então a extração testa link → menção → ID cru, nessa ordem. No servidor continua valendo a regra antiga de não exportar canal de outro servidor; no PV isso não se aplica (não existe "este servidor"), e quem limita é a checagem de acesso.

### 12.2 Checagem de acesso (`resolveTarget.ts`)
Exportar por ID **sem** checagem seria vazamento: qualquer pessoa pediria o histórico de qualquer canal de qualquer servidor onde o bot está. A regra é "você só exporta o que você mesmo consegue ler", nesta ordem:

1. o canal existe, é de servidor e é de texto/tópico;
2. quem pediu **é membro** daquele servidor (`guild.members.fetch`);
3. o **membro** tem `ViewChannel` **e** `ReadMessageHistory` no canal (`ViewChannel` sozinho não basta — dá pra ver o canal sem poder ler o histórico);
4. o **bot** tem as mesmas duas permissões (senão o erro só apareceria lá no meio do scan).

⚠️ Isso vale também no servidor, onde antes **não havia checagem nenhuma**: dava pra exportar por ID um canal que você não enxerga.

### 12.3 Detalhes de implementação
- `SegmentRenderer` recebe `targetChannel.guild` (era `message.guild`) — no PV não existe guild de origem, e mesmo no servidor o certo é resolver cor/apelido/menções pelo servidor **do canal**.
- `askConfirmation` recebe `SendableChannels` (era `TextChannel`) — o mesmo fluxo serve pro `DMChannel`; o `index.ts` filtra com `isSendable()`.
- O collector de cancelamento escuta o canal de onde veio o comando — no PV, a própria DM.
- Semáforo global de 3 exports e limpeza de sessão em disco: inalterados.
