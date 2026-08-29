// RPTool/supercommands/resumo/types.ts
import { EmbedBuilder } from 'discord.js';

// Contrato com o sistema de chaves (`rp!token` → tools/utils/tokenHelper).
export type { AIConfig } from '../../tools/utils/tokenHelper';

// Saída da IA por bloco. arco_geral/conclusoes só vêm quando é bloco único
// (aí o "Resumo Definitivo" sai de graça, na mesma requisição).
export interface BlocoResumo {
    topicos?: string[];
    sintese?: string;
    participantes?: string[];
    arco_geral?: string;
    conclusoes?: string[];
}

// Motivo de ter parado antes da hora. Preenchido quando insistir não adianta
// (cota, bloqueio, erro desconhecido) — o que já foi processado é preservado.
export interface Interrupcao {
    titulo: string;
    detalhe: string;
}

export interface SessaoResumo {
    autorId: string;
    // Guardamos o guildId, NUNCA o AIConfig: a sessão vive até 6h e a chave pode
    // ser trocada/removida no `rp!token` nesse meio tempo. O Resumo Definitivo
    // resolve a chave de novo na hora do clique (e a chave não fica pendurada
    // em memória por horas).
    guildId: string;
    paginas: EmbedBuilder[];
    paginaAtual: number;
    resumos: BlocoResumo[];
    blocoUnico: boolean;
    superJaGerado: boolean;
    interrompido: Interrupcao | null;
    criadoEm: number;
}
