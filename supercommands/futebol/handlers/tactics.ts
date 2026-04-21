import { Message, EmbedBuilder } from 'discord.js';
import { TeamModel } from '../../../tools/models/FutebolSchema';
import { extractArgs } from '../../../tools/utils/textUtils';
import path from 'path';
import fs from 'fs';

// ─── rp!futebol tatic "Nome do Time" [FORMAÇÃO] [ESTILO] ─────────────────────
export async function handleTactics(message: Message, args: string[], userId: string) {
    const tacticsData = loadTacticsJson();
    const cleanArgs   = extractArgs(message.content, 'tatic');

    // Sem argumentos: exibe lista de opções
    if (cleanArgs.length === 0) {
        return message.reply(
            `⚽ **Configurar Tática**\n\n` +
            `**Uso:** \`rp!futebol tatic "Nome do Time" FORMAÇÃO ESTILO\`\n\n` +
            `**Formações disponíveis:**\n\`\`\`${tacticsData.formacoes.join(' • ')}\`\`\`\n` +
            `**Estilos de jogo:**\n` +
            Object.entries(tacticsData.estilos as Record<string, string>)
                .map(([k, v]) => `▸ \`${k}\` — ${v}`)
                .join('\n'),
        );
    }

    if (cleanArgs.length < 3) {
        return message.reply('⚠️ **Uso:** `rp!futebol tatic "Nome do Time" FORMAÇÃO ESTILO`');
    }

    const teamName = cleanArgs[0];
    const formacao = cleanArgs[1];
    const estilo   = cleanArgs[2].toUpperCase();

    if (!tacticsData.formacoes.includes(formacao)) {
        return message.reply(
            `❌ **Formação não reconhecida:** \`${formacao}\`\n` +
            `Use \`rp!futebol tatic\` para ver a lista completa.`,
        );
    }

    if (!tacticsData.estilos[estilo]) {
        return message.reply(
            `❌ **Estilo inválido:** \`${estilo}\`\n` +
            `Estilos disponíveis: \`${Object.keys(tacticsData.estilos).join('`, `')}\``,
        );
    }

    const team = await TeamModel.findOne({
        adminId:       userId,
        name:          new RegExp(`^${escapeRegex(teamName)}$`, 'i'),
        guildOriginId: message.guild!.id,
    });

    if (!team) {
        return message.reply(`❌ Você não é o treinador/dono de **${teamName}** neste servidor.`);
    }

    team.defaultFormation = formacao;
    team.defaultTactic    = estilo;
    await team.save();

    // Zona cega da formação escolhida (aviso ao treinador)
    const zonasCegas: Record<string, string[]> = tacticsData.zonasCegas ?? {};
    const riscos = zonasCegas[formacao] ?? [];

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle(`📋 Prancheta Atualizada: ${team.name}`)
        .setThumbnail(team.logo)
        .addFields(
            { name: '🛡️ Formação', value: formacao, inline: true },
            { name: '⚔️ Estilo',   value: estilo,   inline: true },
            { name: '📖 Filosofia', value: tacticsData.estilos[estilo], inline: false },
        );

    if (riscos.length > 0) {
        embed.addFields({
            name:  '⚠️ Alerta Tático',
            value: `Esta formação cria zonas cegas em: **${riscos.join(', ')}**. Esteja preparado para ser explorado por lá.`,
            inline: false,
        });
    }

    return message.reply({ embeds: [embed] });
}

// ─── Utilitários internos ─────────────────────────────────────────────────────
function loadTacticsJson() {
    const tacticsPath = path.join(__dirname, '../data/tactics.json');
    return JSON.parse(fs.readFileSync(tacticsPath, 'utf-8'));
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}