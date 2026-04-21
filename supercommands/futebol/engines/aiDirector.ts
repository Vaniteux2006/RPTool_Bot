import { getGuildAIConfig } from '../../../tools/utils/tokenHelper';
import { chamarIA } from '../../../tools/utils/aiUtils';
import { IPlayer, ITeam } from '../../../tools/models/FutebolSchema';
import path from 'path';
import fs from 'fs';

// ─── Listas válidas (devem espelhar os JSONs de dados) ───────────────────────
const VALID_ARCHETYPES = [
    'Muralha', 'Reflexo', 'Xerife', 'Construtor', 'Lateral_Of',
    'Trator', 'Caixeiro', 'Maestro', 'Velocista', 'Dribblador',
    'Matador', 'Pivô', 'Coringa', 'Balanceado',
];
const VALID_TACTICS = ['BALANCEADO', 'POSSE', 'CONTRA_ATAQUE', 'RETRANCA', 'PRESSAO'];

function loadFormations(): string[] {
    try {
        const p = path.join(__dirname, '../data/tactics.json');
        return JSON.parse(fs.readFileSync(p, 'utf-8')).formacoes ?? [];
    } catch { return ['4-4-2', '4-3-3', '4-2-3-1']; }
}

// ─── Formação padrão por slot (usada no fallback) ─────────────────────────────
const STARTER_TEMPLATE: Array<{ pos: IPlayer['position']; arch: string }> = [
    { pos: 'GK',  arch: 'Muralha'    },
    { pos: 'DEF', arch: 'Xerife'     }, { pos: 'DEF', arch: 'Xerife'     },
    { pos: 'DEF', arch: 'Construtor' }, { pos: 'DEF', arch: 'Lateral_Of' },
    { pos: 'MID', arch: 'Trator'     }, { pos: 'MID', arch: 'Maestro'    }, { pos: 'MID', arch: 'Caixeiro' },
    { pos: 'ATK', arch: 'Velocista'  }, { pos: 'ATK', arch: 'Matador'    }, { pos: 'ATK', arch: 'Dribblador' },
];
const BENCH_TEMPLATE: Array<{ pos: IPlayer['position']; arch: string }> = [
    { pos: 'GK',  arch: 'Reflexo'   },
    { pos: 'DEF', arch: 'Xerife'    }, { pos: 'DEF', arch: 'Lateral_Of' },
    { pos: 'MID', arch: 'Trator'    }, { pos: 'MID', arch: 'Coringa'    }, { pos: 'MID', arch: 'Caixeiro' },
    { pos: 'ATK', arch: 'Matador'   }, { pos: 'ATK', arch: 'Velocista'  },
    { pos: 'DEF', arch: 'Construtor'}, { pos: 'MID', arch: 'Maestro'    }, { pos: 'ATK', arch: 'Coringa' },
];

// ─── Gera elenco de 22 jogadores via IA (XI titular + 11 reservas) ────────────
// Usado pelo handler "rp!futebol add NomeDoTime -ai"
export async function generateFullSquadViaAI(
    guildId: string,
    teamName: string,
    targetOvr: number,
): Promise<{ players: IPlayer[]; formation: string; tactic: string } | null> {
    const aiConfig   = await getGuildAIConfig(guildId);
    const formations = loadFormations();

    if (!aiConfig) {
        console.warn('⚠️ [AI Director] Nenhuma chave de IA — usando fallback genérico.');
        return buildFallbackSquad(teamName, targetOvr, formations);
    }

    const prompt = `
Você é um diretor técnico de futebol. Gere um elenco completo para o clube "${teamName}".
Overall médio alvo: ${targetOvr} (±5 por jogador).

RETORNE APENAS um JSON com este formato exato (sem markdown, sem texto extra):
{
  "formation": "4-3-3",
  "tactic": "POSSE",
  "starters": [
    { "name": "Nome", "position": "GK", "age": 28, "number": 1, "overall": ${targetOvr}, "archetype": "Muralha" }
  ],
  "bench": [
    { "name": "Nome", "position": "GK", "age": 22, "number": 12, "overall": ${targetOvr - 5}, "archetype": "Reflexo" }
  ]
}

REGRAS OBRIGATÓRIAS:
1. "formation": escolha UMA entre ${formations.slice(0, 10).join(', ')} e mais.
2. "tactic": escolha UMA entre ${VALID_TACTICS.join(', ')}.
3. "starters": EXATAMENTE 11 jogadores respeitando a formação escolhida (1 GK + linha defensiva + meio + ataque).
4. "bench": EXATAMENTE 11 reservas (pelo menos 1 GK reserva, 2 DEF, 3 MID, 2 ATK, o restante livre).
5. "archetype": use APENAS: ${VALID_ARCHETYPES.join(', ')}.
6. Nomes coerentes com o clube "${teamName}" (se for "Flamengo", use nomes brasileiros, se for "Real Madrid", espanhóis, etc).
7. JSON PURO — nenhum texto antes ou depois.
`;

    try {
        let raw = await chamarIA(prompt, aiConfig);
        raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('JSON não encontrado na resposta da IA.');

        const data = JSON.parse(match[0]);

        if (!Array.isArray(data.starters) || data.starters.length !== 11) throw new Error('starters inválido');
        if (!Array.isArray(data.bench)    || data.bench.length    !== 11) throw new Error('bench inválido');

        const formation = formations.includes(data.formation) ? data.formation : '4-3-3';
        const tactic    = VALID_TACTICS.includes(data.tactic) ? data.tactic : 'BALANCEADO';

        const mapPlayer = (p: any, isStarter: boolean, idx: number): IPlayer => ({
            name:      p.name     ?? `Jogador ${idx + 1}`,
            position:  (['GK', 'DEF', 'MID', 'ATK'].includes(p.position) ? p.position : 'MID') as IPlayer['position'],
            age:       p.age      ?? 22,
            number:    p.number   ?? (isStarter ? idx + 1 : idx + 12),
            overall:   Math.min(99, Math.max(1, Number(p.overall) || targetOvr)),
            archetype: VALID_ARCHETYPES.includes(p.archetype) ? p.archetype : 'Balanceado',
            energy:    100,
            sharpness: isStarter ? 60 : 50,
            morale:    3,
            isStarter,
        });

        const players: IPlayer[] = [
            ...data.starters.map((p: any, i: number) => mapPlayer(p, true,  i)),
            ...data.bench.map(   (p: any, i: number) => mapPlayer(p, false, i)),
        ];

        return { players, formation, tactic };

    } catch (err) {
        console.error('❌ [AI Director] Falha ao gerar elenco completo:', err);
        return buildFallbackSquad(teamName, targetOvr, formations);
    }
}

