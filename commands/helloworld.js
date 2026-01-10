module.exports = {
    name: 'helloworld',
    description: 'Responde com o ping do bot',
    execute(message, args) {
        const ping = Date.now() - message.createdTimestamp;
        message.reply(`Hello World! Conexão de ${ping}ms.`);
    },
};