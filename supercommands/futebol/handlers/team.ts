import {
    Message,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} from 'discord.js';
import { TeamModel, ITeam } from '../../../tools/models/FutebolSchema';
import { extractArgs } from '../../../tools/utils/textUtils';
import { generateFullSquadViaAI, suggestTacticsViaAI } from '../engines/aiDirector';

const VALID_POSITIONS = ['GK', 'DEF', 'MID', 'ATK'];

function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ─── rp!futebol create "Nome" [emoji] ─────────────────────────────────────────
export async function handleCreateTeam(message: Message, args: string[], userId: string) {
    const cleanArgs = extractArgs(message.content, 'create');
    if (cleanArgs.length < 1) {
        return message.reply(
            '⚠️ **Uso:** `rp!futebol create "Nome do Time" [emoji]`\n' +
            'Anexe uma imagem para usar como escudo. O emoji aparece na tabela e nos placares.',
        );
    }

    const teamName = cleanArgs[0].trim();
    const emoji    = cleanArgs[1]?.trim() ?? '⚽';

    if (teamName.length < 2 || teamName.length > 40) {
        return message.reply('❌ O nome deve ter entre 2 e 40 caracteres.');
    }

    const attachment = message.attachments.first();
    const logoUrl    = attachment?.url ?? 'https://i.imgur.com/vH1Wf2A.png';

    const exists = await TeamModel.findOne({
        name:          new RegExp(`^${escapeRegex(teamName)}$`, 'i'),
        guildOriginId: message.guild!.id,
    });
    if (exists) return message.reply(`❌ Já existe um clube **${teamName}** neste servidor.`);

    const newTeam = await TeamModel.create({
        adminId: userId, name: teamName, logo: logoUrl, emoji,
        guildOriginId: message.guild!.id,
    });

    const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle(`${emoji} Clube Fundado: ${newTeam.name}`)
        .setDescription(`👤 **Presidente:** <@${userId}>\n\nUse \`rp!futebol addplayer\` para contratar jogadores, ou \`rp!futebol add "${teamName}" -ai\` para gerar um elenco completo via IA!`)
        .setThumbnail(newTeam.logo)
        .addFields(
            { name: '🛡️ Formação', value: newTeam.defaultFormation, inline: true },
            { name: '⚔️ Tática',   value: newTeam.defaultTactic,    inline: true },
            { name: '🎨 Emoji',    value: emoji,                     inline: true },
        )
        .setFooter({ text: `ID: ${newTeam._id}` });

    return message.reply({ embeds: [embed] });
}

