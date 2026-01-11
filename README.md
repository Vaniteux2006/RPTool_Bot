# 🎲 RPTool Bot

Um bot de Discord focado em RPG de Texto, com sistema híbrido (Node.js + Python) para integração de IA.

![Status](https://img.shields.io/badge/Status-Online-brightgreen)
![Tech](https://img.shields.io/badge/Stack-NodeJS_%7C_Python_%7C_C-blue)

## ✨ Funcionalidades Atuais

* **🎲 Rolagem de Dados Avançada:** Suporta expressões matemáticas (Ex: `6d10+5`), ordena resultados e exibe soma total.
* **🎭 Sistema de Tuppers (Webhooks):** Mimetiza personagens usando Webhooks para maior imersão.
* **🧠 IA Integrada (Gemini):** NPCs que conversam e interpretam papéis usando uma API Python local.
* **🏷️ Autorole:** Gerenciamento automático de cargos para novos membros.
* **🚀 Lançador Próprio:** Executável `Ligar.exe` (escrito em C) para iniciar o ambiente com um clique.

## 🚧 Roadmap (Futuro)

Lista de desejos e próximas atualizações planejadas:

- [ ] **IA:** Criação de Tupper automática com IA.
- [ ] **IA:** Leitura de contexto do chat para respostas mais inteligentes.
- [ ] **Analytics:** Gráfico de atividade do servidor.
- [ ] **Math:** Integração com Wolfram Alpha para equações complexas.
- [ ] **RPG:** Banco de Dados para Fichas de Personagens.
- [ ] **RPG:** Mesclagem de Ficha + Webhook (Atributos rolando dados).
- [ ] **RPG:** Sistema de Horário e Clima em tempo real.
- [ ] **Social:** Comunicação entre Tuppers via DM (PV).
- [ ] **Social:** Comandos de `Server Info` e `User Info`.
- [ ] **Util:** Buscador de Imagens (Google) e Vídeos (YouTube).
- [ ] **System:** Comando para criar novos comandos personalizados.

## 🛠️ Instalação (Rodando Localmente)

### Pré-requisitos
* [Node.js](https://nodejs.org/) instalado.
* [Python](https://www.python.org/) instalado.

### Passo a Passo

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/Vaniteux2006/RPTool_Bot/](https://github.com/Vaniteux2006/RPTool_Bot/)
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    pip install fastapi uvicorn google-generativeai python-dotenv pydantic
    ```

3.  **Configure o ambiente:**
    Crie um arquivo `.env` na raiz com as chaves:
    ```env
    TOKEN=seu_token_do_discord
    GEMINI_API_KEY=sua_chave_do_google
    ```

4.  **Inicie o Bot:**
    Apenas clique duas vezes em **`Ligar.exe`**.
    *(O bot irá gerenciar o servidor Python automaticamente).*

---
Feito com ❤️ e ☕