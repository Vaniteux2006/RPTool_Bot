import {
    Message,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    TextChannel, MessageFlags } from 'discord.js';
import { ITeam, IPlayer } from '../../../tools/models/FutebolSchema';
import { MatchReportModel } from '../../../tools/models/FutebolReportSchema';
import { getEffectiveOverall, hasCustomStats, generateGenericPlayers } from './mathEngine';
import { Rng } from './brasfoot/rng';
import { liveMatch, autoLineup, type EnginePlayer, type LiveMatch, type MatchEvent, type Side } from './brasfoot/core';
import { formationSlots, sectorOf, STYLE_EFFECT, tacticalEdge, ARCHETYPE_SKILLS, SECTOR_SKILL } from './brasfoot/tables';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type TacticStyle = 'BALANCEADO' | 'POSSE' | 'CONTRA_ATAQUE' | 'RETRANCA' | 'PRESSAO';

// Interface exportada para que match.ts possa tipar o objeto sem ambiguidade
export interface IrlOptions {
    message: Message;
    secondsPerMinute: number;   // 10–60 s por minuto de jogo
    homeAdminId: string;
    awayAdminId: string;
    cancelToken: { cancelled: boolean }; // flag mutável para cancelamento
}

export interface MatchResult {
    homeScore: number;
    awayScore: number;
    finalPossessionHome: number;
    finalPossessionAway: number;
    stats: {
        shotsHome: number; shotsAway: number;
        shotsOnTargetHome: number; shotsOnTargetAway: number;
        tacklesHome: number; tacklesAway: number;
        passErrorsHome: number; passErrorsAway: number;
        yellowCardsHome: number; yellowCardsAway: number;
        redCardsHome: number; redCardsAway: number;
    };
    eventsLog: string[];
    playerRatings: { team: string; playerName: string; rating: number; isSub: boolean }[];
    topPerformerHome: string;
    topPerformerAway: string;
    reportId: string;
}

// ─── Parseia a formação para saber quantos jogadores por setor ────────────────
// "4-3-3" → { GK:1, DEF:4, MID:3, ATK:3 } · "4-1-2-1-2" → { GK:1, DEF:4, MID:4, ATK:2 }
export function parseFormation(formation: string): Record<string, number> {
    const clean = formation.replace(/_?\(.*\)/, '').trim(); // remove "_(2)", "(3)" etc.
    const parts = clean.split('-').map(Number);
    if (parts.length >= 3 && parts.every(n => !isNaN(n))) {
        const mid = parts.slice(1, -1).reduce((a, b) => a + b, 0);
        return { GK: 1, DEF: parts[0], MID: mid, ATK: parts[parts.length - 1] };
    }
    return { GK: 1, DEF: 4, MID: 4, ATK: 2 }; // fallback 4-4-2
}

// ─── Jogador do RPTool → jogador do motor ─────────────────────────────────────
// Força = OVR efetivo (energia, ritmo e moral já entram aqui). Quem tem stats
// customizados ganha os 7 atributos do Brasfoot, e a nota passa a depender da vaga.
function toEnginePlayer(raw: any, id: string): EnginePlayer {
    const p: IPlayer = raw?._doc ?? raw;
    const strength = getEffectiveOverall(p);
    const skills   = ARCHETYPE_SKILLS[p.archetype] ?? [SECTOR_SKILL[p.position] ?? 11];
    let attrs: number[] | undefined;
    if (hasCustomStats(p)) {
        const k = strength / Math.max(1, p.overall);
        const v = (n: number | undefined) => Math.max(1, Math.round((n ?? 50) * k));
        attrs = p.position === 'GK'
            // Gol, Vel, Téc, Pas, Des, Arm, Fin
            ? [v(((p.div ?? 50) + (p.ref ?? 50) + (p.han ?? 50) + (p.pos ?? 50)) / 4), v(p.spe), v(p.han), v(p.kic), v(p.pos), v((p.kic ?? 50) / 2), v(10)]
            : [v(10), v(p.pac), v(p.dri), v(p.pas), v(p.def), v(((p.pas ?? 50) + (p.dri ?? 50)) / 2), v(p.sho)];
    }
    return {
        id, name: p.name, pos: p.position, age: p.age ?? 22,
        strength, attrs, skills,
        star:       p.overall >= 85,
        worldClass: p.overall >= 92,
        energy:     p.energy ?? 100,
    };
}

