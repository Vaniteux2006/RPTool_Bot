// RPTool/supercommands/console/runner.js
// ─── Worker: avalia o código dentro do QuickJS (WASM) ─────────────────────────
//
// ⚠️ Este arquivo é .js de propósito, num projeto TypeScript.
// worker_threads carrega o arquivo num processo/thread separado, e apontar um .ts
// exigiria registrar o ts-node dentro do worker (mais startup e mais uma coisa pra
// dar errado). O worker é pequeno e autocontido, então fica em JS puro — mesma
// escolha do loader.js da raiz. O único trecho de código que ele recebe de fora
// é o INSPECT_SRC, entregue via workerData pelo sandbox.ts.
//
// Por que worker e não avaliar direto no bot: ctx.evalCode é SÍNCRONO. Rodando na
// thread principal, um `while(true)` congelaria o event loop do bot inteiro pelo
// tempo do timeout — todos os servidores parados. Aqui congela só este worker, e
// o sandbox.ts ainda pode dar terminate() nele.
const { parentPort, workerData } = require('worker_threads');
const { getQuickJS } = require('quickjs-emscripten');

const INSPECT_SRC = workerData.inspectSrc;

// Teto de saída acumulada por console.log — evita bomba de memória num loop.
const MAX_LOGS = 200;

let quickjsPromise = null;
function quickjs() {
    // O módulo WASM é carregado uma vez e reaproveitado: o worker fica "quente",
    // então a latência do WASM é paga só na primeira execução.
    if (!quickjsPromise) quickjsPromise = getQuickJS();
    return quickjsPromise;
}

// Ambiente injetado antes do código do usuário: o formatador e um console que
// só acumula strings (não existe stdout aqui dentro).
const PRELUDIO = `
${INSPECT_SRC}
globalThis.__logs = [];
(function () {
    function escrever() {
        if (__logs.length >= ${MAX_LOGS}) return;
        var partes = [];
        for (var i = 0; i < arguments.length; i++) partes.push(__inspect(arguments[i]));
        __logs.push(partes.join(' '));
    }
    globalThis.console = { log: escrever, info: escrever, warn: escrever, error: escrever, debug: escrever };
})();
`;

async function avaliar({ codigo, timeoutMs, memoriaMb, pilhaKb }) {
    const QuickJS = await quickjs();
    const rt = QuickJS.newRuntime();

    // Runtime NOVO a cada execução: nada vaza de um rp!console pro próximo.
    rt.setMemoryLimit(memoriaMb * 1024 * 1024);
    rt.setMaxStackSize(pilhaKb * 1024);          // corta recursão infinita

    const inicio = Date.now();
    rt.setInterruptHandler(() => Date.now() - inicio > timeoutMs);

    const ctx = rt.newContext();
    try {
        const prep = ctx.evalCode(PRELUDIO);
        if (prep.error) { prep.error.dispose(); return { ok: false, erro: 'Falha ao preparar o sandbox.' }; }
        prep.value.dispose();

        const r = ctx.evalCode(codigo);

        // ── Erro do usuário ───────────────────────────────────────────────────
        if (r.error) {
            const e = ctx.dump(r.error);
            r.error.dispose();
            const nome = (e && e.name) || 'Error';
            const msg = (e && e.message) || String(e);
            return {
                ok: false,
                interrompido: nome === 'InternalError' && /interrupted/i.test(msg),
                estourouMemoria: /out of memory/i.test(msg),
                erro: `${nome}: ${msg}`,
                logs: colherLogs(ctx),
            };
        }

        // ── Formata o valor de completude DENTRO do sandbox ───────────────────
        ctx.setProp(ctx.global, '__resultado', r.value);
        r.value.dispose();

        const fmt = ctx.evalCode('__inspect(__resultado)');
        let saida = '(sem valor)';
        if (fmt.error) { fmt.error.dispose(); }
        else { saida = ctx.getString(fmt.value); fmt.value.dispose(); }

        return { ok: true, saida, logs: colherLogs(ctx) };
    } finally {
        ctx.dispose();
        rt.dispose();
    }
}

function colherLogs(ctx) {
    const r = ctx.evalCode('__logs.join("\\n")');
    if (r.error) { r.error.dispose(); return ''; }
    const s = ctx.getString(r.value);
    r.value.dispose();
    return s;
}

parentPort.on('message', async (pedido) => {
    try {
        const resultado = await avaliar(pedido);
        parentPort.postMessage({ id: pedido.id, ...resultado });
    } catch (e) {
        // Falha do próprio motor (não do código do usuário)
        parentPort.postMessage({ id: pedido.id, ok: false, erro: `Motor: ${e && e.message}` });
    }
});
