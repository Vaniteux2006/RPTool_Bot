import { SlashCommandBuilder, ChatInputCommandInteraction, Message, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage, registerFont, CanvasRenderingContext2D } from 'canvas';
import path from 'path';

// --- CONFIGURAÇÃO VISUAL (Movido do engine) ---

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 400;
const AVATAR_SIZE = 250;

// Tenta registrar a fonte ao carregar o arquivo
try {
    // Ajuste o caminho '../fonts' conforme a estrutura das suas pastas
    const fontPath = path.join(__dirname, './FONT.otf');
    registerFont(fontPath, { family: 'GreaterTheory' });
} catch (e) {
    console.warn("⚠️ Fonte 'GreaterTheory' não encontrada. Usando padrão.");
}

// --- FUNÇÕES AUXILIARES DE DESENHO ---

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    const words = text.split(' ');
    let lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

async function renderQuote(text: string, username: string, avatarUrl: string, userColor: string): Promise<Buffer> {
    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');

    // 1. Fundo
    ctx.fillStyle = '#0f0f0f'; 
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Avatar Circular
    try {
        const avatar = await loadImage(avatarUrl);
        ctx.save();
        ctx.beginPath();
        const avatarX = 50;
        const avatarY = (CANVAS_HEIGHT - AVATAR_SIZE) / 2;
        ctx.arc(avatarX + AVATAR_SIZE / 2, avatarY + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, AVATAR_SIZE, AVATAR_SIZE);
        ctx.restore();
    } catch (e) {
        console.error("Erro ao carregar avatar:", e);
    }

    // 3. Texto
    const fontSize = 40;
    ctx.font = `${fontSize}px "GreaterTheory", sans-serif`;
    ctx.fillStyle = '#ffffff';
    
    const textAreaX = 350;
    const textAreaWidth = 600;
    
    const lines = wrapText(ctx, text, textAreaWidth);
    const lineHeight = fontSize + 10;
    const totalTextHeight = (lines.length * lineHeight) + 50; 
    
    let currentY = (CANVAS_HEIGHT - totalTextHeight) / 2 + fontSize;

    lines.forEach(line => {
        ctx.fillText(line, textAreaX, currentY);
        currentY += lineHeight;
    });

    // 4. Nome
    ctx.font = `bold 30px sans-serif`;
    ctx.fillStyle = userColor.startsWith('#') ? userColor : '#ffffff';
    ctx.fillText(`- ${username}`, textAreaX + 50, currentY + 20);

    return canvas.toBuffer();
}

// --- COMANDO DISCORD ---

export default {
    name: 'quote',
    description: 'Transforma uma mensagem em imagem',
    
    data: new SlashCommandBuilder()
        .setName('quote')
        .setDescription('Cita uma mensagem')
        .addStringOption(op => op.setName('texto').setDescription('O que foi dito').setRequired(true))
        .addUserOption(op => op.setName('usuario').setDescription('Quem disse').setRequired(false)),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const text = interaction.options.getString('texto') || "";
        const user = interaction.options.getUser('usuario') || interaction.user;
        
        await interaction.deferReply();
        
        try {
            // Chamada direta para a função local, sem passar pela API
            const buffer = await renderQuote(
                text, 
                user.username, 
                user.displayAvatarURL({ extension: 'png', size: 256 }), 
                user.hexAccentColor || '#ffffff'
            );
            
            const attachment = new AttachmentBuilder(buffer, { name: 'quote.png' });
            await interaction.editReply({ files: [attachment] });
        } catch (e) {
            console.error(e);
            await interaction.editReply("❌ Erro ao gerar imagem.");
        }
    },

    async execute(message: Message | any, args: string[]) {
        if (args.length === 0 && !message.reference) return message.reply("O que eu devo citar?");

        let targetMsg = message;
        let text = args.join(" ");

        if (message.reference) {
            try {
                const refMsg = await message.channel.messages.fetch(message.reference.messageId);
                text = refMsg.content || text; // Prioriza o conteúdo da mensagem referenciada
                targetMsg = refMsg;
            } catch (e) {}
        }

        const user = targetMsg.author;
        // Pega a cor do cargo ou usa branco
        const color = targetMsg.member?.displayHexColor || '#ffffff';

        try {
            const buffer = await renderQuote(
                text, 
                user.username, 
                user.displayAvatarURL({ extension: 'png', size: 256 }), 
                color
            );
            
            const attachment = new AttachmentBuilder(buffer, { name: 'quote.png' });
            await message.reply({ files: [attachment] });
        } catch (e) {
            console.error(e);
            message.reply("❌ Falha no render.");
        }
    }
};