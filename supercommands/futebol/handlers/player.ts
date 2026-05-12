// RPTool/supercommands/futebol/handlers/player.ts
import { Message, EmbedBuilder } from 'discord.js';
import { TeamModel, IPlayer, VALID_ARCHETYPES } from '../../../tools/models/FutebolSchema';
import { calculateOverallFromStats, hasCustomStats } from '../engines/mathEngine';
import { extractArgs } from '../../../tools/utils/textUtils';

function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function clamp(n: number, min = 1, max = 99) { return Math.min(max, Math.max(min, Math.round(n))); }

// ─── Flag parser: extrai "-pac 85 -sho 92 ..." em Record ─────────────────────
function parseStatFlags(args: string[]): Record<string, number> {
    const stats: Record<string, number> = {};
    const STAT_FLAGS = ['pac','sho','pas','dri','def','phy','div','ref','han','kic','spe','pos',
                        'age','num','number','energy','sharpness','morale'];
    for (let i = 0; i < args.length; i++) {
        if (!args[i].startsWith('-')) continue;
        const key = args[i].slice(1).toLowerCase();
        if (!STAT_FLAGS.includes(key)) continue;
        const val = parseFloat(args[i + 1] ?? '');
        if (!isNaN(val)) { stats[key] = clamp(val); i++; }
    }
    return stats;
}

// ─── Descrição detalhada de cada arquétipo ────────────────────────────────────
const ARCHETYPE_DESC: Record<string, string> = {
    'Muralha':    '🧤 Goleiro dominador de área. Alto DEF/PHY.',
    'Reflexo':    '🧤 Goleiro de reações. Alto DEF, médio PHY.',
    'Xerife':     '🛡️ Zagueiro central clássico. Alto DEF/PHY.',
    'Construtor': '🛡️ Zagueiro que sai jogando. Alto DEF/PAS.',
    'Lateral_Of': '🛡️ Lateral ofensivo. Alto PAC/DRI.',
    'Trator':     '⚙️ Volante destruidor. Alto DEF/PHY.',
    'Caixeiro':   '⚙️ Meia box-to-box. Equilíbrio geral.',
    'Maestro':    '⚙️ Camisa 10 armador. Alto PAS/DRI.',
    'Velocista':  '⚡ Ponta extremo. Alto PAC/DRI.',
    'Dribblador': '⚡ Ponta de habilidade. Alto DRI/PAC.',
    'Matador':    '⚡ Centroavante artilheiro. Alto SHO/PHY.',
    'Pivô':       '⚡ Centroavante de referência. Alto PHY/SHO.',
    'Coringa':    '🔄 Polivalente. Stats balanceados.',
    'Balanceado': '⚖️ Genérico. OVR distribuído igualmente.',
};

// ─── Cores por OVR (estilo FIFA) ──────────────────────────────────────────────
function getCardColor(ovr: number): number {
    if (ovr >= 90) return 0xFFD700; // Dourado (TOTY/TOTS)
    if (ovr >= 85) return 0xC0C0C0; // Prata (Gold)
    if (ovr >= 75) return 0xCD7F32; // Bronze
    return 0x808080;                 // Cinza
}

