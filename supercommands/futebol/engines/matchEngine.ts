import {
    Message,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    TextChannel,
} from 'discord.js';
import { ITeam, IPlayer } from '../../../tools/models/FutebolSchema';
import { MatchReportModel } from '../../../tools/models/FutebolReportSchema';
import { calculateTeamStats, getPlayerMacros, calculatePlayerRating, generateGenericPlayers } from './mathEngine';

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
        foulsHome: number; foulsAway: number;
        yellowCardsHome: number; yellowCardsAway: number;
        redCardsHome: number; redCardsAway: number;
        cornersHome: number; cornersAway: number;
        passAccuracyHome: number; passAccuracyAway: number;
    };
    eventsLog: string[];
    playerRatings: { team: string; playerName: string; rating: number; isSub: boolean }[];
    topPerformerHome: string;
    topPerformerAway: string;
    reportId: string;
}

// ─── Parseia a formação para saber quantos jogadores por setor ────────────────
// "4-3-3" → { GK:1, DEF:4, MID:3, ATK:3 }
export function parseFormation(formation: string): Record<string, number> {
    const clean = formation.replace(/\(.*\)/, '').trim(); // remove "(2)", "(3)" etc.
    const parts  = clean.split('-').map(Number);
    if (parts.length === 3) return { GK: 1, DEF: parts[0], MID: parts[1], ATK: parts[2] };
    if (parts.length === 4) return { GK: 1, DEF: parts[0], MID: parts[1] + parts[2], ATK: parts[3] };
    return { GK: 1, DEF: 4, MID: 4, ATK: 2 }; // fallback 4-4-2
}

// ─── Monta o XI titular respeitando a formação ────────────────────────────────
// Se não tem jogadores suficientes em alguma posição, preenche com genéricos fracos (OVR 40)
export function buildLineup(team: ITeam, formation: string): { starters: IPlayer[]; bench: IPlayer[] } {
    const slots  = parseFormation(formation);
    const pool   = [...team.players];

    const starters: IPlayer[]                   = [];
    const posOrder: Array<IPlayer['position']>  = ['GK', 'DEF', 'MID', 'ATK'];

    for (const pos of posOrder) {
        const needed = slots[pos] ?? 0;
        // Filtra jogadores titulares desta posição, ordena por overall desc
        const available = pool
            .filter(p => p.position === pos)
            .sort((a, b) => b.overall - a.overall);

        for (let i = 0; i < needed; i++) {
            if (available.length > 0) {
                const p = available.shift()!;
                starters.push(p);
                pool.splice(pool.indexOf(p), 1);
            } else {
                // Slot vazio → gera genérico fraco (time punido pela falta de elenco)
                starters.push({
                    name: `Reserva Emergencial (${pos})`,
                    position: pos,
                    age: 20, number: 0, overall: 40,
                    energy: 100, sharpness: 30, morale: 2, archetype: 'Balanceado',
                    isStarter: true,
                });
            }
        }
    }

    // Restante vai para o banco
    const bench = pool.map(p => ({ ...p, isStarter: false }));
    return { starters, bench };
}

// ─── Sistema Pedra-Papel-Tesoura ─────────────────────────────────────────────
function getTacticalEdge(mine: TacticStyle, enemy: TacticStyle): number {
    if (mine === 'POSSE'         && enemy === 'RETRANCA')      return 1.15;
    if (mine === 'PRESSAO'       && enemy === 'POSSE')         return 1.15;
    if (mine === 'RETRANCA'      && enemy === 'CONTRA_ATAQUE') return 1.20;
    if (mine === 'CONTRA_ATAQUE' && enemy === 'PRESSAO')       return 1.20;
    if (mine === 'POSSE'         && enemy === 'PRESSAO')       return 0.85;
    if (mine === 'RETRANCA'      && enemy === 'POSSE')         return 0.85;
    return 1.0;
}

