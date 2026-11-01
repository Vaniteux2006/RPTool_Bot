// RPTool/supercommands/help/guides/template.ts
// ─── Molde HTML dos guias visuais do rp!help ──────────────────────────────────
// Um guia vira uma página 1600px de largura (altura conforme o conteúdo), que o
// render.ts fotografa com o Edge/Chrome headless. Conteúdo em ./data.ts.
//
// Marcação nos textos: **trecho** vira destaque (cor do bloco nos comandos,
// negrito nas explicações) e `trecho` vira código. Todo o resto é escapado.

export type Accent = 'green' | 'blue' | 'gold' | 'red' | 'purple' | 'teal' | 'pink';

export interface GuideStep {
    /** Comando (uma linha) ou comandos (várias caixas empilhadas). */
    cmd:   string | string[];
    what?: string;
}

export interface GuideColumn {
    title:  string;
    who?:   string;   // linha cinza sob o título ("qualquer pessoa", "só staff"...)
    accent: Accent;
    steps:  GuideStep[];
}

export type GuideBox =
    | { kind: 'chips'; title: string; items: { name: string; desc: string }[]; width?: number }
    | { kind: 'flags'; title: string; items: { flag: string; desc: string }[]; width?: number }
    | { kind: 'note';  title: string; text: string; width?: number };

export interface Guide {
    id:       string;   // nome do PNG (img/<id>.png) e chave usada no registry
    title:    string;   // texto antes do destaque, ex: 'Como usar o'
    command:  string;   // destaque verde do título, ex: 'rp!futebol'
    emoji:    string;
    subtitle: string;
    tip?:     string;   // caixinha no canto superior direito
    columns:  GuideColumn[];
    boxes?:   GuideBox[];
}

