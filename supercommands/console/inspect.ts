// RPTool/supercommands/console/inspect.ts
// ─── Formatação estilo DevTools ───────────────────────────────────────────────
//
// ⚠️ Este código é uma STRING que roda DENTRO do sandbox, não no bot.
//
// Por quê: o `ctx.dump()` do quickjs-emscripten converte o valor via JSON, e JSON
// perde justamente o que dá graça num console — função vira undefined, Map/Set
// viram {}, e referência circular joga exceção. Formatando lá dentro, o que
// atravessa a fronteira é só uma string já pronta.
export const INSPECT_SRC = `
globalThis.__inspect = function (valor) {
    var vistos = [];

    function aspas(s) {
        return "'" + s.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'").replace(/\\n/g, '\\\\n') + "'";
    }

    function fmt(v, prof) {
        if (v === null) return 'null';
        if (v === undefined) return 'undefined';

        var t = typeof v;

        if (t === 'number') {
            // -0 é diferente de 0 no console do navegador
            if (Object.is(v, -0)) return '-0';
            return String(v);
        }
        if (t === 'bigint')  return String(v) + 'n';
        if (t === 'boolean') return String(v);
        if (t === 'string')  return prof === 0 ? aspas(v) : aspas(v);
        if (t === 'symbol')  return v.toString();

        if (t === 'function') {
            var nome = v.name || '(anônima)';
            return (String(v).indexOf('class') === 0 ? 'class ' : 'ƒ ') + nome;
        }

        // A partir daqui é objeto: profundidade e ciclo
        if (prof > 4) return '…';
        if (vistos.indexOf(v) !== -1) return '[Circular]';
        vistos.push(v);

        try {
            if (Array.isArray(v)) {
                if (v.length === 0) return '[]';
                var itens = [];
                for (var i = 0; i < v.length && i < 100; i++) itens.push(fmt(v[i], prof + 1));
                if (v.length > 100) itens.push('… mais ' + (v.length - 100));
                return '(' + v.length + ') [' + itens.join(', ') + ']';
            }

            if (v instanceof Error) {
                return v.name + ': ' + v.message;
            }
            if (v instanceof Date)   return v.toISOString();
            if (v instanceof RegExp) return String(v);

            if (typeof Map !== 'undefined' && v instanceof Map) {
                var mp = [];
                v.forEach(function (val, ch) { if (mp.length < 100) mp.push(fmt(ch, prof + 1) + ' => ' + fmt(val, prof + 1)); });
                return 'Map(' + v.size + ') {' + (mp.length ? ' ' + mp.join(', ') + ' ' : '') + '}';
            }
            if (typeof Set !== 'undefined' && v instanceof Set) {
                var st = [];
                v.forEach(function (val) { if (st.length < 100) st.push(fmt(val, prof + 1)); });
                return 'Set(' + v.size + ') {' + (st.length ? ' ' + st.join(', ') + ' ' : '') + '}';
            }
            if (typeof Promise !== 'undefined' && v instanceof Promise) return 'Promise { <pendente> }';

            var chaves = Object.keys(v);
            if (chaves.length === 0) return '{}';
            var pares = [];
            for (var k = 0; k < chaves.length && k < 100; k++) {
                var ch2 = chaves[k];
                var seguro = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(ch2) ? ch2 : aspas(ch2);
                pares.push(seguro + ': ' + fmt(v[ch2], prof + 1));
            }
            if (chaves.length > 100) pares.push('… mais ' + (chaves.length - 100));
            return '{ ' + pares.join(', ') + ' }';
        } finally {
            vistos.pop();
        }
    }

    try { return fmt(valor, 0); }
    catch (e) { return '[não foi possível formatar: ' + (e && e.message) + ']'; }
};
`;