// ─── rp!futebol add "Nome" -ai (gera 22 jogadores via IA) ─────────────────────
export async function handleAISquad(message: Message, args: string[], userId: string) {
    const rawArgs   = extractArgs(message.content, 'add');
    const teamName  = rawArgs[0];
    const targetOvr = rawArgs[1] ? parseInt(rawArgs[1], 10) : 80;

    if (!teamName) return message.reply('⚠️ **Uso:** `rp!futebol add "Nome do Time" [OVR] -ai`');

    const attachment = message.attachments.first();
    const logoUrl    = attachment?.url ?? 'https://i.imgur.com/vH1Wf2A.png';
    const emoji      = rawArgs[2] && !rawArgs[2].startsWith('-') ? rawArgs[2] : '⚽';

    const waitMsg = await message.reply(`🤖 Gerando elenco completo para **${teamName}** (OVR ~${isNaN(targetOvr) ? 80 : targetOvr}) via IA...`);

    const ovr = isNaN(targetOvr) ? 80 : targetOvr;
    const result = await generateFullSquadViaAI(message.guild!.id, teamName, ovr);

    if (!result) return waitMsg.edit('❌ Falha ao gerar o elenco. Tente criar o time manualmente com `rp!futebol create`.');

    // Verifica se o time já existe; se não, cria
    let team = await TeamModel.findOne({
        name:          new RegExp(`^${escapeRegex(teamName)}$`, 'i'),
        guildOriginId: message.guild!.id,
    });

    if (!team) {
        team = await TeamModel.create({
            adminId: userId, name: teamName, logo: logoUrl, emoji,
            guildOriginId: message.guild!.id,
            defaultFormation: result.formation,
            defaultTactic:    result.tactic,
        });
    } else {
        if (team.adminId !== userId) return waitMsg.edit('❌ Você não é o dono deste time.');
        team.defaultFormation = result.formation;
        team.defaultTactic    = result.tactic;
    }

    team.players = result.players as any;
    await team.save();

    const starters  = result.players.filter(p => p.isStarter);
    const bench     = result.players.filter(p => !p.isStarter);

    const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle(`🤖 Elenco Gerado por IA: ${teamName}`)
        .setThumbnail(logoUrl)
        .setDescription(
            `**Formação:** \`${result.formation}\` | **Estilo:** \`${result.tactic}\`\n\n` +
            `✅ **${starters.length} titulares** e **${bench.length} reservas** prontos para jogar!`,
        )
        .addFields(
            {
                name:  '👕 XI Titular',
                value: starters.map(p => `\`${String(p.number).padStart(2,'0')}\` ${p.name} — ${p.position} ${p.overall}OVR`).join('\n'),
                inline: false,
            },
            {
                name:  '🪑 Banco de Reservas',
                value: bench.slice(0, 6).map(p => `\`${String(p.number).padStart(2,'0')}\` ${p.name} — ${p.position} ${p.overall}OVR`).join('\n') + (bench.length > 6 ? `\n*…e mais ${bench.length - 6}*` : ''),
                inline: false,
            },
        );

    return waitMsg.edit({ content: '', embeds: [embed] });
}

// ─── rp!futebol addplayer "Time" "Jogador" POS OVR [arquétipo] ────────────────
export async function handleAddPlayer(message: Message, args: string[], userId: string) {
    const cleanArgs = extractArgs(message.content, 'addplayer');
    if (cleanArgs.length < 4) {
        return message.reply(
            '⚠️ **Uso:** `rp!futebol addplayer "Time" "Jogador" [GK|DEF|MID|ATK] [1-100] [arquétipo] [titular|reserva]`',
        );
    }

    const teamName   = cleanArgs[0];
    const playerName = cleanArgs[1];
    const position   = cleanArgs[2]?.toUpperCase() as 'GK' | 'DEF' | 'MID' | 'ATK';
    const archetype  = cleanArgs[4] ?? 'Balanceado';
    const isStarter  = cleanArgs[5]?.toLowerCase() !== 'reserva';

    if (!VALID_POSITIONS.includes(position)) return message.reply(`❌ Posição inválida: **${position}**. Use GK, DEF, MID ou ATK.`);

    // BUG FIX: parseInt("99.237...") silenciosamente retorna 99 e passa na validação.
    // Rejeitamos qualquer valor com ponto decimal explicitamente.
    const overallRaw = cleanArgs[3] ?? '';
    if (overallRaw.includes('.')) return message.reply('❌ Overall deve ser um número inteiro (ex: `85`, não `99.5`).');
    const overall = parseInt(overallRaw, 10);
    if (isNaN(overall) || overall < 1 || overall > 100) return message.reply('❌ Overall deve ser um número inteiro entre 1 e 100.');

    const team = await TeamModel.findOne({ adminId: userId, name: new RegExp(`^${escapeRegex(teamName)}$`, 'i'), guildOriginId: message.guild!.id });
    if (!team) return message.reply(`❌ Você não é o dono de **${teamName}** neste servidor.`);
    if (team.players.length >= 40) return message.reply('❌ Elenco lotado! Máximo de 40 jogadores.');

    team.players.push({ name: playerName, position, age: parseInt(cleanArgs[6] ?? '22', 10) || 22, number: parseInt(cleanArgs[7] ?? '10', 10) || 10, overall, archetype, energy: 100, sharpness: 50, morale: 3, isStarter } as any);
    await team.save();

    const posEmoji: Record<string, string> = { GK: '🧤', DEF: '🛡️', MID: '⚙️', ATK: '⚽' };
    return message.reply(`${posEmoji[position]} **${playerName}** (OVR:${overall} | ${position} | ${archetype} | ${isStarter ? 'titular' : '🪑 reserva'}) contratado pelo **${team.name}**!`);
}