// ─── Monta o lado: XI no esquema (vagas do Brasfoot), banco e estilo ──────────
// Falta gente no setor → puxa de outro setor (joga com metade da força); falta
// gente no elenco → genérico fraco (OVR 40), o time é punido pela falta de elenco.
function buildSide(team: ITeam, sideIdx: 0 | 1, tactic: string, enemyTactic: string): Side {
    const slots   = formationSlots(team.defaultFormation);
    const players = team.players.map((p: any, i: number) => toEnginePlayer(p, `${sideIdx}-${i}`));
    const { lineup, bench } = autoLineup(players, slots);

    const used = new Set(lineup.map(s => s.slot));
    for (const slot of slots) {
        if (used.has(slot)) continue;
        const pos = sectorOf(slot);
        lineup.push({
            slot,
            player: {
                id: `${sideIdx}-emg-${slot}`, name: `Reserva Emergencial (${pos})`, pos, age: 20,
                strength: 40, skills: [SECTOR_SKILL[pos]], star: false, worldClass: false, energy: 100,
            },
        });
    }
    lineup.sort((a, b) => a.slot - b.slot);

    return {
        lineup, bench,
        style: STYLE_EFFECT[tactic] ?? STYLE_EFFECT.BALANCEADO,
        edge:  tacticalEdge(tactic, enemyTactic),
    };
}

function posEmoji(pos: string): string {
    return ({ GK: '🧤', DEF: '🛡️', MID: '⚙️', ATK: '⚡' } as any)[pos] ?? '⚽';
}