// ─── Constrói o embed no estilo card do FIFA ──────────────────────────────────
function buildPlayerCard(player: IPlayer, teamName: string): EmbedBuilder {
    const ovr   = player.overall;
    const color = getCardColor(ovr);
    const isGK  = player.position === 'GK';
    const hasCS = hasCustomStats(player);

    // Define os stats a exibir
    let leftStats:  string;
    let rightStats: string;

    if (isGK && hasCS) {
        leftStats = [
            `**${String(player.div ?? '—').padStart(2)}** DIV`,
            `**${String(player.ref ?? '—').padStart(2)}** REF`,
            `**${String(player.han ?? '—').padStart(2)}** HAN`,
        ].join('\n');
        rightStats = [
            `**${String(player.kic ?? '—').padStart(2)}** KIC`,
            `**${String(player.spe ?? '—').padStart(2)}** SPE`,
            `**${String(player.pos ?? '—').padStart(2)}** POS`,
        ].join('\n');
    } else if (!isGK && hasCS) {
        leftStats = [
            `**${String(player.pac ?? '—').padStart(2)}** PAC`,
            `**${String(player.sho ?? '—').padStart(2)}** SHO`,
            `**${String(player.pas ?? '—').padStart(2)}** PAS`,
        ].join('\n');
        rightStats = [
            `**${String(player.dri ?? '—').padStart(2)}** DRI`,
            `**${String(player.def ?? '—').padStart(2)}** DEF`,
            `**${String(player.phy ?? '—').padStart(2)}** PHY`,
        ].join('\n');
    } else {
        // Stats derivados do arquétipo (informativos)
        const { calculateTeamStats: _, getPlayerMacros, getEffectiveOverall } = require('../engines/mathEngine');
        const { getPlayerMacros: macros, getEffectiveOverall: effOvr } = require('../engines/mathEngine');
        const m = macros(player);
        leftStats = [
            `**${String(m.PAC).padStart(2)}** PAC *(estimado)*`,
            `**${String(m.SHO).padStart(2)}** SHO *(estimado)*`,
            `**${String(m.PAS).padStart(2)}** PAS *(estimado)*`,
        ].join('\n');
        rightStats = [
            `**${String(m.DRI).padStart(2)}** DRI *(estimado)*`,
            `**${String(m.DEF).padStart(2)}** DEF *(estimado)*`,
            `**${String(m.PHY).padStart(2)}** PHY *(estimado)*`,
        ].join('\n');
    }

    const posEmoji: Record<string, string> = { GK: '🧤', DEF: '🛡️', MID: '⚙️', ATK: '⚡' };

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${posEmoji[player.position] ?? '⚽'} ${player.name}`)
        .setDescription(
            `# ${ovr}\n` +
            `**${player.position}** · ${teamName}\n` +
            (hasCS ? '' : `-# Stats estimados pelo arquétipo **${player.archetype}**`),
        )
        .addFields(
            { name: '\u200B',    value: leftStats,  inline: true },
            { name: '\u200B',    value: rightStats, inline: true },
            { name: '\u200B',    value: '\u200B',   inline: false },
            { name: '📋 Perfil', value: [
                `**Arquétipo:** ${player.archetype}`,
                `**Idade:** ${player.age}  |  **Nº** ${player.number}`,
                `**Status:** ${player.isStarter ? '👕 Titular' : '🪑 Reserva'}`,
                `\n**🔋 Energia:** ${player.energy}/100  |  **⚡ Ritmo:** ${player.sharpness}/100  |  **❤️ Moral:** ${'⭐'.repeat(player.morale)}`,
            ].join('\n'), inline: false },
        )
        .setFooter({ text: `${hasCS ? '✅ Stats customizados' : '🔧 Stats derivados de arquétipo — use rp!futebol player edit para customizar'}` });

    return embed;
}