// ─── Gera apenas XI titular para o motor de partida (times sem registro) ──────
export async function generateTeamViaAI(
    guildId: string,
    teamName: string,
    targetOvr: number,
): Promise<IPlayer[] | null> {
    const result = await generateFullSquadViaAI(guildId, teamName, targetOvr);
    return result ? result.players.filter(p => p.isStarter) : null;
}

// ─── Escolhe formação e tática com base no elenco existente (sugestão 2) ──────
export async function suggestTacticsViaAI(
    guildId: string,
    team: ITeam,
): Promise<{ formation: string; tactic: string; reason: string } | null> {
    const aiConfig   = await getGuildAIConfig(guildId);
    const formations = loadFormations();

    const rosterSummary = team.players
        .map(p => `${p.name} (${p.position}, OVR:${p.overall}, ${p.archetype})`)
        .join(', ');

    if (!aiConfig) {
        // Fallback sem IA: escolha baseada em estatísticas simples do elenco
        const atkCount = team.players.filter(p => p.position === 'ATK').length;
        const defCount = team.players.filter(p => p.position === 'DEF').length;
        const formation = atkCount >= 3 && defCount >= 4 ? '4-3-3' : defCount >= 5 ? '5-3-2' : '4-4-2';
        const tactic    = VALID_TACTICS[Math.floor(Math.random() * VALID_TACTICS.length)];
        return { formation, tactic, reason: 'Sugestão automática baseada no perfil do elenco (sem IA configurada).' };
    }

    const prompt = `
Você é um analista tático de futebol. Analise este elenco e sugira a melhor formação e tática.

Clube: "${team.name}"
Elenco: ${rosterSummary}

RETORNE APENAS um JSON com este formato exato (sem markdown):
{
  "formation": "4-3-3",
  "tactic": "POSSE",
  "reason": "Explicação curta em 1-2 frases"
}

- "formation": escolha entre ${formations.slice(0, 8).join(', ')} etc.
- "tactic": escolha entre ${VALID_TACTICS.join(', ')}.
- "reason": explique POR QUÊ essa combinação faz sentido para este elenco.
`;

    try {
        let raw = await chamarIA(prompt, aiConfig);
        raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('JSON não encontrado');

        const data = JSON.parse(match[0]);
        return {
            formation: formations.includes(data.formation) ? data.formation : '4-3-3',
            tactic:    VALID_TACTICS.includes(data.tactic) ? data.tactic : 'BALANCEADO',
            reason:    data.reason ?? 'Sem justificativa disponível.',
        };
    } catch (err) {
        console.error('❌ [AI Director] Falha ao sugerir táticas:', err);
        return null;
    }
}

// ─── Fallback: elenco genérico quando a IA falha ─────────────────────────────
function buildFallbackSquad(
    teamName: string,
    targetOvr: number,
    formations: string[],
): { players: IPlayer[]; formation: string; tactic: string } {
    const formation = formations[Math.floor(Math.random() * Math.min(6, formations.length))] ?? '4-3-3';
    const tactic    = VALID_TACTICS[Math.floor(Math.random() * VALID_TACTICS.length)];

    const players: IPlayer[] = [
        ...STARTER_TEMPLATE.map((t, i) => makePlayer(teamName, t, i + 1, targetOvr, true)),
        ...BENCH_TEMPLATE.map(  (t, i) => makePlayer(teamName, t, i + 12, Math.max(50, targetOvr - 8), false)),
    ];

    return { players, formation, tactic };
}

function makePlayer(
    teamName: string,
    template: { pos: IPlayer['position']; arch: string },
    number: number,
    ovr: number,
    isStarter: boolean,
): IPlayer {
    const variance = Math.floor(Math.random() * 7) - 3;
    return {
        name:      `${teamName.split(' ')[0]} ${template.pos}${number}`,
        position:  template.pos,
        age:       18 + Math.floor(Math.random() * 15),
        number,
        overall:   Math.min(99, Math.max(1, ovr + variance)),
        archetype: template.arch,
        energy:    100,
        sharpness: isStarter ? 60 : 50,
        morale:    3,
        isStarter,
    };
}