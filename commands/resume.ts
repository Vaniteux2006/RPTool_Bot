import {
    Message,
    TextChannel,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ButtonInteraction,
    Interaction,
    MessageFlags
} from "discord.js";
import { Command } from "../tools/interfaces/Command";
import { getGuildAIConfig } from '../tools/utils/tokenHelper';
import { EventCheckout } from '../tools/eventCheckout';
import axios from 'axios';

// Teto de mensagens puxadas do Discord por execução.
const MAX_MENSAGENS = 1200;
// Teto de caracteres por requisição à IA — é isto que segura o custo em 1 requisição.
// Medido com 1200 mensagens (o teto do fetch), a ~3,5 chars/token em português:
//   mensagens curtas/mistas → 1 req | RP típico (~400c) → 1 req (~142k tokens)
//   prosa longa (~800c) → 2 req | extremo (~1900c) → 4 req
// Subir para 1.5M fecharia tudo em 1-2 req, mas geraria requisições de ~650k tokens,
// que arriscam o limite de tokens/minuto e a latência. 600k é o ponto de equilíbrio.
const MAX_CHARS_POR_BLOCO = 600_000;
// Limites do Discord: 1024 por field, 4096 por description, 6000 por embed.
const LIMITE_FIELD = 1024;
const LIMITE_DESCRIPTION = 4096;
const LIMITE_EMBED = 6000;

// Schemas de saída. Com responseSchema o modelo não tem como devolver markdown,
// preâmbulo ou chave faltando — que era a principal forma de queimar requisição.
const SCHEMA_BLOCO = {
    type: "OBJECT",
    properties: {
        topicos: { type: "ARRAY", items: { type: "STRING" } },
        sintese: { type: "STRING" },
        participantes: { type: "ARRAY", items: { type: "STRING" } }
    },
    required: ["topicos", "sintese", "participantes"]
};

const SCHEMA_COMPLETO = {
    type: "OBJECT",
    properties: {
        topicos: { type: "ARRAY", items: { type: "STRING" } },
        sintese: { type: "STRING" },
        participantes: { type: "ARRAY", items: { type: "STRING" } },
        arco_geral: { type: "STRING" },
        conclusoes: { type: "ARRAY", items: { type: "STRING" } }
    },
    required: ["topicos", "sintese", "participantes", "arco_geral", "conclusoes"]
};

const SCHEMA_SUPER = {
    type: "OBJECT",
    properties: {
        arco_geral: { type: "STRING" },
        conclusoes: { type: "ARRAY", items: { type: "STRING" } }
    },
    required: ["arco_geral", "conclusoes"]
};

// Escada de espera do retry. O comando é "manda e esquece", então o retry segue
// infinito para erros transitórios — só deixa de martelar de 5 em 5 segundos.
const ESCADA_BACKOFF = [5, 10, 30, 60];

function atrasoBackoff(tentativa: number): number {
    return ESCADA_BACKOFF[Math.min(tentativa - 1, ESCADA_BACKOFF.length - 1)];
}