// ─── rp!futebol player create "Time" "Nome" POS [-stat N] [-arch X] ───────────
export async function handlePlayerCreate(message: Message, args: string[], userId: string) {
    const cleanArgs = extractArgs(message.content, 'player create');

    if (cleanArgs.length < 3) {
        return message.reply(
            '⚠️ **Uso:** `rp!futebol player create "Time" "Jogador" POS [flags]`\n\n' +
            '**Outfield:** `-pac` `-sho` `-pas` `-dri` `-def` `-phy`\n' +
            '**GK:** `-div` `-ref` `-han` `-kic` `-spe` `-pos`\n' +
            '**Extras:** `-arch Arquétipo` `-num 10` `-age 25` `-energy 100`\n' +
            '**Banco:** adicione `reserva` no final\n\n' +
            '**Exemplo Messi:**\n' +
            '`rp!futebol player create "PSG" "Lionel Messi" ATK -pac 85 -sho 92 -pas 91 -dri 95 -def 34 -phy 65 -arch Dribblador -num 30 -age 34`\n\n' +
            '**Exemplo Oblak:**\n' +
            '`rp!futebol player create "Atlético Madrid" "Jan Oblak" GK -div 87 -ref 89 -han 92 -kic 78 -spe 50 -pos 90 -arch Muralha -num 1 -age 29`',
        );
    }

    const teamName   = cleanArgs[0];
    const playerName = cleanArgs[1];
    const position   = cleanArgs[2]?.toUpperCase() as IPlayer['position'];
    const isStarter  = !args.includes('reserva');

    if (!['GK', 'DEF', 'MID', 'ATK'].includes(position)) {
        return message.reply('❌ Posição inválida. Use: `GK`, `DEF`, `MID` ou `ATK`.');
    }

    const team = await TeamModel.findOne({ adminId: userId, name: new RegExp(`^${escapeRegex(teamName)}$`, 'i'), guildOriginId: message.guild!.id });
    if (!team) return message.reply(`❌ Você não é o dono de **${teamName}** neste servidor.`);
    if (team.players.length >= 40) return message.reply('❌ Elenco lotado! Máximo de 40 jogadores.');

    // Valida o nome do jogador (não pode ser genérico)
    if (!playerName || playerName.trim().length < 2) {
        return message.reply('❌ Nome do jogador deve ter pelo menos 2 caracteres.');
    }

    const flags    = parseStatFlags(args);
    const archRaw  = args[args.indexOf('-arch') + 1] ?? (position === 'GK' ? 'Muralha' : 'Balanceado');
    const archetype = VALID_ARCHETYPES.includes(archRaw as any) ? archRaw : (position === 'GK' ? 'Muralha' : 'Balanceado');

    if (archRaw && !VALID_ARCHETYPES.includes(archRaw as any)) {
        return message.reply(
            `❌ Arquétipo **${archRaw}** inválido.\n` +
            `Use \`rp!futebol player archetypes\` para ver a lista completa.`,
        );
    }

    // Determina se tem stats customizados
    const isGK = position === 'GK';
    const gkStats    = isGK ? { div: flags.div, ref: flags.ref, han: flags.han, kic: flags.kic, spe: flags.spe, pos: flags.pos } : {};
    const fieldStats = !isGK ? { pac: flags.pac, sho: flags.sho, pas: flags.pas, dri: flags.dri, def: flags.def, phy: flags.phy } : {};

    // Calcula OVR automaticamente se tem stats customizados; senão usa o passado ou 65
    const hasAnyCustom = isGK
        ? Object.values(gkStats).some(v => v != null)
        : Object.values(fieldStats).some(v => v != null);

    let overall: number;
    if (hasAnyCustom) {
        overall = calculateOverallFromStats(position, isGK ? gkStats : fieldStats);
    } else {
        // Sem stats customizados: verifica se passou OVR no cleanArgs[3]
        const rawOvr = cleanArgs[3];
        if (rawOvr && !rawOvr.startsWith('-') && !isNaN(parseInt(rawOvr, 10))) {
            overall = clamp(parseInt(rawOvr, 10), 1, 100);
        } else {
            overall = 65; // padrão
        }
    }

    const newPlayer: any = {
        name:      playerName.trim(),
        position,
        age:       flags.age ?? 22,
        number:    flags.num ?? flags.number ?? 10,
        overall,
        archetype,
        energy:    flags.energy ?? 100,
        sharpness: flags.sharpness ?? 50,
        morale:    3,
        isStarter,
        ...( isGK ? {
            div: flags.div ?? null,
            ref: flags.ref ?? null,
            han: flags.han ?? null,
            kic: flags.kic ?? null,
            spe: flags.spe ?? null,
            pos: flags.pos ?? null,
        } : {
            pac: flags.pac ?? null,
            sho: flags.sho ?? null,
            pas: flags.pas ?? null,
            dri: flags.dri ?? null,
            def: flags.def ?? null,
            phy: flags.phy ?? null,
        }),
    };

    team.players.push(newPlayer);
    await team.save();

    // Busca de volta o jogador salvo para exibir o card
    const savedPlayer = team.players[team.players.length - 1];
    const card = buildPlayerCard(savedPlayer as unknown as IPlayer, team.name);

    return message.reply({
        content: `✅ **${playerName}** contratado pelo **${team.name}**! (OVR: **${overall}**)`,
        embeds:  [card],
    });
}

