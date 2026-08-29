// RPTool/supercommands/resumo/modules/pages.ts
// ─── Montagem das páginas ────────────────────────────────────────────────────
// Três seções: Tópicos → Ações/Participantes → Linha do Tempo. Tudo é quebrado
// pelos limites do Discord (1024/field, 4096/description, 6000/embed) — estourar
// derrubaria o comando DEPOIS de as requisições já terem sido pagas.
import { EmbedBuilder, Message } from 'discord.js';
import { LIMITE_DESCRIPTION, LIMITE_EMBED, MAX_ITENS_POR_PAGINA } from '../config';
import { BlocoResumo } from '../types';
import { truncar } from './text';

function paginarLista(itens: string[], titulo: string, cor: number, vazio: string): EmbedBuilder[] {
    if (itens.length === 0) {
        return [new EmbedBuilder().setTitle(titulo).setColor(cor).setDescription(vazio)];
    }

    const paginas: EmbedBuilder[] = [];
    for (let i = 0; i < itens.length; i += MAX_ITENS_POR_PAGINA) {
        const fatia = itens.slice(i, i + MAX_ITENS_POR_PAGINA);
        const nome = itens.length > MAX_ITENS_POR_PAGINA
            ? `${titulo} (Parte ${Math.floor(i / MAX_ITENS_POR_PAGINA) + 1})`
            : titulo;

        paginas.push(new EmbedBuilder()
            .setTitle(nome)
            .setColor(cor)
            .setDescription(fatia.map(t => `• ${t}`).join('\n').substring(0, 4000)));
    }
    return paginas;
}

function formatarIntervalo(chunk: Message[]): string {
    const primeira = chunk[0];
    const ultima = chunk[chunk.length - 1];
    const fmt = (m: Message) =>
        `${m.createdAt.toLocaleDateString('pt-BR')} às ${m.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const inicio = fmt(primeira);
    const fim = fmt(ultima);
    return inicio === fim ? inicio : `${inicio} até ${fim}`;
}

function paginarLinhaDoTempo(resumos: BlocoResumo[], chunks: Message[][]): EmbedBuilder[] {
    const paginas: EmbedBuilder[] = [];
    let embed = new EmbedBuilder().setTitle('📜 Linha do Tempo (Eventos)').setColor(0x5865F2);
    let fields = 0;
    let chars = 0;

    for (let i = 0; i < resumos.length; i++) {
        const nome = `Parte ${i + 1} (${formatarIntervalo(chunks[i])})`;
        const valor = truncar(resumos[i].sintese || 'Sem dados.');

        // Quebra a página por caracteres também: 15 fields cheios passam fácil
        // dos 6000 do embed inteiro.
        if (fields > 0 && chars + nome.length + valor.length > LIMITE_EMBED - 500) {
            paginas.push(embed);
            embed = new EmbedBuilder().setTitle('📜 Linha do Tempo (Cont.)').setColor(0x5865F2);
            fields = 0;
            chars = 0;
        }

        embed.addFields({ name: nome, value: valor });
        fields++;
        chars += nome.length + valor.length;

        if (fields === 15 || i === resumos.length - 1) {
            paginas.push(embed);
            embed = new EmbedBuilder().setTitle('📜 Linha do Tempo (Cont.)').setColor(0x5865F2);
            fields = 0;
            chars = 0;
        }
    }

    return paginas;
}

export function montarPaginas(resumos: BlocoResumo[], chunks: Message[][]): EmbedBuilder[] {
    const topicos = [...new Set(resumos.flatMap(d => d.topicos || []).filter(Boolean))];
    const acoes = resumos.flatMap(d => d.participantes || []).filter(Boolean);

    return [
        ...paginarLista(topicos, '📌 Todos os Tópicos Abordados', 0x00FF00, 'Nenhum tópico encontrado.'),
        ...paginarLista(acoes, '👥 Ações e Participantes', 0xFFA500, 'Nenhuma ação registada.'),
        ...paginarLinhaDoTempo(resumos, chunks),
    ];
}

export function montarSuperEmbed(dados: BlocoResumo): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`🌟 SUPER RESUMO FINAL`)
        // arco_geral vai na description (4096) e não num field (1024):
        // "a história inteira" não cabe em field nenhum.
        .setDescription(truncar(dados.arco_geral || 'Sem dados.', LIMITE_DESCRIPTION))
        .addFields({
            name: '✅ Conclusões e Desdobramentos',
            value: truncar(dados.conclusoes?.map((c: string) => `• ${c}`).join('\n') || 'Sem detalhes.'),
        });
}
