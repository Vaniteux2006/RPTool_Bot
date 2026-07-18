// RPTool/supercommands/futebol/helpText.ts
// Painel de ajuda do rp!futebol, dividido em páginas.
// O Discord limita mensagens a 2000 caracteres — cada página DEVE ficar abaixo
// disso (com folga). Ao adicionar comandos novos, crie outra página se precisar.

export const FUTEBOL_HELP_PAGES: string[] = [

    // ── Página 1: partidas, clube, jogadores, listagens ──────────────────────
    `⚽ **RPTool Football Engine** ⚽\n\n` +

    `**🏟️ Partidas**\n` +
    `\`rp!futebol match "Time A" "Time B"\` — simula uma partida\n` +
    `  \`-n\` campo neutro  |  \`-r\` resultado direto  |  \`-irl [10-60]\` ao vivo\n\n` +

    `**🏗️ Gestão de Clube**\n` +
    `\`rp!futebol create "Nome" [emoji]\` — funda um clube\n` +
    `\`rp!futebol add "Nome" [OVR] [emoji] -ai\` — gera 22 jogadores via IA 🤖\n` +
    `\`rp!futebol addplayer "Time" "Jogador" POS OVR [arq] [reserva]\` — adição rápida\n` +
    `\`rp!futebol squad "Time"\` — exibe o elenco\n` +
    `\`rp!futebol tatic "Time" FORMAÇÃO ESTILO\` — define a tática\n` +
    `\`rp!futebol suggest "Time"\` — IA sugere a melhor tática 🧠\n` +
    `\`rp!futebol emoji "Time" 🎯\` — define o emoji do clube\n` +
    `\`rp!futebol global "Time" [on|off]\` — libera o time p/ torneios de outros servidores 🌍\n` +
    `\`rp!futebol delete "Time"\` — dissolve o clube\n\n` +

    `**🎴 Jogadores Customizados**\n` +
    `\`rp!futebol player create "Time" "Nome" POS [-pac N] [-sho N] ...\` — cria com stats FIFA\n` +
    `\`rp!futebol player view "Time" "Nome"\` — exibe o card do jogador\n` +
    `\`rp!futebol player edit "Time" "Nome" [-stat N]\` — edita stats\n` +
    `\`rp!futebol player remove "Time" "Nome"\` — dispensa jogador\n` +
    `\`rp!futebol player archetypes\` — lista todos os arquétipos\n` +
    `-# Outfield: \`-pac -sho -pas -dri -def -phy\` | GK: \`-div -ref -han -kic -spe -pos\`\n\n` +

    `**📋 Listagens**\n` +
    `\`rp!futebol list serverlist\` — times do servidor (com pesquisa)\n` +
    `\`rp!futebol list userlist\` — seus times em qualquer servidor`,

    // ── Página 2: torneios, admin, memória ───────────────────────────────────
    `**🏆 Torneios** *(fases automáticas: grupos → mata-mata, suíço, ida/volta, pênaltis)*\n` +
    `\`rp!futebol tourney create "Nome" [FORMATO] [flags]\` — cria torneio (ADM)\n` +
    `  flags: \`-ida\` \`-turno\` \`-grupos N\` \`-avanca N\` \`-min N\` \`-max N\`\n` +
    `\`rp!futebol tourney start "Nome"\` — inicia e gera tabela (ADM)\n` +
    `\`rp!futebol tourney view "Nome"\` — raio-X: fase, rodada e chaveamento completo\n` +
    `\`rp!futebol join "Torneio" "Time"\` — inscreve seu time (aceita times globais 🌍)\n` +
    `\`rp!futebol standings "Torneio"\` — tabela de classificação\n` +
    `\`rp!futebol round sim "Torneio"\` — simula rodada atual (ADM)\n` +
    `\`rp!futebol round next "Torneio"\` — avança rodada/fase (ADM)\n` +
    `\`rp!futebol round view "Torneio" [nº]\` — ver confrontos/chaveamento\n\n` +

    `**⚖️ Admin / STJD**\n` +
    `\`rp!futebol admin punish "Torneio" "Time" -p N\` — punição de pontos\n` +
    `\`rp!futebol admin ban "Torneio" "Time"\` — expulsa do torneio (W.O. nos jogos)\n` +
    `\`rp!futebol admin postpone "Torneio" "Time A" "Time B"\` — adia partida\n` +
    `\`rp!futebol admin resume "Torneio" "Time A" "Time B"\` — remarca partida adiada\n\n` +

    `**📦 Memória e Histórico**\n` +
    `\`rp!futebol export <ID>\` — exporta súmula como JSON\n` +
    `\`rp!futebol import\` — re-lê uma súmula exportada\n` +
    `\`rp!futebol history "Torneio"\` — gráfico de campeões históricos`,
];
