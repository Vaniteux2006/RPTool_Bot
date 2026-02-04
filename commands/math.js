const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'math',
    description: 'Calculadora rápida',

    data: new SlashCommandBuilder()
        .setName('math')
        .setDescription('Calcula uma expressão matemática')
        .addStringOption(option => 
            option.setName('expressao')
                .setDescription('Ex: 2 + 2 * 4')
                .setRequired(true)),

    async executeSlash(interaction) {
        const expr = interaction.options.getString('expressao');
        this.calculate(interaction, expr);
    },

    execute(message, args) {
        const expr = args.join(' ');
        this.calculate(message, expr);
    },

    async calculate(target, expression) {
        try {
            if (/[a-zA-Z]/.test(expression)) {
                const msg = '⚠️ Apenas números e operadores (+ - * /) são permitidos.';
                return target.reply ? target.reply(msg) : target.reply(msg);
            }
            
            const result = eval(expression); 
            
            const content = `🔢 **Conta:** \`${expression}\`\n✅ **Resultado:** \`${result}\``;
            
            if (target.reply) await target.reply(content);
        } catch (err) {
            const msg = '❌ Conta inválida!';
            if (target.reply) await target.reply(msg);
        }
    }
};