// ─── rp!futebol delete "Nome" ──────────────────────────────────────────────────
export async function handleDeleteTeam(message: Message, args: string[], userId: string) {
    const cleanArgs = extractArgs(message.content, 'delete');
    if (!cleanArgs[0]) return message.reply('⚠️ **Uso:** `rp!futebol delete "Nome do Time"`');

    const team = await TeamModel.findOneAndDelete({ adminId: userId, name: new RegExp(`^${escapeRegex(cleanArgs[0])}$`, 'i'), guildOriginId: message.guild!.id });
    if (!team) return message.reply(`❌ Time **${cleanArgs[0]}** não encontrado ou você não é o dono.`);

    return message.reply(`🗑️ O clube **${team.name}** foi dissolvido.`);
}

// ─── rp!futebol squad "Nome" ──────────────────────────────────────────────────
export async function handleViewSquad(message: Message, args: string[]) {
    const cleanArgs = extractArgs(message.content, 'squad');
    if (!cleanArgs[0]) return message.reply('⚠️ **Uso:** `rp!futebol squad "Nome do Time"`');

    const team = await TeamModel.findOne({ name: new RegExp(`^${escapeRegex(cleanArgs[0])}$`, 'i'), guildOriginId: message.guild!.id });
    if (!team) return message.reply(`❌ Time **${cleanArgs[0]}** não encontrado.`);

    const fmt = (p: any) => `\`${String(p.number).padStart(2,'0')}\` ${p.isStarter ? '' : '🪑'}**${p.name}** — OVR ${p.overall} | ${p.archetype}`;

    const byPos = (pos: string) => team.players.filter(p => p.position === pos);

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle(`${team.emoji} ${team.name} — Elenco Completo`)
        .setThumbnail(team.logo)
        .setDescription(`👤 <@${team.adminId}> • \`${team.defaultFormation}\` • **${team.defaultTactic}**\n**${team.players.length} jogadores** registrados`)
        .addFields(
            { name: '🧤 GK',  value: byPos('GK').map(fmt).join('\n')  || '*Nenhum*', inline: false },
            { name: '🛡️ DEF', value: byPos('DEF').map(fmt).join('\n') || '*Nenhum*', inline: false },
            { name: '⚙️ MID', value: byPos('MID').map(fmt).join('\n') || '*Nenhum*', inline: false },
            { name: '⚽ ATK', value: byPos('ATK').map(fmt).join('\n') || '*Nenhum*', inline: false },
        )
        .setFooter({ text: `🪑 = reserva • ID: ${team._id}` });

    return message.reply({ embeds: [embed] });
}

