const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const ReturnVersion = require('../ReturnVersion.js');

module.exports = {
    name: 'help',
    description: 'Manual de comandos do RPTool',
    
    // --- ESTRUTURA SLASH ---
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Mostra a lista de comandos'),

    // --- EXECUÇÃO ANTIGA ---
    execute(message) {
        this.replyHelp(message, false);
        console.log("Registrado comando de Ajuda");
    },

    // --- EXECUÇÃO NOVA ---
    async executeSlash(interaction) {
        await this.replyHelp(interaction, true);
    },

    // --- FUNÇÃO UNIFICADA (LISTA ATUALIZADA) ---
    async replyHelp(target, isSlash) {
        const p = isSlash ? "/" : "rp!"; // Prefixo dinâmico
        
        const embed = new EmbedBuilder()
            .setColor(0x00FF00) // Verde Hacker
            .setTitle('📚 Manual do RPTool')
            .setDescription('Agora com suporte total a **Slash Commands (/)** e **Prefixo (rp!)**!')
            
            .addFields({ 
                name: '🛠️ Utilidades & Info', 
                value: [
                    `\`${p}dl [link]\` (Baixa vídeos TikTok/Insta/YouTube)`,
                    `\`${p}userinfo [user]\` (Stalkear usuário)`,
                    `\`${p}serverinfo\` (Raio-X do servidor)`,
                    `\`${p}version\` (Checar versão do bot)`,
                    `\`${p}helloworld\` (Ping)`
                ].join('\n')
            })
            .addFields({ 
                name: '🎲 RPG & Diversão', 
                value: [
                    `\`${p}roll [formula]\` (Rolar dados: 1d20+5)`,
                    `\`${p}chess\` (Ferramentas de Xadrez/Stockfish)`,
                    `\`${p}ai [texto]\` (Conversar com o Bot)`
                ].join('\n')
            })
            .addFields({ 
                name: '🎭 Tuppers (Personagens)', 
                value: [
                    `\`${p}create\` (Criar/Editar personagens)`,
                    `\`${p}insert\` (Inserir personagem no chat)`,
                    `\`${p}webhook\` (Ajuda sobre como falar)`
                ].join('\n')
            })
            .addFields({ 
                name: '⚙️ Administração', 
                value: [
                    `\`${p}autorole\` (Cargos automáticos)`,
                    `\`${p}phone\` (Telefone entre servidores)`
                ].join('\n')
            })
            .setFooter({ text: `RPTool v1.2` })
            .setTimestamp();

        if (isSlash) await target.reply({ embeds: [embed] });
        else target.reply({ embeds: [embed] });
    }
};