const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'math',
    description: 'Calculadora rápida',

    // --- MENU SLASH ---
    data: new SlashCommandBuilder()
        .setName('math')
        .setDescription('Calcula uma expressão matemática')
        .addStringOption(option => 
            option.setName('expressao')
                .setDescription('Ex: 2 + 2 * 4')
                .setRequired(true)),

    // --- ADAPTADOR ---
    async executeSlash(interaction) {
        const expr = interaction.options.getString('expressao');
        // Redireciona para a função de cálculo
        this.calculate(interaction, expr);
    },

    // --- LÓGICA ORIGINAL ---
    execute(message, args) {
        const expr = args.join(' ');
        this.calculate(message, expr);
    },

    async calculate(target, expression) {
        try {
            // Filtro básico de segurança
            if (/[a-zA-Z]/.test(expression)) {
                const msg = '⚠️ Apenas números e operadores (+ - * /) são permitidos.';
                return target.reply ? target.reply(msg) : target.reply(msg);
            }
            
            // Lógica original com eval (Cuidado, mas mantido a pedido)
            const result = eval(expression); 
            
            const content = `🔢 **Conta:** \`${expression}\`\n✅ **Resultado:** \`${result}\``;
            
            // Suporte híbrido (Message ou Interaction)
            if (target.reply) await target.reply(content);
        } catch (err) {
            const msg = '❌ Conta inválida!';
            if (target.reply) await target.reply(msg);
        }
    }
};