// O Gemini manda o tempo de espera sugerido em error.details (RetryInfo).
function extrairRetryDelay(error: any): number | undefined {
    const detalhes = error.response?.data?.error?.details;
    if (Array.isArray(detalhes)) {
        for (const d of detalhes) {
            if (typeof d?.retryDelay === 'string') {
                const s = parseInt(d.retryDelay);
                if (!isNaN(s) && s > 0) return Math.min(s, 300);
            }
        }
    }
    const m = String(error.message || '').match(/retryDelay["\s:]+(\d+)s/i);
    return m ? Math.min(parseInt(m[1]), 300) : undefined;
}

type TipoFalha = 'sobrecarga' | 'ratelimit' | 'quota' | 'bloqueio' | 'outro';

// O Gemini NÃO diz na message se a cota estourada é a diária ou a por minuto —
// a message é genérica ("You exceeded your current quota"). Quem distingue é o
// quotaId dentro de error.details (ex.: GenerateRequestsPerDayPerProjectPerModel).
// Sem olhar os details, cota diária vira "rate limit" e o retry fica infinito à toa.
const PADRAO_COTA_DIARIA = /per\s*day|perday|daily|per_day/i;

function ehCotaDiaria(error: any, msg: string): boolean {
    if (PADRAO_COTA_DIARIA.test(msg)) return true;

    const detalhes = error.response?.data?.error?.details;
    if (Array.isArray(detalhes)) {
        for (const d of detalhes) {
            const violacoes = d?.violations;
            if (!Array.isArray(violacoes)) continue;
            for (const v of violacoes) {
                if (PADRAO_COTA_DIARIA.test(`${v?.quotaId ?? ''} ${v?.quotaMetric ?? ''}`)) return true;
            }
        }
    }
    return false;
}

// 429 de rate-limit passa em segundos; 429 de cota diária só volta na virada do
// dia. Tratar os dois igual era o que fazia o bot insistir à toa por horas.
function classificarErroIA(error: any): { tipo: TipoFalha; msg: string; esperaSegundos?: number } {
    const msg = error.response?.data?.error?.message || error.message || error.toString();
    const status = error.response?.status;

    if (status === 503 || msg.includes('503') || msg.includes('Overloaded') || msg.includes('high demand')) {
        return { tipo: 'sobrecarga', msg };
    }

    if (status === 429 || msg.includes('429') || msg.includes('Too Many Requests') ||
        msg.includes('Quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        return { tipo: ehCotaDiaria(error, msg) ? 'quota' : 'ratelimit', msg, esperaSegundos: extrairRetryDelay(error) };
    }

    if (msg.includes('PROMPT_BLOQUEADO') || msg.includes('RESPOSTA_BLOQUEADA') ||
        (msg.includes('GoogleGenerativeAI Error') && msg.includes('was blocked'))) {
        return { tipo: 'bloqueio', msg };
    }

    return { tipo: 'outro', msg };
}

// A cota diária do free tier vira à meia-noite no fuso do Pacífico.
function horasAteViradaQuota(): number {
    const agoraPT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    return Math.max(1, Math.ceil(24 - agoraPT.getHours() - agoraPT.getMinutes() / 60));
}

function truncar(text: string, max: number = LIMITE_FIELD): string {
    if (!text) return text;
    return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

function sanitizeOutput(text: string): string {
    if (!text) return text;
    return text
        .replace(/@everyone/g, '@everyоne')
        .replace(/@here/g, '@hеre')        
        .replace(/<@&(\d+)>/g, '<@&\u200b$1>'); 
}

function dateToSnowflake(date: Date): string {
    const epoch = 1420070400000n;
    const timestamp = BigInt(date.getTime());
    const snowflake = (timestamp - epoch) << 22n;
    return snowflake.toString();
}

function parseCustomDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const match = dateStr.trim().match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!match) return null;
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
    const hours = match[4] ? parseInt(match[4]) : 0;
    const minutes = match[5] ? parseInt(match[5]) : 0;
    return new Date(year, month, day, hours, minutes);
}

function parseAIJSON(text: string): any {
    try {
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);

        if (parsed.sintese) parsed.sintese = sanitizeOutput(parsed.sintese);
        if (parsed.topicos) parsed.topicos = parsed.topicos.map((t: string) => sanitizeOutput(t));
        if (parsed.participantes) parsed.participantes = parsed.participantes.map((p: string) => sanitizeOutput(p));
        if (parsed.arco_geral) parsed.arco_geral = sanitizeOutput(parsed.arco_geral);
        if (parsed.conclusoes) parsed.conclusoes = parsed.conclusoes.map((c: string) => sanitizeOutput(c));

        return parsed;
    } catch (e) {
        console.error("Falha ao parsear JSON da IA. Retorno:", text);
        return { sintese: "Erro de formatação.", topicos: [], participantes: [], contexto: "Erro" };
    }
}

async function chamarIAResumo(prompt: string, config: any, schema?: any): Promise<string> {
    if (!config || !config.provider) throw new Error("Configuração de IA inválida.");

    if (config.provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`;
        const body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                ...(schema ? { responseSchema: schema } : {}),
                temperature: 0.4
            },
            // RP tem violência, palavrão e conteúdo adulto — sem isto o bloqueio é
            // o caso comum, não a exceção. Mesmo ajuste que api.ts já fazia.
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
        };
        const res = await axios.post(url, body);

        const candidato = res.data?.candidates?.[0];
        if (!candidato) {
            const motivoPrompt = res.data?.promptFeedback?.blockReason;
            if (motivoPrompt) throw new Error(`PROMPT_BLOQUEADO: ${motivoPrompt}`);
            throw new Error("Gemini não retornou resposta.");
        }

        // O candidato pode existir SEM content.parts (safety, MAX_TOKENS, recitação).
        // Sem esta checagem virava TypeError e caía no catch genérico com a mensagem errada.
        const texto = candidato.content?.parts?.[0]?.text;
        if (!texto) {
            const motivo = candidato.finishReason || 'DESCONHECIDO';
            if (motivo === 'SAFETY') throw new Error('RESPOSTA_BLOQUEADA: SAFETY');
            if (motivo === 'MAX_TOKENS') throw new Error('RESPOSTA_TRUNCADA: MAX_TOKENS');
            throw new Error(`RESPOSTA_VAZIA: ${motivo}`);
        }
        return texto;
    }
    else if (config.provider === 'openai') {
        const url = `https://api.openai.com/v1/chat/completions`;
        const body = {
            model: config.model,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        };
        const res = await axios.post(url, body, { headers: { 'Authorization': `Bearer ${config.key}` } });
        const texto = res.data?.choices?.[0]?.message?.content;
        if (!texto) throw new Error(`RESPOSTA_VAZIA: ${res.data?.choices?.[0]?.finish_reason || 'DESCONHECIDO'}`);
        return texto;
    }
    throw new Error(`Provedor ${config.provider} não suportado.`);
}

// ─── Sessões de paginação ────────────────────────────────────────────────────
// O collector do discord.js morria em 10 min. Como o comando é "manda e esquece",
// quem voltava horas depois encontrava os botões mortos e só a primeira página.
// A sessão agora vive num Map servido por um handler global do EventCheckout:
// sobrevive a qualquer tempo de espera. Não sobrevive a restart do bot — nesse
// caso o clique responde com um aviso claro em vez de não fazer nada.
const TTL_SESSAO_MS = 6 * 60 * 60 * 1000;
const BOTOES_SESSAO = new Set(['resumo:prev', 'resumo:next', 'resumo:super']);
// Tokens que pulam a confirmação de custo (ex.: rp!resumo 15/03 -y).
const TOKENS_PULAR = new Set(['-y', '--sim', 'sim', 'confirmar']);
// Tempo de espera do clique de confirmação antes de cancelar por segurança.
const TIMEOUT_CONFIRMACAO_MS = 120000;

interface SessaoResumo {
    autorId: string;
    paginas: EmbedBuilder[];
    paginaAtual: number;
    resumos: any[];
    blocoUnico: boolean;
    superJaGerado: boolean;
    interrompido: { titulo: string; detalhe: string } | null;
    aiConfig: any;
    criadoEm: number;
}

const sessoes = new Map<string, SessaoResumo>();

function limparSessoesVelhas(): void {
    const agora = Date.now();
    for (const [id, s] of sessoes) {
        if (agora - s.criadoEm > TTL_SESSAO_MS) sessoes.delete(id);
    }
}

function montarSuperEmbed(superData: any): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`🌟 SUPER RESUMO FINAL`)
        // arco_geral vai na description (4096) e não num field (1024):
        // "a história inteira" não cabe em field nenhum.
        .setDescription(truncar(superData.arco_geral || "Sem dados.", LIMITE_DESCRIPTION))
        .addFields({
            name: "✅ Conclusões e Desdobramentos",
            value: truncar(superData.conclusoes?.map((c: string) => `• ${c}`).join('\n') || "Sem detalhes.")
        });
}