// ─── rp!futebol suggest "Nome" ────────────────────────────────────────────────
// Sugestão 2: IA analisa o elenco e recomenda formação + tática
export async function handleSuggestTactics(message: Message, args: string[], userId: string) {
    const cleanArgs = extractArgs(message.content, 'suggest');
    if (!cleanArgs[0]) return message.reply('⚠️ **Uso:** `rp!futebol suggest "Nome do Time"`');

    const team = await TeamModel.findOne({ adminId: userId, name: new RegExp(`^${escapeRegex(cleanArgs[0])}$`, 'i'), guildOriginId: message.guild!.id });
    if (!team) return message.reply(`❌ Você não é o dono de **${cleanArgs[0]}** neste servidor.`);

    const waitMsg = await message.reply('🧠 Analisando o elenco via IA...');

    // BUG FIX: passa callback onRetry para avisar o usuário sobre erros 503
    // ao invés de silenciosamente retornar "Tente novamente" sem contexto
    const onRetry = (attempt: number) =>
        waitMsg.edit(`🔥 **Erro 503 — Servidores da IA sobrecarregados.** Tentando novamente... (${attempt}/3)`).catch(() => null);

    const suggestion = await suggestTacticsViaAI(message.guild!.id, team, onRetry);

    if (!suggestion) {
        return waitMsg.edit(
            '❌ Não foi possível gerar a sugestão tática após 3 tentativas.\n' +
            '-# Os servidores da IA estão sobrecarregados (503). Tente novamente em alguns minutos.',
        );
    }

    const embed = new EmbedBuilder()
        .setColor('Purple')
        .setTitle(`🧠 Sugestão Tática: ${team.name}`)
        .addFields(
            { name: '🛡️ Formação Sugerida', value: suggestion.formation, inline: true },
            { name: '⚔️ Estilo Sugerido',   value: suggestion.tactic,    inline: true },
            { name: '💡 Análise da IA',      value: suggestion.reason,    inline: false },
        )
        .setFooter({ text: 'Use rp!futebol tatic para aplicar esta sugestão manualmente' });

    const applyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`fb_apply_tactic_${team._id}_${suggestion.formation}_${suggestion.tactic}`)
            .setLabel('✅ Aplicar Esta Tática')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('fb_dismiss')
            .setLabel('❌ Ignorar')
            .setStyle(ButtonStyle.Danger),
    );

    await waitMsg.edit({ content: '', embeds: [embed], components: [applyRow] });
}

// ─── rp!futebol emoji "Nome" EMOJI ───────────────────────────────────────────
// Sugestão 8: definir/alterar o emoji do time
export async function handleSetEmoji(message: Message, args: string[], userId: string) {
    const cleanArgs = extractArgs(message.content, 'emoji');
    if (cleanArgs.length < 2) return message.reply('⚠️ **Uso:** `rp!futebol emoji "Nome do Time" 🎯`');

    const teamName = cleanArgs[0];
    const emoji    = cleanArgs[1];

    const team = await TeamModel.findOne({ adminId: userId, name: new RegExp(`^${escapeRegex(teamName)}$`, 'i'), guildOriginId: message.guild!.id });
    if (!team) return message.reply(`❌ Você não é o dono de **${teamName}** neste servidor.`);

    team.emoji = emoji;
    await team.save();

    return message.reply(`${emoji} Emoji do **${team.name}** atualizado para **${emoji}**!`);
}

// ─── rp!futebol list userlist [@usuario] / serverlist ─────────────────────────
export async function handleList(message: Message, args: string[]) {
    const sub = args[1]?.toLowerCase();

    let teams: ITeam[];
    let title: string;

    if (sub === 'userlist') {
        // Permite consultar times de outro usuário: rp!futebol list userlist @alguem
        const targetMention = args[2];
        const targetId      = targetMention
            ? targetMention.replace(/[<@!>]/g, '')
            : message.author.id;

        teams = await TeamModel.find({ adminId: targetId });
        title = targetId === message.author.id
            ? `⚽ Seus Times`
            : `⚽ Times de <@${targetId}>`;
    } else {
        teams = await TeamModel.find({ guildOriginId: message.guild!.id });
        title = `⚽ Times do Servidor — ${message.guild!.name}`;
    }

    if (teams.length === 0) {
        return message.reply(sub === 'userlist'
            ? '📭 Nenhum time registrado para este usuário.'
            : '📭 Nenhum time registrado neste servidor ainda.');
    }

    await sendTeamList(message, teams, title);
}