function getStaminaPenalty(minute: number, tactic: TacticStyle): number {
    const baseFatigue = minute > 60 ? 1 - ((minute - 60) / 200) : 1.0;
    return tactic === 'PRESSAO' ? baseFatigue * 0.95 : baseFatigue;
}

function pickPlayer(players: IPlayer[], position: string): IPlayer {
    const byPos = players.filter(p => p.position === position);
    const pool  = byPos.length > 0 ? byPos : players;
    return pool[Math.floor(Math.random() * pool.length)];
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
// MOTOR PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export async function simulateTacticalMatch(
    guildId: string,
    homeTeam: ITeam,
    awayTeam: ITeam,
    homeTactic: TacticStyle = 'BALANCEADO',
    awayTactic:  TacticStyle = 'BALANCEADO',
    tournamentId?: string,
    irlOptions?: IrlOptions,
): Promise<MatchResult> {

    // Fallback: times vazios recebem plantel genérico
    if (homeTeam.players.length === 0) homeTeam.players = generateGenericPlayers(65) as any;
    if (awayTeam.players.length === 0) awayTeam.players = generateGenericPlayers(65) as any;

    const homeFormation = homeTeam.defaultFormation ?? '4-4-2';
    const awayFormation = awayTeam.defaultFormation  ?? '4-4-2';

    // ─── Monta titulares respeitando formação ─────────────────────────────────
    const { starters: homeStarters, bench: homeBench } = buildLineup(homeTeam, homeFormation);
    const { starters: awayStarters, bench: awayBench  } = buildLineup(awayTeam, awayFormation);

    // Jogadores em campo (mutável — substituições alteram este array)
    let homeOnField = [...homeStarters];
    let awayOnField = [...awayStarters];

    let homeHomeStats = calculateTeamStats({ ...homeTeam, players: homeOnField } as ITeam);
    let awayFieldStats = calculateTeamStats({ ...awayTeam, players: awayOnField  } as ITeam);

    homeHomeStats.meio *= 1.05; // bônus de mandante

    const homeEdge = getTacticalEdge(homeTactic, awayTactic);
    const awayEdge = getTacticalEdge(awayTactic,  homeTactic);

    // Contadores
    let homeScore = 0, awayScore = 0;
    let homePossessionTicks = 0, awayPossessionTicks = 0;
    let passHitsHome = 0, passTotalHome = 0;
    let passHitsAway = 0, passTotalAway = 0;

    const stats = {
        shotsHome: 0, shotsAway: 0,
        shotsOnTargetHome: 0, shotsOnTargetAway: 0,
        foulsHome: 0, foulsAway: 0,
        yellowCardsHome: 0, yellowCardsAway: 0,
        redCardsHome: 0, redCardsAway: 0,
        cornersHome: 0, cornersAway: 0,
        passAccuracyHome: 0, passAccuracyAway: 0,
    };

    const eventsLog: string[] = [];

    type Contrib = { goals: number; assists: number; keyPasses: number; tacklesWon: number; errors: number; isSub: boolean };
    const contributions: Record<string, Contrib> = {};
    const initC = (name: string, isSub = false) => {
        if (!contributions[name]) contributions[name] = { goals: 0, assists: 0, keyPasses: 0, tacklesWon: 0, errors: 0, isSub };
    };

    [...homeStarters, ...awayStarters].forEach(p => initC(p.name));

    // Substituições usadas (máx 5 por time, para simular regra atual)
    let homeSubsUsed = 0, awaySubsUsed = 0;
    const MAX_SUBS = 5;

    eventsLog.push(`⏱️ **0'** — Rola a bola!`);

    // ─── IRL: envia embed ao vivo com botão cancelar ──────────────────────────
    let liveMsg: any = null;
    if (irlOptions) {
        const cancelRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('fb_irl_cancel')
                .setLabel('⏹ Cancelar Partida')
                .setStyle(ButtonStyle.Danger),
        );
        const initEmbed = buildLiveEmbed(homeTeam.name, awayTeam.name, 0, 0, 0, eventsLog, homeFormation, awayFormation, homeTactic, awayTactic);
        liveMsg = await (irlOptions.message.channel as TextChannel).send({ embeds: [initEmbed], components: [cancelRow] });

        // Listener do botão cancelar
        const cancelCollector = liveMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i: any) => i.customId === 'fb_irl_cancel' &&
                [irlOptions.homeAdminId, irlOptions.awayAdminId, irlOptions.message.author.id].includes(i.user.id),
        });
        cancelCollector.on('collect', async (i: any) => {
            irlOptions.cancelToken.cancelled = true;
            cancelCollector.stop();
            await i.reply({ content: '⏹ Partida cancelada.', ephemeral: true });
        });
    }

    // ─── Loop dos 90 minutos ──────────────────────────────────────────────────
    for (let minute = 1; minute <= 90; minute++) {

        // IRL: delay entre minutos + verificação de cancelamento
        if (irlOptions && liveMsg) {
            await sleep(irlOptions.secondsPerMinute * 1000);
            if (irlOptions.cancelToken.cancelled) {
                await liveMsg.edit({ embeds: [buildLiveEmbed(homeTeam.name, awayTeam.name, homeScore, awayScore, minute, ['⏹ *Partida cancelada.*'], homeFormation, awayFormation, homeTactic, awayTactic, true)], components: [] });
                break;
            }
        }

        const staminaH = getStaminaPenalty(minute, homeTactic);
        const staminaA = getStaminaPenalty(minute, awayTactic);

        // 1. Disputa de meio-campo
        const homeMid = (homeHomeStats.meio * homeEdge * staminaH) * (0.7 + Math.random() * 0.6);
        const awayMid = (awayFieldStats.meio * awayEdge * staminaA)  * (0.7 + Math.random() * 0.6);
        const homeHasBall = homeMid >= awayMid;

        if (homeHasBall) homePossessionTicks++; else awayPossessionTicks++;

        passTotalHome++; passTotalAway++;
        if (homeHasBall) { if (Math.random() < 0.82) passHitsHome++; }
        else             { if (Math.random() < 0.82) passHitsAway++; }

        // 2. Criação de chance
        const atkStats  = homeHasBall ? homeHomeStats : awayFieldStats;
        const defStats  = homeHasBall ? awayFieldStats : homeHomeStats;
        const atkTactic = homeHasBall ? homeTactic : awayTactic;
        const atkTeam   = homeHasBall ? homeTeam   : awayTeam;
        const defTeam   = homeHasBall ? awayTeam   : homeTeam;
        const stamina   = homeHasBall ? staminaH   : staminaA;
        const atkField  = homeHasBall ? homeOnField : awayOnField;
        const defField  = homeHasBall ? awayOnField : homeOnField;

        const creationOdds = (atkStats.ataque * stamina) / (defStats.defesa + atkStats.ataque) * 0.18;

        if (Math.random() < creationOdds) {
            const attacker = pickPlayer(atkField, 'ATK');
            const mAtk     = getPlayerMacros(attacker);
            if (homeHasBall) stats.shotsHome++; else stats.shotsAway++;
            initC(attacker.name);
            contributions[attacker.name].keyPasses++;

            const finPower = (mAtk.SHO * 0.60 + mAtk.DRI * 0.25 + mAtk.PAC * 0.15) * stamina;
            const gkPower  = (defStats.gk * 0.70 + defStats.defesa * 0.30) * (homeHasBall ? staminaA : staminaH);
            const shotOdds = finPower / (finPower + gkPower);

            if (Math.random() < shotOdds) {
                if (homeHasBall) { homeScore++; stats.shotsOnTargetHome++; }
                else             { awayScore++;  stats.shotsOnTargetAway++;  }

                contributions[attacker.name].goals++;
                const assister = pickPlayer(atkField, 'MID');
                initC(assister.name);
                contributions[assister.name].assists++;

                const logLine = `⚽ **${minute}'** — **GOL DE ${atkTeam.name.toUpperCase()}!** ${posEmoji(attacker.position)} **${attacker.name}** (Assist: ${assister.name})`;
                eventsLog.push(logLine);
                eventsLog.push(`📊 *Placar: ${homeTeam.name} ${homeScore} × ${awayScore} ${awayTeam.name}*`);

                if (irlOptions && liveMsg) {
                    await liveMsg.edit({ embeds: [buildLiveEmbed(homeTeam.name, awayTeam.name, homeScore, awayScore, minute, eventsLog.slice(-6), homeFormation, awayFormation, homeTactic, awayTactic)] });
                }
            } else {
                if (Math.random() < 0.55) {
                    if (homeHasBall) stats.shotsOnTargetHome++; else stats.shotsOnTargetAway++;
                    const gk = pickPlayer(defField, 'GK');
                    initC(gk.name);
                    contributions[gk.name].tacklesWon++;
                    if (Math.random() < 0.40) {
                        if (homeHasBall) stats.cornersHome++; else stats.cornersAway++;
                        eventsLog.push(`🧤 **${minute}'** — Defesa de **${gk.name}** (${defTeam.name})! Escanteio.`);
                    }
                }
            }
        }

        // 3. Falta e cartões
        if (Math.random() < 0.045) {
            const fouler = pickPlayer(defField, 'DEF');
            if (homeHasBall) stats.foulsAway++; else stats.foulsHome++;

            if (Math.random() < 0.18) {
                if (homeHasBall) stats.yellowCardsAway++; else stats.yellowCardsHome++;
                initC(fouler.name);
                contributions[fouler.name].errors++;
                eventsLog.push(`🟨 **${minute}'** — **${fouler.name}** (${defTeam.name}) recebe cartão amarelo.`);

                if (Math.random() < 0.06) {
                    if (homeHasBall) stats.redCardsAway++; else stats.redCardsHome++;
                    eventsLog.push(`🟥 **${minute}'** — **${fouler.name}** (${defTeam.name}) EXPULSO! Vermelho direto.`);
                    if (irlOptions && liveMsg) await liveMsg.edit({ embeds: [buildLiveEmbed(homeTeam.name, awayTeam.name, homeScore, awayScore, minute, eventsLog.slice(-6), homeFormation, awayFormation, homeTactic, awayTactic)] });
                }
            }
        }

        // 4. Substituições automáticas nos minutos 60, 70, 80 (quando não é IRL)
        // No modo IRL o dono decide no intervalo; aqui fazemos automático na 2ª metade
        if (!irlOptions && minute >= 60 && minute % 10 === 0) {
            const autoSub = (field: IPlayer[], bench: IPlayer[], subsUsed: number, teamName: string): number => {
                if (subsUsed >= MAX_SUBS || bench.length === 0) return subsUsed;
                const worstPos = ['ATK', 'MID', 'DEF'][Math.floor(Math.random() * 3)] as IPlayer['position'];
                const outIdx   = field.map((p, i) => ({ p, i })).filter(x => x.p.position === worstPos).sort((a, b) => a.p.overall - b.p.overall)[0]?.i;
                const inPlayer = bench.find(p => p.position === worstPos);
                if (outIdx === undefined || !inPlayer) return subsUsed;

                const outPlayer = field[outIdx];
                initC(outPlayer.name); initC(inPlayer.name, true);
                eventsLog.push(`🔄 **${minute}'** — **${teamName}**: ${inPlayer.name} entra no lugar de ${outPlayer.name}`);
                field.splice(outIdx, 1, { ...inPlayer, isStarter: false });
                bench.splice(bench.indexOf(inPlayer), 1);
                return subsUsed + 1;
            };

            homeSubsUsed = autoSub(homeOnField, homeBench, homeSubsUsed, homeTeam.name);
            awaySubsUsed = autoSub(awayOnField, awayBench, awaySubsUsed, awayTeam.name);

            // Recalcula stats do time após substituição
            homeHomeStats = calculateTeamStats({ ...homeTeam, players: homeOnField } as ITeam);
            homeHomeStats.meio *= 1.05;
            awayFieldStats = calculateTeamStats({ ...awayTeam, players: awayOnField  } as ITeam);
        }

        // 5. Narrativa de momento (a cada 15')
        if (minute % 15 === 0 && minute < 90 && !eventsLog[eventsLog.length - 1]?.includes(`**${minute}'`)) {
            const holder  = homeHasBall ? homeTeam.name : awayTeam.name;
            const mid     = pickPlayer(homeHasBall ? homeOnField : awayOnField, 'MID');
            eventsLog.push(`⏱️ **${minute}'** — **${mid.name}** (${holder}) conduz a jogada com tranquilidade.`);
        }

        // 6. Intervalo
        if (minute === 45) {
            eventsLog.push(`🔔 **FIM DO 1º TEMPO** — ${homeTeam.name} ${homeScore} × ${awayScore} ${awayTeam.name}`);

            if (irlOptions && liveMsg) {
                await liveMsg.edit({ embeds: [buildLiveEmbed(homeTeam.name, awayTeam.name, homeScore, awayScore, 45, eventsLog.slice(-6), homeFormation, awayFormation, homeTactic, awayTactic)] });

                // ── Pergunta DM para os donos se querem fazer substituições ──────
                const halftimeSubs = await askHalftimeSubstitutions(irlOptions, homeTeam, awayTeam, homeOnField, awayOnField, homeBench, awayBench, homeSubsUsed, awaySubsUsed, eventsLog);
                homeSubsUsed = halftimeSubs.homeSubsUsed;
                awaySubsUsed = halftimeSubs.awaySubsUsed;

                // Recalcula stats após possíveis trocas
                homeHomeStats = calculateTeamStats({ ...homeTeam, players: homeOnField } as ITeam);
                homeHomeStats.meio *= 1.05;
                awayFieldStats = calculateTeamStats({ ...awayTeam, players: awayOnField } as ITeam);

                eventsLog.push(`▶️ **46'** — Começa o 2º tempo!`);
            } else {
                eventsLog.push(`⏸️ Times recolhem ao vestiário.`);
            }
        }

        // 7. Atualiza embed IRL a cada minuto (antes era a cada 5, agora é 1:1 com o timer)
        if (irlOptions && liveMsg && minute !== 45 && !irlOptions.cancelToken.cancelled) {
            const cancelRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('fb_irl_cancel').setLabel('⏹ Cancelar Partida').setStyle(ButtonStyle.Danger),
            );
            await liveMsg.edit({ embeds: [buildLiveEmbed(homeTeam.name, awayTeam.name, homeScore, awayScore, minute, eventsLog.slice(-6), homeFormation, awayFormation, homeTactic, awayTactic)], components: [cancelRow] });
        }
    }

    eventsLog.push(`🏁 **FIM DE JOGO!** — ${homeTeam.name} **${homeScore}** × **${awayScore}** ${awayTeam.name}`);

    // ─── Stats finais ─────────────────────────────────────────────────────────
    const totalTicks = homePossessionTicks + awayPossessionTicks || 1;
    stats.passAccuracyHome = passTotalHome > 0 ? Math.round((passHitsHome / passTotalHome) * 100) : 80;
    stats.passAccuracyAway = passTotalAway > 0 ? Math.round((passHitsAway / passTotalAway) * 100) : 80;

    const finalPossessionHome = Math.round((homePossessionTicks / totalTicks) * 100);
    const finalPossessionAway = 100 - finalPossessionHome;

    // ─── Notas individuais ────────────────────────────────────────────────────
    const homeWon = homeScore > awayScore;
    const awayWon = awayScore > homeScore;

    const playerRatings: MatchResult['playerRatings'] = [];
    let topHome = { name: '', rating: 0 };
    let topAway = { name: '', rating: 0 };

    const rateTeam = (players: IPlayer[], teamName: string, isWinner: boolean) => {
        players.forEach(p => {
            const c = contributions[p.name] ?? { goals: 0, assists: 0, keyPasses: 0, tacklesWon: 0, errors: 0, isSub: false };
            const rating = calculatePlayerRating({ ...c, baseOvr: p.overall, isWinner });
            playerRatings.push({ team: teamName, playerName: p.name, rating, isSub: !p.isStarter });

            // BUG FIX: Reservas Emergenciais (slot vazio na formação) e jogadores
            // do banco NÃO devem ganhar destaque — destaque é só para titulares reais.
            const isEmergency = p.name.startsWith('Reserva Emergencial');
            const isOriginalStarter = p.isStarter && !isEmergency;

            if (isOriginalStarter) {
                if (teamName === homeTeam.name && rating > topHome.rating) topHome = { name: p.name, rating };
                if (teamName === awayTeam.name && rating > topAway.rating) topAway = { name: p.name, rating };
            }
        });
    };

    rateTeam([...homeStarters, ...homeStarters.filter(p => !p.isStarter)], homeTeam.name, homeWon);
    rateTeam([...awayStarters, ...awayStarters.filter(p => !p.isStarter)], awayTeam.name, awayWon);

    // ─── Salva relatório TTL 48h ──────────────────────────────────────────────
    const report = await MatchReportModel.create({
        guildId, tournamentId,
        homeTeamName: homeTeam.name, awayTeamName: awayTeam.name,
        homeScore, awayScore,
        stats: {
            possessionHome:    finalPossessionHome,
            possessionAway:    finalPossessionAway,
            shotsHome:         stats.shotsHome,         shotsAway:         stats.shotsAway,
            shotsOnTargetHome: stats.shotsOnTargetHome, shotsOnTargetAway: stats.shotsOnTargetAway,
            foulsHome:         stats.foulsHome,         foulsAway:         stats.foulsAway,
            yellowCardsHome:   stats.yellowCardsHome,   yellowCardsAway:   stats.yellowCardsAway,
            redCardsHome:      stats.redCardsHome,       redCardsAway:       stats.redCardsAway,
            cornersHome:       stats.cornersHome,       cornersAway:       stats.cornersAway,
            passAccuracyHome:  stats.passAccuracyHome,  passAccuracyAway:  stats.passAccuracyAway,
        },
        homeFormation, awayFormation,
        homeTactic, awayTactic,
        eventsLog, playerRatings,
        topPerformerHome: topHome.name,
        topPerformerAway: topAway.name,
    });

    // Edita embed final do IRL
    if (irlOptions && liveMsg) {
        const finalEmbed = buildLiveEmbed(homeTeam.name, awayTeam.name, homeScore, awayScore, 90, eventsLog.slice(-8), homeFormation, awayFormation, homeTactic, awayTactic, true);
        const expiration = buildExpirationFooter((report._id as any).toString());
        finalEmbed.setFooter({ text: expiration.footer });
        await liveMsg.edit({ embeds: [finalEmbed] });
    }

    return {
        homeScore, awayScore,
        finalPossessionHome, finalPossessionAway,
        stats, eventsLog, playerRatings,
        topPerformerHome: topHome.name,
        topPerformerAway: topAway.name,
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

// ─── Intervalo: pergunta DM para os donos (modo IRL) ─────────────────────────
async function askHalftimeSubstitutions(
    irlOptions: IrlOptions,
    homeTeam: ITeam, awayTeam: ITeam,
    homeOnField: IPlayer[], awayOnField: IPlayer[],
    homeBench: IPlayer[], awayBench: IPlayer[],
    homeSubsUsed: number, awaySubsUsed: number,
    eventsLog: string[],
): Promise<{ homeSubsUsed: number; awaySubsUsed: number }> {
    const channel = irlOptions.message.channel as TextChannel;

    // BUG FIX: Documentos Mongoose têm propriedades em _doc, não no objeto raiz.
    // O spread/map retornava undefined para name/position. Normalizamos aqui.
    const readName     = (p: any): string => p?.name     ?? p?._doc?.name     ?? 'Desconhecido';
    const readPosition = (p: any): string => p?.position ?? p?._doc?.position ?? '?';
    const readOverall  = (p: any): number => p?.overall  ?? p?._doc?.overall  ?? 0;

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

    const decided = new Set<string>();

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
                    await interaction.reply({ content: '▶️ Sem substituições. Continuando...', ephemeral: true });
                    return;
                }

                const isHome = interaction.customId === 'fb_halftime_home';
                const team   = isHome ? homeTeam   : awayTeam;
                const field  = isHome ? homeOnField : awayOnField;
                const bench  = isHome ? homeBench   : awayBench;
                const used   = isHome ? homeSubsUsed : awaySubsUsed;

                if (decided.has(team.name)) {
                    await interaction.reply({ content: '❌ Você já fez suas substituições neste intervalo.', ephemeral: true });
                    return;
                }

                if (bench.length === 0 || used >= 5) {
                    await interaction.reply({ content: '⚠️ Sem reservas disponíveis ou limite de 5 substituições atingido.', ephemeral: true });
                    decided.add(team.name);
                    if (decided.size >= 2) collector.stop();
                    return;
                }

                // Listas legíveis usando o helper (evita undefined em docs Mongoose)
                const fieldList = field.map((p, i) => `\`${i + 1}.\` ${readName(p)} (${readPosition(p)})`).join('\n');
                const benchList = bench.map((p, i) => `\`${i + 1}.\` ${readName(p)} (${readPosition(p)} OVR:${readOverall(p)})`).join('\n');

                // BUG FIX: interaction.reply ephemeral não é visível ao channel.createMessageCollector.
                // Solução: enviamos mensagem PÚBLICA no canal (apagada depois) para poder escutar a resposta.
                const subPromptMsg = await channel.send({
                    content:
                        `🔄 <@${interaction.user.id}> — **Substituição: ${team.name}**\n\n` +
                        `**Em campo:**\n${fieldList}\n\n` +
                        `**Banco:**\n${benchList}\n\n` +
                        `Responda aqui: \`SAINDO / ENTRANDO\` *(ex: Marchesín / Carlos GK)*\n` +
                        `-# Esta mensagem some em 30s.`,
                });

                await interaction.reply({ content: '✅ Lista enviada abaixo. Responda em 30 segundos.', ephemeral: true });

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

                    const [outName, inName] = parts;
                    const outIdx   = field.findIndex(p => readName(p).toLowerCase() === outName.toLowerCase());
                    const inPlayer = bench.find(p => readName(p).toLowerCase() === inName.toLowerCase());

                    if (outIdx === -1 || !inPlayer) {
                        await m.reply('❌ Nomes não encontrados. Confira a lista e tente novamente.').catch(() => null);
                        return;
                    }

                    const outPlayer = field[outIdx];
                    eventsLog.push(`🔄 **45+1'** — **${team.name}**: ${readName(inPlayer)} entra no lugar de ${readName(outPlayer)} ↩️`);
                    field.splice(outIdx, 1, { ...inPlayer, isStarter: false } as any);
                    bench.splice(bench.indexOf(inPlayer), 1);

                    if (isHome) homeSubsUsed++; else awaySubsUsed++;
                    decided.add(team.name);

                    await m.reply(`✅ ${readName(inPlayer)} 🔄 ${readName(outPlayer)} — confirmado!`).catch(() => null);
                    await m.delete().catch(() => null);
                    if (decided.size >= 2) collector.stop();
                });

                msgCollector.on('end', async () => {
                    await subPromptMsg.delete().catch(() => null);
                });
            });

            collector.on('end', () => resolve());
        });
    } catch (_) { /* timeout silencioso */ }

    await halftimeMsg.delete().catch(() => null);
    return { homeSubsUsed, awaySubsUsed };
}


function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}