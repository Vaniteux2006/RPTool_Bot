// RPTool/supercommands/console/index.ts
// ─── Console de JavaScript (rp!console) ───────────────────────────────────────
//
// A proposta é o console do navegador, não um executor de programas: você digita
// uma expressão e vê o VALOR dela. `0.1 + 0.2` responde 0.30000000000000004 sem
// precisar de console.log — porque o que é exibido é o valor de completude do
// último statement, igual ao devtools.
//
// Antes isto mandava o código pra API pública do Piston, que virou whitelist-only
// em 15/02/2026 e derrubou o comando. Agora roda local, em QuickJS compilado pra
// WebAssembly (sandbox.ts + runner.js).
//
// Por que WASM e não node:vm: o vm compartilha o heap do processo e é escapável
// com uma linha (`this.constructor.constructor('return process')()`), o que daria
// acesso ao token do bot, às URIs do Mongo e às chaves de IA dos usuários. No WASM
// não existe `process` pra alcançar — não há syscall, só o que injetamos na mão.
//
// Limites (ver sandbox.ts): 3s de CPU, 32 MB de heap, 512 KB de pilha, e um
// terminate() do worker como segunda garantia se o interrupt não responder.
import { Message } from 'discord.js';
import { executar, LIMITES } from './sandbox';

// ─── Tetos de ENTRADA ─────────────────────────────────────────────────────────
// Recusar cedo é mais barato que interromper no meio. Uma mensagem do Discord já
// não passa de 2000 (4000 com Nitro) caracteres, então isto é sobretudo garantia
// explícita: nada de colar um projeto inteiro aqui.
const MAX_CARACTERES = 4_000;
const MAX_LINHAS     = 200;

// A saída é CPU do bot agora, não de servidor alheio.
const COOLDOWN_MS = 3_000;
const ultimoUso = new Map<string, number>();

const MAX_SAIDA = 1_800;   // sobra pro resto da mensagem dentro dos 2000 do Discord

// ─── Extração do código ───────────────────────────────────────────────────────
// Aceita bloco cercado (```js … ```), crase simples e texto solto.
function extrairCodigo(bruto: string): string {
    const s = bruto.trim();

    const cercado = s.match(/^```[a-zA-Z]*\r?\n?([\s\S]*?)\r?\n?```$/);
    if (cercado) return cercado[1].trim();

    const simples = s.match(/^`([^`]+)`$/);
    if (simples) return simples[1].trim();

    return s;
}

function truncar(texto: string, max: number): string {
    if (texto.length <= max) return texto;
    return texto.slice(0, max) + `\n… (+${texto.length - max} caracteres)`;
}

const AJUDA =
    '💻 **Console JavaScript**\n' +
    'Mostra o **valor** da expressão, igual ao console do navegador:\n' +
    '```\nrp!console 0.1 + 0.2\n→ 0.30000000000000004\n```\n' +
    'Aceita bloco de código com várias linhas:\n' +
    '\\`\\`\\`js\n' +
    'let soma = (a, b) => a + b\n' +
    'soma(2, 3)\n' +
    '\\`\\`\\`\n' +
    `-# Roda isolado em WebAssembly, sem acesso a rede ou arquivos. Teto de ${LIMITES.TIMEOUT_MS / 1000}s e ${LIMITES.MEMORIA_MB} MB. ` +
    'Editar a mensagem re-executa.';

export default {
    name: 'console',
    description: 'Console de JavaScript em sandbox (WebAssembly).',
    aliases: ['js', 'run', 'eval'],

    async execute(message: Message, _args: string[]) {
        // args vem de um split por espaço e perderia as quebras de linha do bloco,
        // então o código sai do conteúdo bruto.
        const semComando = message.content.replace(/^\s*rp!(console|js|run|eval)\b[ \t]*/i, '');
        const codigo = extrairCodigo(semComando);

        if (!codigo || /^(help|ajuda|comandos)$/i.test(codigo)) {
            return message.reply(AJUDA);
        }

        // ── Tetos de entrada ──────────────────────────────────────────────────
        if (codigo.length > MAX_CARACTERES) {
            return message.reply(`❌ Código grande demais (${codigo.length} caracteres, teto de ${MAX_CARACTERES}).`);
        }
        const linhas = codigo.split('\n').length;
        if (linhas > MAX_LINHAS) {
            return message.reply(`❌ Código com linhas demais (${linhas}, teto de ${MAX_LINHAS}).`);
        }

        // ── Cooldown ──────────────────────────────────────────────────────────
        const agora = Date.now();
        const ultimo = ultimoUso.get(message.author.id) ?? 0;
        if (agora - ultimo < COOLDOWN_MS) {
            const faltam = ((COOLDOWN_MS - (agora - ultimo)) / 1000).toFixed(1);
            return message.reply(`⏳ Calma — espera ${faltam}s.`);
        }
        ultimoUso.set(message.author.id, agora);
        if (ultimoUso.size > 1_000) {
            const maisVelho = ultimoUso.keys().next().value;   // Map preserva ordem de inserção
            if (maisVelho) ultimoUso.delete(maisVelho);
        }

        // ── Execução ──────────────────────────────────────────────────────────
        const r = await executar(codigo);

        if (r.interrompido) {
            return message.reply(
                `⏱️ **Tempo esgotado** (${LIMITES.TIMEOUT_MS / 1000}s). Loop infinito ou cálculo pesado demais.` +
                (r.morto ? '\n-# O sandbox travou e foi derrubado; a próxima execução sobe um novo.' : ''),
            );
        }
        if (r.estourouMemoria) {
            return message.reply(`💥 **Estourou a memória** (teto de ${LIMITES.MEMORIA_MB} MB).`);
        }
        if (!r.ok) {
            return message.reply(`❌ \`\`\`\n${truncar(r.erro ?? 'Erro desconhecido.', MAX_SAIDA)}\n\`\`\``);
        }

        // ── Saída ─────────────────────────────────────────────────────────────
        const partes: string[] = [];
        if (r.logs) partes.push(r.logs);
        if (r.saida && r.saida !== 'undefined') partes.push(r.saida);
        else if (!r.logs) partes.push('undefined');

        return message.reply(`\`\`\`js\n${truncar(partes.join('\n'), MAX_SAIDA)}\n\`\`\``);
    },
};