// ─── Formata o rodapé de expiração ───────────────────────────────────────────
// IMPORTANTE: Discord renderiza <t:...:R> apenas em conteúdo de mensagem,
// NÃO em footers de embed. Por isso retornamos objeto separado: footer (texto
// simples) + content (com o timestamp que Discord vai renderizar).
export function buildExpirationFooter(reportId: string): { footer: string; content: string } {
    const expirationTs = Math.floor(Date.now() / 1000) + 48 * 3600;
    return {
        footer:  `ID: ${reportId} • Use rp!futebol export ${reportId} para guardar forever`,
        content: `⚠️ Análise expira em 48h (<t:${expirationTs}:R>)`,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR PRINCIPAL — o lance a lance vive em ./brasfoot/core.ts (Brasfoot via Vanifoot);
// aqui ficam a ponte com o RPTool, a narração, o modo IRL e a súmula.
// ─────────────────────────────────────────────────────────────────────────────
export async function simulateTacticalMatch(
    guildId: string,
    homeTeam: ITeam,
    awayTeam: ITeam,
    homeTactic: TacticStyle = 'BALANCEADO',
    awayTactic:  TacticStyle = 'BALANCEADO',
    tournamentId?: string,
    irlOptions?: IrlOptions,
    neutralField = false,   // campo neutro: sem bônus de mandante
): Promise<MatchResult> {

    // Fallback: times vazios recebem plantel genérico
    if (homeTeam.players.length === 0) homeTeam.players = generateGenericPlayers(65) as any;
    if (awayTeam.players.length === 0) awayTeam.players = generateGenericPlayers(65) as any;

    const homeFormation = homeTeam.defaultFormation ?? '4-4-2';
    const awayFormation = awayTeam.defaultFormation  ?? '4-4-2';

    const sides: [Side, Side] = [
        buildSide(homeTeam, 0, homeTactic, awayTactic),
        buildSide(awayTeam, 1, awayTactic, homeTactic),
    ];
    const teams = [homeTeam, awayTeam];
    const people = new Map<string, EnginePlayer>();
    for (const s of sides) for (const p of [...s.lineup.map(x => x.player), ...s.bench]) people.set(p.id, p);
    const nameOf = (id?: string) => (id ? people.get(id)?.name : undefined) ?? '?';

    const live = liveMatch(sides[0], sides[1], new Rng(), { neutral: neutralField });

    const eventsLog: string[] = [`⏱️ **0'** — Rola a bola!`];
    const narrate = (e: MatchEvent) => {
        const team  = teams[e.side].name;
        const other = teams[1 - e.side].name;
        const who   = nameOf(e.player);
        switch (e.type) {
            case 'goal': {
                const g = live.goals;
                if (e.kind === 'own') {
                    eventsLog.push(`⚽ **${e.minute}'** — **GOL DE ${team.toUpperCase()}!** Contra de **${who}** (${other})`);
                } else {
                    const tag = e.kind === 'penalty' ? ' *(pênalti)*' : e.kind === 'freekick' ? ' *(cobrança de falta)*' : e.kind === 'olympic' ? ' *(gol olímpico!)*' : '';
                    const assist = e.other ? ` (Assist: ${nameOf(e.other)})` : '';
                    eventsLog.push(`⚽ **${e.minute}'** — **GOL DE ${team.toUpperCase()}!** ${posEmoji(people.get(e.player)?.pos ?? '')} **${who}**${tag}${assist}`);
                }
                eventsLog.push(`📊 *Placar: ${homeTeam.name} ${g[0]} × ${g[1]} ${awayTeam.name}*`);
                break;
            }
            case 'yellow': eventsLog.push(`🟨 **${e.minute}'** — **${who}** (${team}) recebe cartão amarelo.`); break;
            case 'red':    eventsLog.push(`🟥 **${e.minute}'** — **${who}** (${team}) EXPULSO! ${e.secondYellow ? 'Segundo amarelo.' : 'Vermelho direto.'}`); break;
            case 'injury': eventsLog.push(`🚑 **${e.minute}'** — **${who}** (${team}) se machuca e deixa o campo.`); break;
            case 'sub':    eventsLog.push(`🔄 **${e.minute}'** — **${team}**: ${who} entra no lugar de ${nameOf(e.other)}`); break;
        }
    };

    // ─── IRL: envia embed ao vivo com botão cancelar ──────────────────────────
    const cancelRow = () => new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('fb_irl_cancel').setLabel('⏹ Cancelar Partida').setStyle(ButtonStyle.Danger),
    );
    const liveEmbed = (minute: number, recent: string[], isFinal = false) => buildLiveEmbed(
        homeTeam.name, awayTeam.name, live.goals[0], live.goals[1], minute, recent,
        homeFormation, awayFormation, homeTactic, awayTactic, isFinal,
    );
    let liveMsg: any = null;
    if (irlOptions) {
        liveMsg = await (irlOptions.message.channel as TextChannel).send({ embeds: [liveEmbed(0, eventsLog)], components: [cancelRow()] });

        const cancelCollector = liveMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i: any) => i.customId === 'fb_irl_cancel' &&
                [irlOptions.homeAdminId, irlOptions.awayAdminId, irlOptions.message.author.id].includes(i.user.id),
        });
        cancelCollector.on('collect', async (i: any) => {
            irlOptions.cancelToken.cancelled = true;
            cancelCollector.stop();
            await i.reply({ content: '⏹ Partida cancelada.', flags: MessageFlags.Ephemeral });
        });
    }

    // ─── Um minuto por passo (~95, com os acréscimos sorteados) ───────────────
    let seen = 0;
    while (!live.clock().over) {
        // IRL: delay entre minutos + verificação de cancelamento
        if (irlOptions && liveMsg) {
            await sleep(irlOptions.secondsPerMinute * 1000);
            if (irlOptions.cancelToken.cancelled) {
                await liveMsg.edit({ embeds: [liveEmbed(live.clock().minute, ['⏹ *Partida cancelada.*'], true)], components: [] });
                break;
            }
        }

        live.step();
        for (; seen < live.events.length; seen++) narrate(live.events[seen]);
        const clock = live.clock();

        if (clock.halfTime) {
            eventsLog.push(`🔔 **FIM DO 1º TEMPO** — ${homeTeam.name} ${live.goals[0]} × ${live.goals[1]} ${awayTeam.name}`);

            if (irlOptions && liveMsg) {
                await liveMsg.edit({ embeds: [liveEmbed(45, eventsLog.slice(-6))] });
                // ── Pergunta aos donos se querem fazer substituições ─────────
                await askHalftimeSubstitutions(irlOptions, homeTeam, awayTeam, live, nameOf);
                // As trocas viram eventos do motor e são narradas aqui.
                for (; seen < live.events.length; seen++) narrate(live.events[seen]);
                eventsLog.push(`▶️ **46'** — Começa o 2º tempo!`);
            } else {
                eventsLog.push(`⏸️ Times recolhem ao vestiário.`);
            }
        } else if (irlOptions && liveMsg && !irlOptions.cancelToken.cancelled) {
            await liveMsg.edit({ embeds: [liveEmbed(clock.minute, eventsLog.slice(-6))], components: [cancelRow()] });
        }
    }

    const [homeScore, awayScore] = live.goals;
    eventsLog.push(`🏁 **FIM DE JOGO!** — ${homeTeam.name} **${homeScore}** × **${awayScore}** ${awayTeam.name}`);

    // ─── Stats finais ─────────────────────────────────────────────────────────
    const s = live.stats();
    const count = (side: 0 | 1, type: MatchEvent['type']) => live.events.filter(e => e.side === side && e.type === type).length;
    const stats: MatchResult['stats'] = {
        shotsHome:         s.shots[0],      shotsAway:         s.shots[1],
        shotsOnTargetHome: s.onTarget[0],   shotsOnTargetAway: s.onTarget[1],
        tacklesHome:       s.tackles[0],    tacklesAway:       s.tackles[1],
        passErrorsHome:    s.passErrors[0], passErrorsAway:    s.passErrors[1],
        yellowCardsHome:   count(0, 'yellow'), yellowCardsAway: count(1, 'yellow'),
        redCardsHome:      count(0, 'red'),    redCardsAway:    count(1, 'red'),
    };
    const [finalPossessionHome, finalPossessionAway] = s.possession;

    // ─── Notas individuais (f_0.a do Brasfoot) ────────────────────────────────
    const ratings = live.ratings();
    const playerRatings: MatchResult['playerRatings'] = [];
    const top = [{ name: '', rating: 0 }, { name: '', rating: 0 }];
    ([0, 1] as const).forEach(i => {
        const starters = new Set(sides[i].lineup.map(x => x.player.id));
        for (const id of live.played(i)) {
            const rating = ratings[id];
            if (!rating) continue; // pouco tempo em campo: sem nota, como no original
            const p     = people.get(id)!;
            const isSub = !starters.has(id);
            playerRatings.push({ team: teams[i].name, playerName: p.name, rating, isSub });
            // Destaque só para titulares reais (nem reserva emergencial, nem quem entrou).
            if (!isSub && !id.includes('-emg-') && rating > top[i].rating) top[i] = { name: p.name, rating };
        }
    });

    // ─── Salva relatório TTL 48h ──────────────────────────────────────────────
    const report = await MatchReportModel.create({
        guildId, tournamentId,
        homeTeamName: homeTeam.name, awayTeamName: awayTeam.name,
        homeScore, awayScore,
        stats: {
            possessionHome: finalPossessionHome,
            possessionAway: finalPossessionAway,
            ...stats,
        },
        homeFormation, awayFormation,
        homeTactic, awayTactic,
        eventsLog, playerRatings,
        topPerformerHome: top[0].name,
        topPerformerAway: top[1].name,
    });

    // Edita embed final do IRL
    if (irlOptions && liveMsg) {
        const finalEmbed = liveEmbed(90, eventsLog.slice(-8), true);
        finalEmbed.setFooter({ text: buildExpirationFooter((report._id as any).toString()).footer });
        await liveMsg.edit({ embeds: [finalEmbed], components: [] });
    }

    return {
        homeScore, awayScore,
        finalPossessionHome, finalPossessionAway,
        stats, eventsLog, playerRatings,
        topPerformerHome: top[0].name,
        topPerformerAway: top[1].name,
        reportId: (report._id as any).toString(),
    };
}

