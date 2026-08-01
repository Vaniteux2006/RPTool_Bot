import { SlashCommandBuilder, ChatInputCommandInteraction, Message } from 'discord.js';
import { getGuildAIConfig } from '../tools/utils/tokenHelper';
import { chamarIA } from '../tools/utils/ai/client';
import { withAIRetry } from '../tools/utils/ai/retry';
import { motivoInterrupcao, rotuloRetry, descreverErroFatal } from '../tools/utils/ai/errors';
import { sanitizeOutput } from '../tools/utils/text';

export default {
    name: 'ai',
    description: 'Conversa com um NPC via IA',

    data: new SlashCommandBuilder()
        .setName('ai')
        .setDescription('Conversa com a IA')
        .addStringOption(op => op.setName('mensagem').setDescription('O que você quer falar?').setRequired(true)),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const msg = interaction.options.getString('mensagem');
        if (!msg) return;

        await interaction.deferReply();
        await this.runAI(interaction, msg);
    },

    async execute(message: Message | any, args: string[]) {
        const userMessage = args.join(' ');
        if (!userMessage) return message.reply("⚠️ Você precisa falar algo!");

        const loading = await message.reply("🧠 **[ Pensando... ]**");
        await this.runAI(loading, userMessage, true);
    },

    async runAI(target: any, text: string, isEdit = false) {
        const guildId = target.guildId || target.guild?.id;
        const responder = (t: string) => (isEdit ? target.edit(t) : target.editReply(t));

        try {
            const config = await getGuildAIConfig(guildId);
            if (!config) {
                return await responder("⚠️ Nenhum token configurado. Use `rp!token` para configurar.");
            }

            const prompt =
                `[INSTRUÇÃO DO SISTEMA]\n` +
                `Você é um bot assistente de IA. Seja útil e breve.\n` +
                `[CONTEXTO]\nResponda como RPTool. Seja imersivo.\n` +
                `[USUÁRIO]: ${text}\n[RPTool]:`;

            // Retry com teto (nunca infinito): só insiste em 503/rate-limit.
            const resultado = await withAIRetry(() => chamarIA(prompt, config), {
                onRetry: (falha, espera, tentativa) =>
                    responder(`${rotuloRetry(falha)}\n🔄 Tentando de novo em ${espera}s... (tentativa ${tentativa})`).catch(() => null),
            });

            if (!resultado.ok) {
                const { titulo, detalhe } = motivoInterrupcao(resultado.falha!);
                return await responder(`${titulo}\n${detalhe}`);
            }

            await responder(sanitizeOutput(resultado.valor!));
        } catch (error: any) {
            console.error(`[AI Error] ${error.message}`);
            await responder(descreverErroFatal(error)).catch(() => null);
        }
    }
};
