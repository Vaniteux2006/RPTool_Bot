// RPTool/supercommands/token/index.ts
// ─── Gerenciador de Chaves de IA (Gemini/OpenAI) ──────────────────────────────
//
// Painel por DM: criar/renomear/deletar chaves, trocar modelo, vincular/desvincular
// a servidores e testar se a chave funciona de verdade.
//
// Arquitetura (padrão ficha/futebol/status): o painel é montado aqui; os cliques
// (botões/selects/modais com customId `token_…`) são roteados pelo interactionCheckout
// para interactions.ts. SEM collectors — stateless e robusto, funciona em DM.
import {
    Message, Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Guild,
} from 'discord.js';
import { truncarCampo } from '../../tools/utils/discord/embed';
import { TokenModel } from '../../tools/models/TokenSchema';

// ─── Servidores em comum entre o usuário e o bot ──────────────────────────────
export async function getMutualGuilds(userId: string, client: Client): Promise<Guild[]> {
    const result: Guild[] = [];
    for (const guild of client.guilds.cache.values()) {
        if (guild.members.cache.has(userId)) { result.push(guild); continue; }
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) result.push(guild);
    }
    return result;
}

// ─── Lista de modelos disponíveis para uma chave (também valida a auth) ────────
export async function fetchModels(provider: 'gemini' | 'openai', key: string): Promise<string[]> {
    try {
        if (provider === 'gemini') {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
            const data: any = await res.json();
            if (!data.models) return [];
            return data.models
                .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                .map((m: any) => m.name.replace('models/', ''));
        }
        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
            const data: any = await res.json();
            if (!data.data) return [];
            return data.data.filter((m: any) => m.id.includes('gpt')).map((m: any) => m.id);
        }
        return [];
    } catch (e) {
        console.warn('[Token] Falha ao buscar modelos:', e);
        return [];
    }
}

// ─── Monta o painel (embed + botões) ──────────────────────────────────────────
export async function buildDashboardPayload(userId: string, client: Client) {
    const userData = await TokenModel.findOne({ userId });
    const keys = userData?.keys ?? [];
    const assignments = userData?.assignments ?? [];

    const keysList = keys.length > 0
        ? keys.map(k => `🔑 **${k.name || 'Sem nome'}** · ${k.provider} · \`${k.model || 'sem modelo'}\``).join('\n')
        : '_Nenhuma chave cadastrada ainda._';

    const mutual = await getMutualGuilds(userId, client);
    let serversList: string;
    if (mutual.length === 0) {
        serversList = '_Nenhum servidor em comum entre nós._';
    } else {
        serversList = mutual.map(guild => {
            const a = assignments.find(x => x.guildId === guild.id);
            if (!a) return `❌ **${guild.name}**`;
            const key = keys.find(k => k.id === a.keyId);
            return `✅ **${guild.name}** ➔ \`${key ? (key.name || key.model) : 'chave inválida'}\``;
        }).join('\n');
    }

    const embed = new EmbedBuilder()
        .setTitle('⚙️ Painel de Controle de IA (RPTool)')
        .setDescription('Gerencie as chaves que dão vida aos comandos de IA nos seus servidores.\n**Nunca compartilhe essas chaves com ninguém!**')
        .addFields(
            { name: '🔑 Suas Chaves', value: truncarCampo(keysList), inline: false },
            { name: '🌐 Servidores Vinculados', value: truncarCampo(serversList), inline: false },
        )
        .setColor(0x2b2d31)
        .setFooter({ text: 'Use os botões abaixo para gerenciar.' });

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`token_add:${userId}`).setLabel('Adicionar').setEmoji('➕').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`token_rename:${userId}`).setLabel('Renomear').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`token_model:${userId}`).setLabel('Trocar Modelo').setEmoji('🧠').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`token_del:${userId}`).setLabel('Deletar').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`token_assign:${userId}`).setLabel('Vincular').setEmoji('🔗').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`token_unassign:${userId}`).setLabel('Desvincular').setEmoji('✂️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`token_test:${userId}`).setLabel('Testar Chave').setEmoji('🧪').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`token_refresh:${userId}`).setLabel('Atualizar').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    );

    return { embeds: [embed], components: [row1, row2] };
}

export default {
    name: 'token',
    description: 'Gerencia suas chaves de API de IA (Gemini/OpenAI) via DM.',
    aliases: ['tokens', 'chave', 'apikey'],

    async execute(message: Message, _args: string[]) {
        const userId = message.author.id;

        // Garante o documento do usuário
        if (!await TokenModel.findOne({ userId })) {
            await TokenModel.create({ userId, keys: [], assignments: [] });
        }

        if (message.guild) {
            await message.reply('📩 **Por segurança, te mandei o painel de chaves no seu PV.**').catch(() => {});
        }

        try {
            const dm = await message.author.createDM();
            const payload = await buildDashboardPayload(userId, message.client);
            await dm.send(payload);
        } catch (e) {
            console.error('[Token] Falha ao abrir painel:', e);
            if (message.guild) {
                await message.reply('❌ Não consegui te enviar DM. Abra seu PV para mensagens diretas e tente de novo.').catch(() => {});
            }
        }
    },
};
