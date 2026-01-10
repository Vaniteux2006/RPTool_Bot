const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'create',
    description: 'Cria um novo Tupper (Personagem)',
    async execute(message, args) {
        // Formato esperado: rp!create "Nome do Personagem" prefixo
        
        // Junta tudo que foi digitado
        const fullText = args.join(' ');

        // Regex mágica pra pegar o que tá entre aspas (Nome) e o que tá fora (Prefixo)
        const regex = /"([^"]+)"\s+(\S+)/;
        const match = fullText.match(regex);

        if (!match) {
            return message.reply('⚠️ Formato inválido!\nUse: `rp!create "Nome do Personagem" prefixo`\n(Não esqueça de anexar a imagem!)');
        }

        const nomePersonagem = match[1];
        const prefixo = match[2];
        
        // Verifica se tem imagem anexada
        let avatarUrl = "";
        if (message.attachments.size > 0) {
            avatarUrl = message.attachments.first().url;
        } else {
            // Se não tiver anexo, usa o avatar do próprio usuário como quebra-galho
            avatarUrl = message.author.displayAvatarURL();
        }

        // Cria o objeto do novo Tupper
        const novoTupper = {
            uid: message.author.id, // ID do criador (segurança)
            name: nomePersonagem,
            prefix: prefixo,
            avatar: avatarUrl
        };

        // Lê o arquivo atual, adiciona e salva
        const dbPath = path.join(__dirname, '../tuppers.json');
        let db = [];
        
        try {
            const data = fs.readFileSync(dbPath, 'utf8');
            db = JSON.parse(data);
        } catch (err) {
            db = [];
        }

        db.push(novoTupper);
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));

        message.reply(`✅ **${nomePersonagem}** criado com sucesso!\nPara usar, digite: \`${prefixo}: sua mensagem\``);
    },
};