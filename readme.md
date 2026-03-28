# 🎲 RPTool - Discord Bot

O **RPTool** é um bot de Discord avançado e multifuncional, focado em servidores de Roleplay (RPG de texto), ferramentas de inteligência artificial, moderação e entretenimento (como Xadrez). Criado com foco em customização e imersão, ele funciona como uma ponte entre sistemas clássicos de administração e mecânicas modernas de IA para NPCs.

## 🚀 Tecnologias Utilizadas

* **Linguagem:** TypeScript / Node.js
* **Biblioteca Principal:** [Discord.js (v14)](https://discord.js.org/)
* **Banco de Dados:** [MongoDB](https://www.mongodb.com/) via Mongoose (Suporte a múltiplos bancos)
* **Inteligência Artificial:** `@google/generative-ai` (Gemini API) e suporte a OpenAI.
* **Geração de Imagens/Gráficos:** `chartjs-node-canvas`, `quickchart-js`, `fast-average-color-node`
* **Outros:** `chess.js` (Xadrez), `axios` (Requisições HTTP), `dotenv` (Variáveis de ambiente), `pm2` (Gerenciamento de processos).

---

## ✨ Principais Funcionalidades

### 🎭 Sistema de Roleplay & OCs (Original Characters)
* **Tuppers / Webhooks:** Crie personagens (OCs) com avatares e nomes customizados. Eles "falam" no chat através de webhooks, substituindo a mensagem do usuário por um formato de RPG (`rp!oc`).
* **Aprovação de Fichas:** Sistema de envio e revisão de fichas. Administradores usam painéis interativos (botões) para **Aprovar** ou **Recusar** personagens.
* **Wiki de Personagens:** Um sistema integrado (`rp!oc wiki`) para criar documentações e "lores" detalhadas dos personagens com páginas navegáveis, emojis customizados e links entre Wikis.

### 🤖 Inteligência Artificial Avançada (NPCs)
* **NPCs Inteligentes:** OCs podem ser configurados com uma Persona (Prompt de IA) para responder de forma autônoma no chat.
* **Gestão Individual de API Keys:** Para não sobrecarregar uma única chave, o bot possui um sistema via DM (`rp!token`) onde cada usuário pode inserir sua própria chave de API (Google Gemini ou OpenAI) com segurança.
* **Comandos de IA:**
    * `rp!ai [texto]`: Conversa rápida com uma IA.
    * `rp!resume [data]`: Gera resumos automáticos do que aconteceu na história/RP do servidor.
    * `rp!resenha`: IA lê o histórico recente do chat e faz avaliações cômicas do nível de caos da conversa.

### 🛡️ Moderação, Logs e Utilidades
* **Ministério do Log:** Sistema de auditoria completo (`rp!logs`). Registra mensagens apagadas, edições, criação de threads, atualizações de figurinhas, entre outros.
* **Autorole & Reaction Roles:** Distribuição automática de cargos na entrada (`rp!autorole`) e concessão de cargos por reação a mensagens (`rp!reaction`).
* **Comandos Administrativos:** `kick`, `ban` (por ID, inclusive inter-servidores), entre outros comandos com validação via botões (Sim/Não) para evitar acidentes.
* **Console Seguro:** Comando `rp!console` que funciona como uma Sandbox para executar pequenos trechos de código JavaScript direto pelo Discord.

### 🌍 Funcionalidades Globais e Sociais
* **Telefone (Cross-Server Chat):** Permite enviar mensagens de um canal/servidor para outro imersivamente (`rp!phone`).
* **Sistema de Aniversários:** Registra e avisa sobre o aniversário dos usuários e/ou OCs (`rp!birthday`).
* **Gráficos e Estatísticas:** Rastreia e exibe métricas de uso do servidor, frequência de palavras e engajamento usando `Chart.js`.
* **Relógios Persistentes:** Cria e atualiza relógios no formato de canais ou mensagens contínuas (`rp!time`).

---

## 🏗️ Arquitetura e Estrutura de Diretórios

O projeto utiliza uma estrutura modular, o que facilita escalar novos comandos ou eventos.

```text
📂 RPTool/
├── 📄 package.json          # Dependências e scripts
├── 📄 tsconfig.json         # Configuração do TypeScript
├── 📄 .env                  # Variáveis de ambiente (Tokens e DBs)
├── 📄 loader.js             # Ponto de entrada (Registra ts-node e puxa o index.ts)
├── 📄 index.ts              # Inicialização do Client do Discord
├── 📂 commands/             # Comandos do Bot (Slash e Prefix)
│   ├── ban.ts, kick.ts      # Comandos de Moderação
│   ├── logs.ts, autorole.ts # Configurações de Servidor
│   ├── token.ts             # Painel PV de chaves de IA
│   └── ...
├── 📂 events/               # Listeners de eventos do Discord.js
│   ├── threadLogs.ts        # Listeners do Ministério do Log
│   └── ...
└── 📂 tools/                # Lógicas centrais, DB e Utilitários
    ├── database.ts          # Gerenciamento de Conexões Mongoose
    ├── webhook.ts           # Motor de webhooks (Tuppers)
    ├── interaction_checkout # Handler de Botões e Menus
    ├── 📂 models/           # Schemas do MongoDB (OC, GuildConfig, Token, etc.)
    └── 📂 utils/            # Ferramentas auxiliares (aiUtils, LogMinister, etc.)
```

### Arquitetura de Banco de Dados
O bot é projetado para operar com múltiplas URIs do MongoDB de forma simultânea (separação de responsabilidades):
* `DB_TUPPER`: Usado exclusivamente para salvar OCs e logs pesados de mensagens.
* `DB_RESTANTE`: Usado para o Kanban, estatísticas e configurações de servidor.

---

## ⚙️ Instalação e Configuração

### Pré-requisitos
* [Node.js](https://nodejs.org/) (v18 ou superior)
* Gerenciador de pacotes (`npm` ou `yarn`)
* Um banco de dados [MongoDB](https://www.mongodb.com/) (Atlas ou Local)

### Passo a Passo

1. **Clone ou baixe o repositório.**
2. **Instale as dependências:**
   ```bash
   npm install
   ```
3. **Configure as Variáveis de Ambiente:**
   Crie um arquivo `.env` na raiz do projeto com as seguintes chaves:
   ```env
   # Token do bot do Discord
   DISCORD_TOKEN=seu_token_aqui
   
   # Conexões do MongoDB
   DB_TUPPER=mongodb+srv://user:pass@cluster.mongodb.net/tuppers
   DB_RESTANTE=mongodb+srv://user:pass@cluster.mongodb.net/geral
   ```
4. **Inicie o Bot:**
   Para desenvolvimento local ou execução manual:
   ```bash
   npm start
   ```
   *(O comando `npm start` executa `node loader.js`, que faz o wrap do TypeScript em tempo de execução).*

### Hospedagem (Produção)
Para manter o bot 24/7, recomenda-se o uso do **PM2**, que já está incluso nas dependências:
```bash
npx pm2 start loader.js --name "RPTool"
```

---

## 📝 Permissões Necessárias no Discord
Para que o bot funcione plenamente, certifique-se de conceder a ele as permissões de Administrador ou as seguintes permissões específicas:
* Gerenciar Webhooks (Essencial para os Tuppers)
* Ler e Enviar Mensagens, Gerenciar Mensagens
* Gerenciar Cargos e Canais
* Ler Histórico de Mensagens e Ver o Registro de Auditoria (Essencial para os logs)

---

**Versão Atual:** 1.4.0  
**Licença:** ISC