// ─── Renderizador paginado com pesquisa ───────────────────────────────────────
async function sendTeamList(message: Message, allTeams: ITeam[], title: string) {
    const PAGE_SIZE = 10;
    let filtered    = allTeams;
    let page        = 0;

    const buildEmbed = (teams: ITeam[], pg: number, totalPages: number, query = '') => {
        const lines = teams
            .slice(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE)
            .map((t, i) => {
                const idx   = pg * PAGE_SIZE + i + 1;
                const owner = `<@${t.adminId}>`;
                const count = t.players.length;
                return `\`${String(idx).padStart(2)}\` ${t.emoji} **${t.name}** — ${count} jogadores • ${t.defaultFormation} • ${owner}`;
            });

        return new EmbedBuilder()
            .setColor('Blue')
            .setTitle(title)
            .setDescription(
                (query ? `🔍 Pesquisa: **${query}** — ${filtered.length} resultado(s)\n\n` : '') +
                (lines.join('\n') || '*Nenhum resultado.*'),
            )
            .setFooter({ text: `Página ${pg + 1}/${totalPages} • ${filtered.length} time(s) total` });
    };

    const totalPages = () => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

    const buildRows = (pg: number) => {
        const tp = totalPages();
        const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('fb_list_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(pg === 0),
            new ButtonBuilder().setCustomId('fb_list_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(pg >= tp - 1),
        );

        // Select menu de pesquisa (opções A–Z dos times)
        const searchOptions = filtered.slice(0, 25).map(t =>
            new StringSelectMenuOptionBuilder()
                .setLabel(t.name.slice(0, 50))
                .setDescription(`${t.emoji} ${t.defaultFormation} • ${t.players.length} jogadores`)
                .setValue(t._id.toString())
                .setEmoji(t.emoji.length <= 2 ? t.emoji : '⚽'),
        );

        const searchRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('fb_list_search')
                .setPlaceholder('🔍 Pesquisar um time...')
                .addOptions(searchOptions.length > 0 ? searchOptions : [new StringSelectMenuOptionBuilder().setLabel('Nenhum time').setValue('none')]),
        );

        return [navRow, searchRow];
    };

    const embed = buildEmbed(filtered, page, totalPages());
    const sentMsg = await message.reply({ embeds: [embed], components: buildRows(page) });

    const collector = sentMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120_000,
        filter: (i) => i.user.id === message.author.id,
    });

    const selectCollector = sentMsg.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 120_000,
        filter: (i) => i.user.id === message.author.id,
    });

    collector.on('collect', async (i) => {
        if (i.customId === 'fb_list_prev') page = Math.max(0, page - 1);
        if (i.customId === 'fb_list_next') page = Math.min(totalPages() - 1, page + 1);
        await i.update({ embeds: [buildEmbed(filtered, page, totalPages())], components: buildRows(page) });
    });

    selectCollector.on('collect', async (i) => {
        const teamId = i.values[0];
        if (teamId === 'none') { await i.deferUpdate(); return; }

        const found = allTeams.find(t => t._id.toString() === teamId);
        if (!found) { await i.deferUpdate(); return; }

        // Mostra detalhes do time selecionado efêmeramente
        const detail = new EmbedBuilder()
            .setColor('Blue')
            .setTitle(`${found.emoji} ${found.name}`)
            .setThumbnail(found.logo)
            .setDescription(`👤 <@${found.adminId}> • \`${found.defaultFormation}\` ${found.defaultTactic}`)
            .addFields(
                { name: 'Jogadores',  value: String(found.players.length), inline: true },
                { name: 'Titulares', value: String(found.players.filter(p => p.isStarter).length), inline: true },
                { name: 'Reservas',  value: String(found.players.filter(p => !p.isStarter).length), inline: true },
            );

        await i.reply({ embeds: [detail], ephemeral: true });
    });

    collector.on('end', () => {
        sentMsg.edit({ components: [] }).catch(() => null);
    });
}