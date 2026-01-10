const { PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'autorole',
    description: 'Configura ou executa o sistema de Autorole',
    
    // PARTE 1: O COMANDO (rp!autorole @cargo)
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ Você precisa ser Administrador para configurar isso.");
        }

        const role = message.mentions.roles.first();
        if (!role) {
            return message.reply("⚠️ Uso correto: `rp!autorole @cargo`");
        }

        const configPath = path.join(__dirname, '../server_config.json');
        let config = {};
        try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) {}

        if (!config[message.guild.id]) config[message.guild.id] = {};
        config[message.guild.id].autorole = role.id;

        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));

        message.reply(`✅ **Autorole Configurado!**\nNovos membros receberão: **${role.name}**\n(Garanta que meu cargo RPTool esteja acima do cargo ${role.name} na lista!)`);
    },

    // PARTE 2: A AÇÃO AUTOMÁTICA (O Sistema)
    // Essa função será chamada pelo index.js quando alguém entrar
    async giveRole(member) {
        const configPath = path.join(__dirname, '../server_config.json');
        let config = {};
        try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) { return; }

        const roleId = config[member.guild.id]?.autorole;
        
        if (roleId) {
            try {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.add(role);
                    console.log(`✅ Autorole: Dei o cargo ${role.name} para ${member.user.tag}`);
                }
            } catch (error) {
                console.log(`❌ Erro no Autorole: Sem permissão ou cargo baixo demais.`);
            }
        }
    }
};