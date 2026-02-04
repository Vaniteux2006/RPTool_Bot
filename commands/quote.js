const { 
    ContextMenuCommandBuilder, 
    ApplicationCommandType, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    AttachmentBuilder 
} = require('discord.js');
const axios = require('axios');

const quoteSessions = new Map();

async function createQuote(targetMessage, replyContext, originalAuthorId) {
    console.log("🎨 [QUOTE] Iniciando processamento...");

    let content = targetMessage.content;
    
    if (!content && targetMessage.attachments.size > 0) {
        content = "Enviou uma imagem.";
    }
    
    if (!content) {
        console.log("❌ [QUOTE] Conteúdo vazio.");
        const msg = "Mensagem vazia ou inválida!";
        if (replyContext.reply) return replyContext.reply({ content: msg, ephemeral: true });
        return;
    }

    const initialState = {
        text: content,
        username: targetMessage.author.displayName,
        avatar_url: targetMessage.author.displayAvatarURL({ extension: 'png', size: 256 }),
        user_color: targetMessage.member ? targetMessage.member.displayHexColor : "#ffffff",
        options: {
            dark_mode: true,
            grayscale: false,
            flipped: false,
            bold: false,
            vertical: false
        }
    };

    console.log(`✅ [QUOTE] Alvo: ${initialState.username}`);

    // Se não tiver sido deferido (no caso de msg de texto), usa typing
    if (!replyContext.deferred && !replyContext.replied && replyContext.channel) {
        await replyContext.channel.sendTyping(); 
    }

    console.log("📡 [QUOTE] Chamando API Python...");
    const imageBuffer = await requestQuoteImage(initialState);
    
    if (!imageBuffer || imageBuffer.length === 0) {
        console.log("❌ [QUOTE] Falha ao receber imagem do Python.");
        const errMsg = "Ocorreu um erro ao gerar a imagem. O servidor Python está online?";
        if (replyContext.editReply) return replyContext.editReply(errMsg);
        return replyContext.reply(errMsg);
    }

    const attachment = new AttachmentBuilder(imageBuffer, { name: 'quote.png' });
    const row = createButtons(initialState.options);

    let response;
    try {
        if (replyContext.deferred || replyContext.replied) {
            response = await replyContext.editReply({ files: [attachment], components: [row] });
        } else {
            response = await replyContext.reply({ files: [attachment], components: [row] });
        }
    } catch (err) {
        console.error("Erro ao enviar mensagem:", err);
        return;
    }

    quoteSessions.set(response.id, initialState);

    const collector = response.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async i => {
        if (i.user.id !== originalAuthorId) {
            return i.reply({ content: "Faça seu próprio quote para mexer! (Use 'Responder' + '@RPTool anota')", ephemeral: true });
        }

        const state = quoteSessions.get(response.id);
        if (!state) {
            return i.reply({ content: "Sessão expirada.", ephemeral: true });
        }

        switch (i.customId) {
            case 'toggle_dark': state.options.dark_mode = !state.options.dark_mode; break;
            case 'toggle_gray': state.options.grayscale = !state.options.grayscale; break;
            case 'toggle_flip': state.options.flipped = !state.options.flipped; break;
            case 'toggle_bold': state.options.bold = !state.options.bold; break;
            case 'toggle_vert': state.options.vertical = !state.options.vertical; break;
        }

        await i.deferUpdate();

        const newBuffer = await requestQuoteImage(state);
        const newAttachment = new AttachmentBuilder(newBuffer, { name: 'quote.png' });
        const newRow = createButtons(state.options);

        await i.editReply({ files: [newAttachment], components: [newRow] });
        
        quoteSessions.set(response.id, state);
    });
}

async function requestQuoteImage(payload) {
    try {
        const res = await axios.post('http://127.0.0.1:8000/quote/generate', payload);
        
        if (res.data.error) {
            console.error("Erro retornado pelo Python:", res.data.error);
            return null;
        }
        
        return Buffer.from(res.data.image_base64, 'base64');
    } catch (error) {
        console.error("ERRO CRÍTICO NA CONEXÃO COM PYTHON:", error.message);
        return null;
    }
}

function createButtons(options) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('toggle_dark').setEmoji(options.dark_mode ? '🌙' : '☀️').setStyle(options.dark_mode ? ButtonStyle.Secondary : ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('toggle_gray').setEmoji('🎨').setStyle(options.grayscale ? ButtonStyle.Secondary : ButtonStyle.Success),
        new ButtonBuilder().setCustomId('toggle_flip').setEmoji('🔁').setStyle(options.flipped ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('toggle_bold').setLabel('B').setStyle(options.bold ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('toggle_vert').setLabel('Vertical').setStyle(options.vertical ? ButtonStyle.Danger : ButtonStyle.Secondary)
    );
}

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Make it a Quote')
        .setType(ApplicationCommandType.Message),

    async execute(interaction) {
        if (!interaction.guild) return interaction.reply({ content: "Só em servidores!", ephemeral: true });
        
        // CORREÇÃO: Deferir logo aqui pra garantir que não timeout
        await interaction.deferReply();
        
        await createQuote(interaction.targetMessage, interaction, interaction.user.id);
    },

    async executeText(message) {
        console.log("▶️ [QUOTE] executeText iniciado.");
        
        if (!message.reference) {
            console.log("❌ [QUOTE] Sem referência.");
            return message.reply("⚠️ Você precisa responder a uma mensagem!");
        }

        try {
            const targetMessage = await message.channel.messages.fetch(message.reference.messageId);
            await createQuote(targetMessage, message, message.author.id);
        } catch (error) {
            console.error("💥 [QUOTE] Erro ao buscar mensagem original:", error);
            message.reply("Não consegui achar a mensagem original...");
        }
    },

    async processQuoteTrigger(message) {
        const isMention = message.mentions.has(message.client.user);
        const content = message.content.toLowerCase();
        
        if (isMention && content.includes("anota")) {
            console.log(`\n--- DEBUG TRIGGER (Quote) ---`);

            if (message.reference) {
                await this.executeText(message);
            } else {
                console.log("❌ Ignorado: Faltou o Reply.");
                await message.reply("⚠️ Você precisa responder a uma mensagem para eu anotar! (Botão Responder + @RPTool anota)");
            }
            
            return true; 
        }

        return false;
    }
};