// ─── Embed ao vivo (modo IRL) ──────────────────────────────────────────────
function buildLiveEmbed(
    homeName: string, awayName: string,
    homeScore: number, awayScore: number,
    minute: number,
    recentEvents: string[],
    homeFormation: string, awayFormation: string,
    homeTactic: string, awayTactic: string,
    isFinal = false,
): EmbedBuilder {
    const color = isFinal
        ? (homeScore > awayScore ? 'Green' : homeScore < awayScore ? 'Red' : 'Yellow')
        : 'Blue';

    return new EmbedBuilder()
        .setColor(color)
        .setTitle(isFinal ? '🏁 Fim de Jogo!' : `⏱️ ${minute}' — Em Andamento`)
        .setDescription(`## ${homeName}  **${homeScore}**  ×  **${awayScore}**  ${awayName}`)
        .addFields(
            { name: '🛡️ Táticas', value: `${homeName}: \`${homeFormation}\` ${homeTactic} | ${awayName}: \`${awayFormation}\` ${awayTactic}`, inline: false },
            { name: '📋 Últimos Eventos', value: recentEvents.length > 0 ? recentEvents.join('\n') : '*Aguardando lances...*', inline: false },
        )
        .setTimestamp();
}

// ─── Intervalo: pergunta aos donos (modo IRL) ────────────────────────────────
// As trocas vão direto para o motor (live.substitute), que conta o limite de 5.
async function askHalftimeSubstitutions(
    irlOptions: IrlOptions,
    homeTeam: ITeam, awayTeam: ITeam,
    live: LiveMatch,
    nameOf: (id?: string) => string,
): Promise<void> {
    const channel = irlOptions.message.channel as TextChannel;

    const announceRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('fb_halftime_home').setLabel(`${homeTeam.name}: Fazer Sub`).setStyle(ButtonStyle.Primary).setEmoji('🔄'),
        new ButtonBuilder().setCustomId('fb_halftime_away').setLabel(`${awayTeam.name}: Fazer Sub`).setStyle(ButtonStyle.Primary).setEmoji('🔄'),
        new ButtonBuilder().setCustomId('fb_halftime_skip').setLabel('Continuar sem trocas').setStyle(ButtonStyle.Secondary),
    );

    const halftimeMsg = await channel.send({
        content:
            `🔔 **INTERVALO!** Os técnicos têm **60 segundos** para fazer substituições.\n` +
            `> <@${irlOptions.homeAdminId}> (${homeTeam.name}) e <@${irlOptions.awayAdminId}> (${awayTeam.name}), cliquem no botão do seu time.`,
        components: [announceRow],
    });

    const decided = new Set<number>();

    try {
        const collector = halftimeMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60_000,
            filter: (i) => [irlOptions.homeAdminId, irlOptions.awayAdminId].includes(i.user.id),
        });

        await new Promise<void>((resolve) => {
            collector.on('collect', async (interaction) => {
                if (interaction.customId === 'fb_halftime_skip') {
                    collector.stop();
                    await interaction.reply({ content: '▶️ Sem substituições. Continuando...', flags: MessageFlags.Ephemeral });
                    return;
                }

                const side: 0 | 1 = interaction.customId === 'fb_halftime_home' ? 0 : 1;
                const team  = side === 0 ? homeTeam : awayTeam;
                const field = live.onPitch(side).map(s => s.player);
                const bench = live.bench(side);

                if (decided.has(side)) {
                    await interaction.reply({ content: '❌ Você já fez suas substituições neste intervalo.', flags: MessageFlags.Ephemeral });
                    return;
                }

                if (bench.length === 0 || live.subsLeft(side) <= 0) {
                    await interaction.reply({ content: '⚠️ Sem reservas disponíveis ou limite de 5 substituições atingido.', flags: MessageFlags.Ephemeral });
                    decided.add(side);
                    if (decided.size >= 2) collector.stop();
                    return;
                }

                const fieldList = field.map((p, i) => `\`${i + 1}.\` ${p.name} (${p.pos})`).join('\n');
                const benchList = bench.map((p, i) => `\`${i + 1}.\` ${p.name} (${p.pos} OVR:${p.strength})`).join('\n');

                // interaction.reply ephemeral não é visível ao channel.createMessageCollector:
                // enviamos mensagem PÚBLICA no canal (apagada depois) para poder escutar a resposta.
                const subPromptMsg = await channel.send({
                    content:
                        `🔄 <@${interaction.user.id}> — **Substituição: ${team.name}**\n\n` +
                        `**Em campo:**\n${fieldList}\n\n` +
                        `**Banco:**\n${benchList}\n\n` +
                        `Responda aqui: \`SAINDO / ENTRANDO\` *(ex: Marchesín / Carlos GK)*\n` +
                        `-# Esta mensagem some em 30s.`,
                });

                await interaction.reply({ content: '✅ Lista enviada abaixo. Responda em 30 segundos.', flags: MessageFlags.Ephemeral });

                const msgCollector = channel.createMessageCollector({
                    filter: (m) => m.author.id === interaction.user.id && m.content.includes('/'),
                    time: 30_000,
                    max: 1,
                });

                msgCollector.on('collect', async (m) => {
                    const parts = m.content.split('/').map(s => s.trim());
                    if (parts.length !== 2) {
                        await m.reply('❌ Formato inválido. Use: `SAINDO / ENTRANDO`').catch(() => null);
                        return;
                    }

                    const [outName, inName] = parts.map(s => s.toLowerCase());
                    const outPlayer = field.find(p => p.name.toLowerCase() === outName);
                    const inPlayer  = bench.find(p => p.name.toLowerCase() === inName);

                    if (!outPlayer || !inPlayer) {
                        await m.reply('❌ Nomes não encontrados. Confira a lista e tente novamente.').catch(() => null);
                        return;
                    }

                    const err = live.substitute(side, outPlayer.id, inPlayer.id);
                    if (err) {
                        await m.reply(`❌ ${err}`).catch(() => null);
                        return;
                    }
                    decided.add(side);

                    await m.reply(`✅ ${nameOf(inPlayer.id)} 🔄 ${nameOf(outPlayer.id)} — confirmado!`).catch(() => null);
                    await m.delete().catch(() => null);
                    if (decided.size >= 2) collector.stop();
                });

                msgCollector.on('end', async () => {
                    await subPromptMsg.delete().catch(() => null);
                });
            });

            collector.on('end', () => resolve());
        });
    } catch (e) { console.warn('[FUTEBOL] Erro durante o processo de substituições no intervalo:', e); }

    await halftimeMsg.delete().catch(() => null);
}


function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