const ACCENTS: Record<Accent, string> = {
    green: '#3ecf6e', blue: '#5aa9ff', gold: '#f2c14e', red: '#ff6b6b',
    purple: '#b48cff', teal: '#3fd0c9', pink: '#ff7eb6',
};

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Escapa, troca **x** pela tag pedida e `x` por código. */
function mark(s: string, tag: 'b' | 'em'): string {
    return esc(s)
        .replace(/\*\*(.+?)\*\*/g, `<${tag}>$1</${tag}>`)
        .replace(/`([^`]+)`/g, '<code class="inl">$1</code>');
}

function column(c: GuideColumn, n: number): string {
    const steps = c.steps.map(s => {
        const cmds = (Array.isArray(s.cmd) ? s.cmd : [s.cmd]).map(x => `<code class="cmd">${mark(x, 'b')}</code>`).join('');
        return `<div class="step">${cmds}${s.what ? `<p class="what">${mark(s.what, 'em')}</p>` : ''}</div>`;
    }).join('');
    return `<div class="card" style="--accent:${ACCENTS[c.accent]}">
      <h2><span class="n">${n}</span>${esc(c.title)}</h2>
      ${c.who ? `<p class="who">${esc(c.who)}</p>` : '<div class="gap"></div>'}
      ${steps}
    </div>`;
}

function box(b: GuideBox): string {
    let body = '';
    if (b.kind === 'chips') {
        body = `<div class="chips" style="grid-template-columns:repeat(${Math.min(b.items.length, 5)},minmax(0,1fr))">` +
            b.items.map(i => `<div class="chip"><code>${esc(i.name)}</code><p>${mark(i.desc, 'em')}</p></div>`).join('') + '</div>';
    } else if (b.kind === 'flags') {
        body = '<div class="flags">' + b.items.map(i => `<code>${esc(i.flag)}</code><span>${mark(i.desc, 'em')}</span>`).join('') + '</div>';
    } else {
        body = `<p class="note">${mark(b.text, 'em')}</p>`;
    }
    return `<div class="card box"><h3>${esc(b.title)}</h3>${body}</div>`;
}

export function renderGuideHtml(g: Guide): string {
    const cols  = g.columns.map((c, i) => column(c, i + 1)).join('');
    const boxes = g.boxes ?? [];
    const boxCols = boxes.map(b => `${b.width ?? 1}fr`).join(' ');
    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${esc(g.command)}</title>
<style>
  :root { --bg:#15171a; --card:#1f2226; --line:#2c3036; --ink:#e9ecef; --muted:#9aa3ad; --code:#0f1113;
          --green:#3ecf6e; --gold:#f2c14e; --blue:#5aa9ff; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html { background:var(--bg); }
  body { width:1600px; background:var(--bg); color:var(--ink); font-family:"Segoe UI",system-ui,sans-serif;
         padding:44px 52px 48px; background-image:radial-gradient(circle at 92% -10%, rgba(62,207,110,.16), transparent 42%);
         background-repeat:no-repeat; }
  header { display:flex; align-items:flex-end; justify-content:space-between; gap:30px; margin-bottom:30px; }
  h1 { font-size:52px; font-weight:800; letter-spacing:-1px; white-space:nowrap; }
  h1 span { color:var(--green); }
  .sub { color:var(--muted); font-size:20px; margin-top:6px; }
  .sub em { color:var(--ink); font-style:normal; font-weight:600; }
  .tip { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px 18px; font-size:18px;
         color:var(--muted); max-width:520px; }
  .tip b { color:var(--green); font-weight:600; font-family:"Cascadia Mono",Consolas,monospace; }
  .cols { display:grid; grid-template-columns:repeat(${g.columns.length}, minmax(0,1fr)); gap:22px; align-items:start; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:24px 24px 22px; border-top:4px solid var(--accent); }
  .card h2 { font-size:26px; display:flex; align-items:center; gap:12px; margin-bottom:4px; }
  .n { width:38px; height:38px; border-radius:50%; background:var(--accent); color:#111; font-weight:800;
       display:grid; place-items:center; font-size:20px; flex:none; }
  .who { color:var(--muted); font-size:16px; margin:0 0 16px 50px; }
  .gap { height:12px; }
  .step { margin-bottom:14px; }
  .step:last-child { margin-bottom:0; }
  code { font-family:"Cascadia Mono",Consolas,monospace; }
  .cmd { display:block; background:var(--code); border:1px solid var(--line); border-radius:8px; padding:8px 12px;
         font-size:15px; color:#dfe6ec; overflow-wrap:break-word; line-height:1.45; }
  .cmd + .cmd { margin-top:6px; }
  .cmd b { color:var(--accent); font-weight:600; }
  .what { font-size:15.5px; color:var(--muted); margin:5px 2px 0; line-height:1.35; }
  .what em, .note em, .chip em, .flags em { color:var(--ink); font-style:normal; font-weight:600; }
  .boxes { display:grid; grid-template-columns:${boxCols || '1fr'}; gap:22px; margin-top:22px; }
  .box { border-top:1px solid var(--line); padding:18px 22px; }
  .box h3 { font-size:15px; letter-spacing:3px; color:var(--muted); font-weight:700; margin-bottom:12px; text-transform:uppercase; }
  .chips { display:grid; gap:10px; }
  .chip { background:var(--code); border:1px solid var(--line); border-radius:10px; padding:10px 12px; }
  .chip code { color:var(--gold); font-size:14.5px; font-weight:600; }
  .chip p { color:var(--muted); font-size:13.5px; margin-top:5px; line-height:1.3; }
  .flags { display:grid; grid-template-columns:auto 1fr; gap:8px 14px; font-size:16px; align-items:center; }
  .flags code { color:var(--blue); background:var(--code); border:1px solid var(--line); border-radius:6px; padding:3px 8px; white-space:nowrap; }
  .flags span { color:var(--muted); }
  .note { color:var(--muted); font-size:16.5px; line-height:1.45; }
  .inl { color:#cfd6dd; background:var(--code); border:1px solid var(--line); border-radius:5px; padding:0 5px; font-size:.92em; }
</style>
</head>
<body>
  <header>
    <div>
      <h1>${esc(g.title)} <span>${esc(g.command)}</span> ${g.emoji}</h1>
      <p class="sub">${mark(g.subtitle, 'em')}</p>
    </div>
    ${g.tip ? `<div class="tip">${mark(g.tip, 'b')}</div>` : ''}
  </header>
  <section class="cols">${cols}</section>
  ${boxes.length ? `<section class="boxes">${boxes.map(box).join('')}</section>` : ''}
  <script>document.body.setAttribute('data-h', String(Math.ceil(document.body.getBoundingClientRect().bottom)));</script>
</body>
</html>`;
}
