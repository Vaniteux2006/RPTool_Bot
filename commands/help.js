const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Mostra a lista de comandos do RPTool',
    execute(message, args) {
        const embed = new EmbedBuilder()
            .setColor(0x00FF00) // Verde Hacker
            .setTitle('📚 Manual do RPTool')
            .setDescription('Aqui está tudo que eu sei fazer (por enquanto):')
            .addFields(
                { name: '❕ Versão', value: 'rp!version (Retorna a versão do bot)' },
                { name: '🎲 RPG & Dados', value: '`d20`, `4d6+2` (Direto no chat)\n`rp!roll` (Ajuda sobre dados)' },
                { name: '🎭 Personagens (Tuppers)', value: '`rp!create "Nome" prefixo` (Cria char)\n`prefixo: mensagem` (Fala como char)' },
                { name: '🤖 Inteligência & Games', value: '`rp!ai [texto]` (Conversa com NPC)\n`rp!chess start` (Xadrez/Stockfish)' },
                { name: '📞 Telefone', value: '`rp!phone [register/call/accept/decline/group/end/off]` (Interage com outros servidores))' },
                { name: '⚙️ Sistema', value: '`rp!helloworld` (Ping)\n`rp!autorole [add/del/check]` (Cargos Automáticos)' }
            )
            .setFooter({ text: 'Versão 1.100.010-6' }); 
        message.reply({ embeds: [embed] });
        console.log("Registrado comando de Ajuda")
    },
};