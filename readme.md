# 🎲 RPTool — Discord Bot

O **RPTool** é um bot de Discord multifuncional focado em servidores de Roleplay (RPG de texto): personagens originais (OCs) via webhook, NPCs com IA, relógios e clima de RP, economia por personagem, estatísticas de atividade, simulador de futebol, xadrez contra o Stockfish, moderação e logs de auditoria.

> 📖 **Referência completa:** a lista de comandos vive no próprio bot (`rp!help`) e a documentação
> técnica da arquitetura em [`DOCUMENTACAO.md`](DOCUMENTACAO.md). Este readme cobre só o essencial
> pra rodar o projeto — listar comandos aqui envelhece sozinho.

## 🚀 Tecnologias

* **Linguagem:** TypeScript / Node.js (executado via `ts-node` — sem etapa de build)
* **Biblioteca principal:** [Discord.js v14](https://discord.js.org/)
* **Banco de dados:** [MongoDB](https://www.mongodb.com/) via Mongoose (múltiplos bancos por domínio)
* **IA:** `@google/generative-ai` (Gemini) com suporte a OpenAI, chave por usuário via `rp!token`
* **Outros:** `chess.js` + binário do Stockfish (xadrez), `chartjs-node-canvas` (gráficos), `axios`, `dotenv`

## 🏗️ Arquitetura em 30 segundos

```text
📂 RPTool/
├── loader.js            # Ponto de entrada (registra ts-node e puxa o index.ts)
├── index.ts             # Client do Discord, roteamento de comandos rp! e slash
├── commands/            # Comandos simples (1 arquivo = 1 comando)
├── supercommands/       # Comandos complexos (1 pasta = index.ts roteador + handlers/)
│   ├── oc/  futebol/  status/  exportchat/  resumo/  censura/  lockdown/  ...
└── tools/
    ├── eventCheckout.ts # Dispatcher pub/sub central de eventos (a espinha dorsal)
    ├── models/          # Schemas do MongoDB
    └── utils/           # Utilitários compartilhados
```

Regra da casa: comando simples vive em `commands/`; quando cresce, vira uma pasta em
`supercommands/`. Módulos se auto-registram em eventos via `EventCheckout` — importar o arquivo
é o que liga o sistema (nenhuma mudança no `index.ts`). Detalhes em `DOCUMENTACAO.md` §3.

## ⚙️ Instalação

### Pré-requisitos

* [Node.js](https://nodejs.org/) v18+
* Um banco [MongoDB](https://www.mongodb.com/) (Atlas ou local) — pode usar a mesma URI pra todas as envs `DB_*`

### Passo a passo

1. **Clone o repositório e instale as dependências:**
   ```bash
   npm install
   ```
2. **Crie um `.env` na raiz** com as variáveis abaixo:
   ```env
   # ── Obrigatórias ─────────────────────────────────────────────
   xdTOKEN=token_do_bot_no_discord
   CLIENT_ID=application_id_do_bot

   # Conexões MongoDB (podem apontar pro mesmo cluster, bancos diferentes)
   DB_OC=mongodb+srv://...          # OCs
   DB_OC_WIKI=mongodb+srv://...     # Wikis de OC
   DB_RESTANTE=mongodb+srv://...    # Configurações gerais, kanban, tokens...
   DB_STATUS=mongodb+srv://...      # Estatísticas de atividade
   DB_FICHA=mongodb+srv://...       # Fichas + reaction roles
   DB_FB_USER=mongodb+srv://...     # Futebol: times
   DB_FB_REPORT=mongodb+srv://...   # Futebol: relatórios de partida

   # ── Opcionais ────────────────────────────────────────────────
   DB_ECONOMY=                      # Economia (cai em DB_RESTANTE se vazio)
   GEMINI_API_KEY=                  # Chave de IA padrão (usuários podem ter a sua via rp!token)
   WOLFRAM_IDS=                     # Chaves do WolframAlpha (rp!math)
   OWNER_LOG_CHANNEL_ID=            # Canal de log do dono do bot
   YTDLP_PATH=                      # Binário próprio do yt-dlp (rp!download)
   YTDLP_COOKIES=                   # cookies.txt p/ sites que exigem login
   ```
3. **Inicie:**
   ```bash
   npm start
   ```

### Checagens úteis

```bash
npm run typecheck   # tsc --noEmit — rodar antes de cada release
```

### Xadrez (opcional)

O `rp!chess` procura o binário do **Stockfish** em `./stockfish` (raiz do projeto) ou
`/home/node/stockfish`. O binário não é versionado no git — baixe do
[site oficial](https://stockfishchess.org/download/) e coloque na raiz.

## 📝 Permissões no Discord

Administrador, ou no mínimo: Gerenciar Webhooks (essencial pros OCs), Ler/Enviar/Gerenciar
Mensagens, Gerenciar Cargos e Canais, Ler Histórico e Ver Registro de Auditoria (logs).

---

**Licença:** ISC