function montarBotoes(s: SessaoResumo): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('resumo:prev').setLabel('◀ Anterior').setStyle(ButtonStyle.Secondary).setDisabled(s.paginaAtual === 0),
        new ButtonBuilder().setCustomId('resumo:next').setLabel('Próximo ▶').setStyle(ButtonStyle.Secondary).setDisabled(s.paginaAtual === s.paginas.length - 1)
    );
    // Some se já foi gerado (senão cada clique repetido era mais uma requisição)
    // ou se a IA já falhou de forma não recuperável (só levaria a outra falha).
    if (!s.superJaGerado && !s.interrompido) {
        const label = s.blocoUnico ? '🌟 Resumo Definitivo' : '🌟 Resumo Definitivo (usa 1 requisição)';
        row.addComponents(new ButtonBuilder().setCustomId('resumo:super').setLabel(label).setStyle(ButtonStyle.Success));
    }
    return row;
}

async function gerarSuperResumo(i: ButtonInteraction, sessao: SessaoResumo): Promise<void> {
    // Bloco único: o arco geral veio junto na primeira requisição. Custo zero.
    if (sessao.blocoUnico) {
        sessao.superJaGerado = true;
        sessao.paginas.push(montarSuperEmbed(sessao.resumos[0] || {}));
        sessao.paginaAtual = sessao.paginas.length - 1;
        await i.update({
            content: "✨ **Resumo Definitivo** (sem custo de requisição)",
            embeds: [sessao.paginas[sessao.paginaAtual]],
            components: [montarBotoes(sessao)]
        });
        return;
    }

    await i.update({ content: "⏳ **Compilando o Resumo Definitivo...** 🌟", components: [] });
    const msg = i.message;

    const supersummaryPrompt = `Sintetize estes resumos em uma narrativa única.\n${JSON.stringify(sessao.resumos)}\nResponda ESTRITAMENTE em JSON:\n{ "arco_geral": "História inteira", "conclusoes": ["A levou a B"] }`;

    let rawSuperResponse = "";
    let attempt = 1;
    let success = false;

    while (!success) {
        try {
            rawSuperResponse = await chamarIAResumo(supersummaryPrompt, sessao.aiConfig, SCHEMA_SUPER);
            success = true;
        } catch (error: any) {
            const falha = classificarErroIA(error);

            if (falha.tipo === 'sobrecarga' || falha.tipo === 'ratelimit') {
                const espera = falha.esperaSegundos ?? atrasoBackoff(attempt);
                const rotulo = falha.tipo === 'sobrecarga'
                    ? `🔥 **ERRO 503!** 🍟 Servidores lotados.`
                    : `⏱️ **Rate limit da IA.**`;
                console.warn(`[RESUME] Retry ${attempt} no super resumo (${falha.tipo}):`, falha.msg);
                await msg.edit({ content: `${rotulo}\n🔄 Tentando compilar o Resumo Definitivo em ${espera}s... (tentativa ${attempt})` }).catch(() => { });
                await new Promise(resolve => setTimeout(resolve, espera * 1000));
                attempt++;
                continue;
            }

            // As páginas já existem: nada é perdido aqui, só avisamos.
            const aviso = falha.tipo === 'quota'
                ? `🛑 **Cota diária da IA esgotada.** Ela reseta em ~${horasAteViradaQuota()}h (meia-noite no fuso do Pacífico).`
                : falha.tipo === 'bloqueio'
                    ? "⚠️ **A IA bloqueou o conteúdo do Super Resumo.**"
                    : "❌ Erro ao gerar o Super Resumo. (Falha na IA)";
            console.error(`[RESUME] Super resumo falhou (${falha.tipo}):`, falha.msg);
            await msg.edit({ content: `${aviso}\n📄 O resumo por blocos continua disponível abaixo.`, components: [montarBotoes(sessao)] }).catch(() => { });
            return;
        }
    }

    try {
        sessao.superJaGerado = true;
        sessao.paginas.push(montarSuperEmbed(parseAIJSON(rawSuperResponse)));
        sessao.paginaAtual = sessao.paginas.length - 1;
        await msg.edit({
            content: "✨ **Compilado com sucesso!**",
            embeds: [sessao.paginas[sessao.paginaAtual]],
            components: [montarBotoes(sessao)]
        });
    } catch (err) {
        console.error("Erro no Parse do Super Resumo:", err);
        await msg.edit({ content: "❌ Erro ao montar o Super Resumo. (Falha de leitura do JSON)", components: [montarBotoes(sessao)] }).catch(() => { });
    }
}