// ─── rp!futebol player view "Time" "Jogador" ──────────────────────────────────
export async function handlePlayerView(message: Message, args: string[]) {
    const cleanArgs = extractArgs(message.content, 'player view');
    if (cleanArgs.length < 2) return message.reply('⚠️ **Uso:** `rp!futebol player view "Time" "Jogador"`');

    const teamName   = cleanArgs[0];
    const playerName = cleanArgs[1];

    const team = await TeamModel.findOne({ name: new RegExp(`^${escapeRegex(teamName)}$`, 'i'), guildOriginId: message.guild!.id });
    if (!team) return message.reply(`❌ Time **${teamName}** não encontrado.`);

    const player = team.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
    if (!player) return message.reply(`❌ Jogador **${playerName}** não encontrado no elenco de **${team.name}**.`);

    return message.reply({ embeds: [buildPlayerCard(player as unknown as IPlayer, team.name)] });
}

// ─── rp!futebol player edit "Time" "Jogador" [-pac N] [-sho N] ... ────────────
export async function handlePlayerEdit(message: Message, args: string[], userId: string) {
    const cleanArgs = extractArgs(message.content, 'player edit');
    if (cleanArgs.length < 2) {
        return message.reply(
            '⚠️ **Uso:** `rp!futebol player edit "Time" "Jogador" [-stat Valor]`\n' +
            'Edita apenas os stats que você passar. Ex: `-pac 95 -sho 94`',
        );
    }

    const teamName   = cleanArgs[0];
    const playerName = cleanArgs[1];

    const team = await TeamModel.findOne({ adminId: userId, name: new RegExp(`^${escapeRegex(teamName)}$`, 'i'), guildOriginId: message.guild!.id });
    if (!team) return message.reply(`❌ Você não é o dono de **${teamName}** neste servidor.`);

    const playerIdx = team.players.findIndex(p => p.name.toLowerCase() === playerName.toLowerCase());
    if (playerIdx === -1) return message.reply(`❌ Jogador **${playerName}** não encontrado no elenco.`);

    const flags = parseStatFlags(args);

    // Arquétipo — valida se passou
    const archIdx = args.indexOf('-arch');
    if (archIdx !== -1 && args[archIdx + 1]) {
        const newArch = args[archIdx + 1];
        if (!VALID_ARCHETYPES.includes(newArch as any)) {
            return message.reply(`❌ Arquétipo **${newArch}** inválido. Use \`rp!futebol player archetypes\`.'`);
        }
        (team.players[playerIdx] as any).archetype = newArch;
    }

    // Aplica cada flag recebida
    const STAT_KEYS = ['pac','sho','pas','dri','def','phy','div','ref','han','kic','spe','pos','age','energy','sharpness','morale'];
    const numKey    = args.indexOf('-num');
    if (numKey !== -1 && args[numKey + 1]) (team.players[playerIdx] as any).number = parseInt(args[numKey + 1], 10);

    for (const key of STAT_KEYS) {
        if (flags[key] !== undefined) (team.players[playerIdx] as any)[key] = flags[key];
    }

    // Recalcula OVR se algum stat foi alterado
    const p = team.players[playerIdx] as unknown as IPlayer;
    if (hasCustomStats(p)) {
        const isGK = p.position === 'GK';
        const statsObj = isGK
            ? { div: p.div, ref: p.ref, han: p.han, kic: p.kic, spe: p.spe, pos: p.pos }
            : { pac: p.pac, sho: p.sho, pas: p.pas, dri: p.dri, def: p.def, phy: p.phy };
        (team.players[playerIdx] as any).overall = calculateOverallFromStats(p.position, statsObj);
    }

    team.markModified('players');
    await team.save();

    const updated = team.players[playerIdx];
    return message.reply({
        content: `✅ **${updated.name}** atualizado! OVR: **${updated.overall}**`,
        embeds:  [buildPlayerCard(updated as unknown as IPlayer, team.name)],
    });
}

