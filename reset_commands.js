const { REST, Routes } = require('discord.js');
require('dotenv').config();

const token = process.env.TOKEN; 
const clientId = process.env.CLIENT_ID; 

if (!token) {
    console.error("❌ Erro: Token não encontrado no arquivo .env");
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
	try {
		console.log('🗑️  Iniciando a limpeza TOTAL dos comandos...');

		// 1. Limpa comandos GLOBAIS
		console.log('🌍 Apagando comandos Globais...');
		await rest.put(Routes.applicationCommands(clientId), { body: [] });
		console.log('✅ Comandos Globais apagados.');

		console.log('✨ Sucesso! O bot está limpo. Agora rode "node index.js" para registrar tudo do zero.');
	} catch (error) {
		console.error('❌ Erro ao resetar:', error);
	}
})();