async function handleBotaoResumo(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;
    if (!BOTOES_SESSAO.has(interaction.customId)) return;

    const i = interaction as ButtonInteraction;
    const sessao = sessoes.get(i.message.id);

    // Restart do bot ou TTL vencido: avisa em vez de simplesmente não responder.
    if (!sessao) {
        await i.reply({
            content: "⌛ Este resumo não está mais na memória do bot (ele provavelmente reiniciou). Roda `rp!resumo` de novo.",
            flags: MessageFlags.Ephemeral
        }).catch(() => { });
        await i.message.edit({ components: [] }).catch(() => { });
        return;
    }

    if (i.user.id !== sessao.autorId) {
        await i.reply({ content: "❌ Apenas quem pediu o resumo pode usar os botões.", flags: MessageFlags.Ephemeral }).catch(() => { });
        return;
    }

    if (i.customId === 'resumo:prev' || i.customId === 'resumo:next') {
        const destino = sessao.paginaAtual + (i.customId === 'resumo:next' ? 1 : -1);
        sessao.paginaAtual = Math.max(0, Math.min(destino, sessao.paginas.length - 1));
        await i.update({ embeds: [sessao.paginas[sessao.paginaAtual]], components: [montarBotoes(sessao)] });
        return;
    }

    await gerarSuperResumo(i, sessao);
}

// ─── Auto-inscrição no EventCheckout ─────────────────────────────────────────
// Handler global de paginação: substitui o collector por sessão, que morria em
// 10 minutos. Ignora qualquer customId que não seja dos botões do resumo.
EventCheckout.onInteractionCreate('resumo:paginacao', handleBotaoResumo);

