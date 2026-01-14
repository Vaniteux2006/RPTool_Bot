const { EmbedBuilder } = require('discord.js');
const ReturnVersion = require('../ReturnVersion.js');

module.exports = {
    name: 'help',
    description: 'Mostra a lista completa de comandos do RPTool',
    execute(message, args) {
        const embed = new EmbedBuilder()
            .setColor(0x00FF00) // Verde Hacker
            .setTitle('📚 Manual Completo do RPTool')
            .setDescription('Lista atualizada com todas as funcionalidades disponíveis:')
            
            // --- UTILITÁRIOS ---
            .addFields({ 
                name: '🔍 Informações & Útil', 
                value: [
                    '`rp!dl <link>` (Baixa vídeos do TikTok, Instagram e YouTube)',
                    '`rp!userinfo [usuário] [photo]` (Ver ficha ou avatar de alguém)',
                    '`rp!serverinfo [photo]` (Ver dados e segredos do servidor)',
                    '`rp!version` (Checa a versão atual do sistema)',
                    '`rp!helloworld` (Teste de ping/conexão)'
                ].join('\n')
            })

            // --- ANIVERSÁRIOS (NOVO) ---
            .addFields({ 
                name: '🎂 Aniversários (Billboard)', 
                value: [
                    '`rp!birthday Nome Data #canal` (Registra niver e cria placar)',
                    'Ex: `rp!birthday Luke 13/04 #geral`'
                ].join('\n')
            })

            // --- RPG ---
            .addFields({ 
                name: '🎲 RPG & Dados', 
                value: [
                    '`d20`, `4d6+2` (Rola dados direto no chat)',
                    '`rp!roll` (Mostra detalhes de como rolar dados)'
                ].join('\n')
            })

            // --- TUPPERS (PERSONAGENS) ---
            .addFields({ 
                name: '🎭 Tuppers (Personagens)', 
                value: [
                    '`rp!create "Nome" prefixo` (Cria um novo personagem)',
                    '`rp!create [delete/avatar/rename/prefix] ...` (Edita seu char)',
                    '`rp!insert "Nome" [auto]` (Insere o char na conversa / Auto ativa a IA)',
                    '`rp!insert [memories/end]` (Gerencia memória ou remove o char)',
                    '`prefixo: mensagem` (Envia mensagem como o personagem)'
                ].join('\n')
            })

            // --- IA & GAMES ---
            .addFields({ 
                name: '🤖 IA & Minigames', 
                value: [
                    '`rp!ai [texto]` (Conversa rápida com o NPC padrão)',
                    '`rp!chess start` (Inicia análise de tabuleiro de Xadrez)',
                    '`rp!chess solve [FEN]` (Analisa uma jogada específica)'
                ].join('\n')
            })

            // --- TELEFONE ---
            .addFields({ 
                name: '📞 Telefone Inter-Servidores', 
                value: [
                    '`rp!phone register [nome]` (Instala o telefone no canal)',
                    '`rp!phone call [id/nome]` (Liga para outro servidor)',
                    '`rp!phone [accept/decline/end]` (Atender, Recusar, Desligar)',
                    '`rp!phone group [alvo]` (Pede para entrar numa chamada em grupo)'
                ].join('\n')
            })

            // --- ADMINISTRAÇÃO ---
            .addFields({ 
                name: '⚙️ Administração', 
                value: '`rp!autorole [add/del/check/zero]` (Gerencia cargos automáticos)' 
            })

            // Rodapé dinâmico
            .setFooter({ text: `RPTool • ${ReturnVersion()}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
        console.log("Registrado comando de Ajuda Atualizado (v2)");
    },
};