// ─── rp!futebol player remove "Time" "Jogador" ───────────────────────────────
export async function handlePlayerRemove(message: Message, args: string[], userId: string) {
    const cleanArgs = extractArgs(message.content, 'player remove');
    if (cleanArgs.length < 2) return message.reply('⚠️ **Uso:** `rp!futebol player remove "Time" "Jogador"`');

    const teamName   = cleanArgs[0];
    const playerName = cleanArgs[1];

    const team = await TeamModel.findOne({ adminId: userId, name: new RegExp(`^${escapeRegex(teamName)}$`, 'i'), guildOriginId: message.guild!.id });
    if (!team) return message.reply(`❌ Você não é o dono de **${teamName}** neste servidor.`);

    const before = team.players.length;
    team.players = team.players.filter(p => p.name.toLowerCase() !== playerName.toLowerCase()) as any;

    if (team.players.length === before) {
        return message.reply(`❌ Jogador **${playerName}** não encontrado no elenco.`);
    }

    await team.save();
    return message.reply(`🗑️ **${playerName}** dispensado do **${team.name}**.`);
}

// ─── rp!futebol player archetypes ─────────────────────────────────────────────
export async function handlePlayerArchetypes(message: Message) {
    const lines = VALID_ARCHETYPES.map(a => `▸ \`${a}\` — ${ARCHETYPE_DESC[a] ?? '—'}`);

    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('📚 Arquétipos Disponíveis')
        .setDescription(
            lines.join('\n') +
            '\n\n**Como usar:** `rp!futebol player create "Time" "Nome" ATK -arch Matador ...`\n' +
            'O arquétipo define como o OVR é distribuído quando **não** há stats customizados.\n' +
            'Com stats customizados (`-pac`, `-sho`, etc.), o arquétipo é apenas descritivo.',
        );

    return message.reply({ embeds: [embed] });
}

// ─── Router do subcomando player ──────────────────────────────────────────────
export async function handlePlayerRouter(message: Message, args: string[], userId: string) {
    const sub = args[1]?.toLowerCase();

    switch (sub) {
        case 'create':
        case 'criar':
            return handlePlayerCreate(message, args, userId);

        case 'view':
        case 'ver':
        case 'card':
            return handlePlayerView(message, args);

        case 'edit':
        case 'editar':
        case 'update':
            return handlePlayerEdit(message, args, userId);

        case 'remove':
        case 'remover':
        case 'dispensar':
            return handlePlayerRemove(message, args, userId);

        case 'archetypes':
        case 'arquetipos':
        case 'arquétipos':
            return handlePlayerArchetypes(message);

        default:
            return message.reply(
                '⚽ **rp!futebol player** — Sistema de Jogadores\n\n' +
                '`rp!futebol player create "Time" "Nome" POS [-pac N] [-sho N] ...` — cria jogador customizado\n' +
                '`rp!futebol player view "Time" "Nome"` — exibe o card do jogador\n' +
                '`rp!futebol player edit "Time" "Nome" [-pac N] ...` — edita stats\n' +
                '`rp!futebol player remove "Time" "Nome"` — dispensa jogador\n' +
                '`rp!futebol player archetypes` — lista todos os arquétipos\n\n' +
                '**Flags de outfield:** `-pac` `-sho` `-pas` `-dri` `-def` `-phy`\n' +
                '**Flags de GK:** `-div` `-ref` `-han` `-kic` `-spe` `-pos`\n' +
                '**Flags extras:** `-arch` `-num` `-age` · adicione `reserva` pro banco\n\n' +
                '`rp!futebol addplayer` ainda funciona para adição rápida sem stats.',
            );
    }
}