export const command: Command = {
    name: "resume",
    description: "Cria resumos em blocos categorizados de longos períodos de RP.",
    aliases: ["resumo", "recap"],
    execute: async (message: Message, args: string[]) => {

        const aiConfig = await getGuildAIConfig(message.guild!.id);
        if (!aiConfig) return message.reply("❌ **Erro:** Nenhuma IA está configurada para este servidor.");

        let targetChannel = message.channel as TextChannel;
        let argsSemCanal = args;

        if (message.mentions.channels.first()) {
            targetChannel = message.mentions.channels.first() as TextChannel;
            argsSemCanal = args.filter(a => !a.startsWith('<#'));
        }

        // Escape hatch da confirmação de custo: preserva o fluxo "manda e esquece"
        // em períodos grandes, onde a confirmação travaria esperando um clique.
        const pularConfirmacao = argsSemCanal.some(a => TOKENS_PULAR.has(a.toLowerCase()));
        argsSemCanal = argsSemCanal.filter(a => !TOKENS_PULAR.has(a.toLowerCase()));

        let endDate = new Date();
        let startDate = new Date(endDate.getTime() - (3 * 60 * 60 * 1000));

        const rawDateString = argsSemCanal.join(" ");

        if (rawDateString.includes("->")) {
            const [startStr, endStr] = rawDateString.split("->");
            const parsedStart = parseCustomDate(startStr);
            const parsedEnd = parseCustomDate(endStr);
            if (parsedStart) startDate = parsedStart;
            if (parsedEnd) endDate = parsedEnd;
            else if (parsedStart) { endDate = new Date(parsedStart); endDate.setHours(23, 59, 59); }
        } else if (rawDateString.trim() !== "") {
            const parsedDay = parseCustomDate(rawDateString);
            if (parsedDay) {
                startDate = new Date(parsedDay); startDate.setHours(0, 0, 0);
                endDate = new Date(parsedDay); endDate.setHours(23, 59, 59);
            }
        }

        if (startDate > endDate) return message.reply("❌ A data de início não pode ser depois da data de fim.");

        const loadMsg = await message.reply(`⏳ **Puxando os arquivos da Akáshica...**`);

        try {
            const startSnowflake = dateToSnowflake(startDate);
            const endSnowflake = dateToSnowflake(endDate);

            let messages: Message[] = [];
            let lastId: string | undefined = endSnowflake;
            let keepFetching = true;

            while (keepFetching && messages.length < MAX_MENSAGENS) {
                const fetched = await targetChannel.messages.fetch({ limit: 100, before: lastId });
                if (fetched.size === 0) break;

                for (const [id, msg] of fetched) {
                    if (BigInt(id) < BigInt(startSnowflake)) { keepFetching = false; break; }
                    if (!msg.content.startsWith("rp!") && !msg.author.bot && msg.content.trim() !== "") {
                        messages.push(msg);
                    } else if (msg.webhookId) {
                        messages.push(msg);
                    }
                }
                lastId = fetched.last()?.id;
            }

            if (messages.length === 0) return loadMsg.edit("📭 Nenhuma mensagem válida de RP encontrada neste período.");

            messages.reverse();

            // Bateu no teto de mensagens: o período pedido é maior do que foi lido.
            // Antes isso era silencioso; agora o usuário sabe que o resumo é parcial.
            const atingiuTetoMensagens = messages.length >= MAX_MENSAGENS;

            // Fatiamento por CARACTERES, não por contagem de mensagens. O modelo tem
            // contexto de sobra; o gargalo é requisição/dia. Na prática isto resulta
            // em um bloco só — uma requisição por resumo.
            const linhas = messages.map(m => {
                const hora = m.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                return `[${hora}] ${m.author.username}: ${m.content}`;
            });

            const chunks: Message[][] = [];
            const chunkLogs: string[] = [];
            let blocoAtual: Message[] = [];
            let linhasAtuais: string[] = [];
            let tamanhoAtual = 0;

            for (let i = 0; i < messages.length; i++) {
                const linha = linhas[i];
                if (blocoAtual.length > 0 && tamanhoAtual + linha.length + 1 > MAX_CHARS_POR_BLOCO) {
                    chunks.push(blocoAtual);
                    chunkLogs.push(linhasAtuais.join("\n"));
                    blocoAtual = [];
                    linhasAtuais = [];
                    tamanhoAtual = 0;
                }
                blocoAtual.push(messages[i]);
                linhasAtuais.push(linha);
                tamanhoAtual += linha.length + 1;
            }
            if (blocoAtual.length > 0) {
                chunks.push(blocoAtual);
                chunkLogs.push(linhasAtuais.join("\n"));
            }

            // Bloco único: pedimos o arco geral na MESMA requisição, então o
            // "Resumo Definitivo" sai de graça, sem segunda chamada.
            const blocoUnico = chunks.length === 1;

            // ─── Preview de custo ────────────────────────────────────────────
            // Com 1 bloco não há decisão a tomar (é o mínimo possível), então não
            // atrapalha o "manda e esquece". Acima disso, pergunta — é onde vale a
            // pena o usuário reduzir o intervalo em vez de queimar a cota.
            if (chunks.length > 1 && !pularConfirmacao) {
                const previa = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle("💸 Confirmação de custo")
                    .setDescription(
                        `Encontrei **${messages.length} mensagens** no período pedido.\n\n` +
                        `Resumir isso custa **${chunks.length} requisições** da cota da IA` +
                        ` (+1 se você usar o Resumo Definitivo depois).\n\n` +
                        `Um intervalo menor custa menos. Quer seguir?`
                    )
                    .setFooter({ text: `Dica: adicione "-y" ao comando para pular esta confirmação.` });

                await loadMsg.edit({
                    content: "",
                    embeds: [previa],
                    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder().setCustomId('resumoConf:ok').setLabel(`Gerar (${chunks.length} requisições)`).setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('resumoConf:cancelar').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
                    )]
                });

                try {
                    const resposta = await loadMsg.awaitMessageComponent({
                        componentType: ComponentType.Button,
                        filter: (i) => i.user.id === message.author.id && i.customId.startsWith('resumoConf:'),
                        time: TIMEOUT_CONFIRMACAO_MS
                    });

                    if (resposta.customId === 'resumoConf:cancelar') {
                        await resposta.update({ content: "❌ Cancelado. Nenhuma requisição foi usada.", embeds: [], components: [] });
                        return;
                    }
                    await resposta.update({ content: "⏳ Confirmado, começando...", embeds: [], components: [] });
                } catch {
                    // Ninguém clicou: cancelar é o padrão seguro para a cota.
                    await loadMsg.edit({
                        content: "⌛ Confirmação expirou — nenhuma requisição foi usada.\n💡 Rode com `-y` no fim do comando para pular a confirmação e deixar o bot trabalhando sozinho.",
                        embeds: [],
                        components: []
                    }).catch(() => { });
                    return;
                }
            }

            let allSummariesData: any[] = [];
            let estimatedTimeText = "Calculando...";
            // Preenchido quando insistir não adianta (cota, bloqueio, erro desconhecido).
            // Interrompe o loop mas preserva os blocos já processados — requisição paga
            // nunca mais é descartada.
            let interrompido: { titulo: string; detalhe: string } | null = null;

            for (let i = 0; i < chunks.length; i++) {
                await loadMsg.edit(blocoUnico
                    ? `🧠 **Lendo ${messages.length} mensagens numa requisição só...** ⏳`
                    : `🧠 **Processando Bloco ${i + 1} de ${chunks.length}...** ⏳ ${estimatedTimeText}`);

                const startTimeChunk = Date.now();
                const chunkLog = chunkLogs[i];

                // Sem substring(): o bloco já foi dimensionado para caber inteiro.
                const promptJSON = blocoUnico
                    ? `Analise este log de RP e produza um resumo completo do período.
Responda ESTRITAMENTE em JSON com as chaves abaixo:
- "topicos": lista de assuntos abordados (strings curtas)
- "sintese": o que aconteceu, em 1 parágrafo
- "participantes": uma string por personagem, no formato "Nome fez X"
- "arco_geral": a narrativa completa do período, em prosa corrida
- "conclusoes": desdobramentos, no formato "A levou a B"
Log:\n${chunkLog}`
                    : `Analise este log de RP. Responda ESTRITAMENTE em JSON:
{ "topicos": ["assunto 1"], "sintese": "O que aconteceu (1 parágrafo)", "participantes": ["A fez algo"] }
Log:\n${chunkLog}`;

                let rawAIResponse = "";
                let attempt = 1;
                let success = false;

                // LOOP DE TENTATIVAS PARA O BLOCO (Contra Erro 503)
                while (!success) {
                    try {
                        rawAIResponse = await chamarIAResumo(promptJSON, aiConfig, blocoUnico ? SCHEMA_COMPLETO : SCHEMA_BLOCO);
                        success = true;
                    } catch (error: any) {
                        const falha = classificarErroIA(error);

                        // Transitório (503 / rate limit): retry infinito, com backoff.
                        if (falha.tipo === 'sobrecarga' || falha.tipo === 'ratelimit') {
                            const espera = falha.esperaSegundos ?? atrasoBackoff(attempt);
                            const rotulo = falha.tipo === 'sobrecarga'
                                ? `🔥 **Servidores lotados (Erro 503)!** 🍟`
                                : `⏱️ **Rate limit da IA** (muita requisição por minuto).`;
                            console.warn(`[RESUME] Retry ${attempt} na parte ${i + 1} (${falha.tipo}):`, falha.msg);
                            await loadMsg.edit(`${rotulo}\n🔄 Tentando a parte ${i + 1} de novo em ${espera}s... (tentativa ${attempt})`).catch(() => { });
                            await new Promise(resolve => setTimeout(resolve, espera * 1000));
                            attempt++;
                            continue;
                        }

                        // Insistir não resolve. Para o loop, mas guarda o motivo — o que
                        // já foi processado será renderizado como resumo parcial.
                        if (falha.tipo === 'quota') {
                            interrompido = {
                                titulo: "🛑 **Cota diária da IA esgotada.**",
                                detalhe: `Ela reseta em ~${horasAteViradaQuota()}h (meia-noite no fuso do Pacífico).`
                            };
                        } else if (falha.tipo === 'bloqueio') {
                            interrompido = {
                                titulo: "⚠️ **A IA bloqueou o conteúdo.**",
                                detalhe: "Algo no texto passou totalmente dos limites dela."
                            };
                        } else {
                            console.error(`[RESUME] Falha não recuperável na parte ${i + 1}:`, falha.msg);
                            interrompido = {
                                titulo: "❌ **Falha na IA.**",
                                detalhe: truncar(falha.msg, 300)
                            };
                        }
                        break;
                    }
                }

                if (interrompido) break;

                allSummariesData.push(parseAIJSON(rawAIResponse));

                if (i === 0 && chunks.length > 1) {
                    const timeTaken = Date.now() - startTimeChunk;
                    const etaMs = timeTaken * (chunks.length - 1);
                    const etaSec = Math.ceil(etaMs / 1000);
                    estimatedTimeText = etaSec > 60 ? `(~${Math.ceil(etaSec / 60)} min restantes)` : `(~${etaSec} seg restantes)`;
                }
            }

            // Só é erro de verdade se nem um bloco saiu. Com qualquer bloco pronto,
            // entregamos o parcial em vez de jogar a requisição paga fora.
            if (allSummariesData.length === 0) {
                return loadMsg.edit(interrompido
                    ? `${interrompido.titulo}\n${interrompido.detalhe}`
                    : "❌ A IA não retornou nada utilizável.");
            }

            await loadMsg.edit("✨ **Organizando as páginas...**");

            const pages: EmbedBuilder[] = [];
            const MAX_ITEMS_PER_PAGE = 30; 

            const allTopics = [...new Set(allSummariesData.flatMap(d => d.topicos || []).filter(Boolean))];
            if (allTopics.length === 0) {
                pages.push(new EmbedBuilder().setTitle("📌 Todos os Tópicos Abordados").setColor(0x00FF00).setDescription("Nenhum tópico encontrado."));
            } else {
                for (let i = 0; i < allTopics.length; i += MAX_ITEMS_PER_PAGE) {
                    const chunk = allTopics.slice(i, i + MAX_ITEMS_PER_PAGE);
                    const title = allTopics.length > MAX_ITEMS_PER_PAGE ? `📌 Todos os Tópicos Abordados (Parte ${Math.floor(i / MAX_ITEMS_PER_PAGE) + 1})` : "📌 Todos os Tópicos Abordados";

                    pages.push(new EmbedBuilder()
                        .setTitle(title)
                        .setColor(0x00FF00)
                        .setDescription(chunk.map(t => `• ${t}`).join('\n').substring(0, 4000))
                    );
                }
            }

            const allActions = allSummariesData.flatMap(d => d.participantes || []).filter(Boolean);
            if (allActions.length === 0) {
                pages.push(new EmbedBuilder().setTitle("👥 Ações e Participantes").setColor(0xFFA500).setDescription("Nenhuma ação registada."));
            } else {
                for (let i = 0; i < allActions.length; i += MAX_ITEMS_PER_PAGE) {
                    const chunk = allActions.slice(i, i + MAX_ITEMS_PER_PAGE);
                    const title = allActions.length > MAX_ITEMS_PER_PAGE ? `👥 Ações e Participantes (Parte ${Math.floor(i / MAX_ITEMS_PER_PAGE) + 1})` : "👥 Ações e Participantes";

                    pages.push(new EmbedBuilder()
                        .setTitle(title)
                        .setColor(0xFFA500)
                        .setDescription(chunk.map(a => `• ${a}`).join('\n').substring(0, 4000))
                    );
                }
            }

            let timelineEmbed = new EmbedBuilder().setTitle("📜 Linha do Tempo (Eventos)").setColor(0x5865F2);
            let fieldCount = 0;
            let embedChars = 0;

            for (let i = 0; i < allSummariesData.length; i++) {
                const data = allSummariesData[i];
                const startMsg = chunks[i][0];
                const endMsg = chunks[i][chunks[i].length - 1];

                const startStr = `${startMsg.createdAt.toLocaleDateString('pt-BR')} às ${startMsg.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                const endStr = `${endMsg.createdAt.toLocaleDateString('pt-BR')} às ${endMsg.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                const timeRange = startStr === endStr ? startStr : `${startStr} até ${endStr}`;

                const nome = `Parte ${i + 1} (${timeRange})`;
                // Sem os truncar() abaixo um resumo longo estoura o limite do Discord
                // e derruba o comando DEPOIS de as requisições já terem sido pagas.
                const valor = truncar(data.sintese || "Sem dados.");

                // Quebra a página por caracteres também: 15 fields cheios passam
                // fácil dos 6000 do embed inteiro.
                if (fieldCount > 0 && embedChars + nome.length + valor.length > LIMITE_EMBED - 500) {
                    pages.push(timelineEmbed);
                    timelineEmbed = new EmbedBuilder().setTitle("📜 Linha do Tempo (Cont.)").setColor(0x5865F2);
                    fieldCount = 0;
                    embedChars = 0;
                }

                timelineEmbed.addFields({ name: nome, value: valor });
                fieldCount++;
                embedChars += nome.length + valor.length;

                if (fieldCount === 15 || i === allSummariesData.length - 1) {
                    pages.push(timelineEmbed);
                    timelineEmbed = new EmbedBuilder().setTitle("📜 Linha do Tempo (Cont.)").setColor(0x5865F2);
                    fieldCount = 0;
                    embedChars = 0;
                }
            }

            const avisoTeto = atingiuTetoMensagens
                ? `
⚠️ O período pedido tem mais de ${MAX_MENSAGENS} mensagens — resumi apenas as ${MAX_MENSAGENS} mais recentes dele.`
                : "";

            const avisoParcial = interrompido
                ? `
${interrompido.titulo} ${interrompido.detalhe}
📄 **Resumo parcial:** ${allSummariesData.length} de ${chunks.length} blocos — o que já tinha sido processado está aqui.`
                : "";

            const cabecalho = interrompido ? "⚠️ **Análise interrompida.**" : "✅ **Análise Completa!**";

            // A sessão é chaveada pelo id da mensagem, que loadMsg já tem — dá pra
            // registrar antes de editar e montar os botões numa tacada só.
            limparSessoesVelhas();
            const sessao: SessaoResumo = {
                autorId: message.author.id,
                paginas: pages,
                paginaAtual: 0,
                resumos: allSummariesData,
                blocoUnico,
                superJaGerado: false,
                interrompido,
                aiConfig,
                criadoEm: Date.now()
            };
            sessoes.set(loadMsg.id, sessao);

            await loadMsg.edit({
                content: `${cabecalho}${avisoParcial}${avisoTeto}`,
                embeds: [pages[0]],
                components: [montarBotoes(sessao)]
            });

        } catch (error: any) {
            console.error(error);
            const errorMsg = error.response?.data?.error?.message || error.message || error.toString();
            let errText = "❌ Erro ao puxar mensagens ou contatar a IA.";

            if (errorMsg.includes('PROMPT_BLOQUEADO') || errorMsg.includes('RESPOSTA_BLOQUEADA') ||
                (errorMsg.includes('GoogleGenerativeAI Error') && errorMsg.includes('was blocked'))) {
                errText = "⚠️ **Algo no teu texto passou totalmente dos limites e a IA não gostou. Toma cuidado aí.**";
            }
            else if (errorMsg.includes('RESPOSTA_TRUNCADA')) {
                errText = "✂️ **A IA ficou sem espaço pra responder.** O período é grande demais — tenta um intervalo menor.";
            }
            else if (errorMsg.includes('RESPOSTA_VAZIA')) {
                errText = `🕳️ **A IA respondeu vazio.** (${errorMsg}) Tenta de novo ou reduz o intervalo.`;
            }
            else if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('Quota')) {
                const limitMatch = errorMsg.match(/limit:\s*(\d+)/i);
                if (errorMsg.includes('Quota') || limitMatch) {
                    const limitAmount = limitMatch ? limitMatch[1] : "várias";
                    errText = `🛑 **ERRO! LIMITE ATINGIDO!** A IA estourou a cota de **${limitAmount}** requisições diárias.`;
                } else {
                    errText = `🔥 **CALMA AÍ!** A IA foi bloqueada por spam (Rate Limit). Tente novamente em instantes.`;
                }
            } else if (errorMsg.includes('503') || errorMsg.includes('Overloaded') || errorMsg.includes('high demand')) {
                errText = "🔥 **ERRO: ESTÃO FRITANDO OS SERVIDORES! 🍟** Alta demanda na IA do Google. Tente mais tarde.";
            }

            await loadMsg.edit(errText);
        }
    }
};