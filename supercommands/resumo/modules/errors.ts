// RPTool/supercommands/resumo/modules/errors.ts
// ─── Classificação de falha da IA ────────────────────────────────────────────
// O classificador foi promovido para tools/utils/ai/errors.ts (v1.6) para que
// rp!ai, rp!resenha e a IA de OC tratem 429/503/quota igual ao resumo.
// Este arquivo é só um ponteiro de compatibilidade para os módulos do resumo.
export {
    TipoFalha,
    FalhaIA,
    ESCADA_BACKOFF,
    atrasoBackoff,
    classificarErroIA,
    horasAteViradaQuota,
    rotuloRetry,
    motivoInterrupcao,
    descreverErroFatal,
} from '../../../tools/utils/ai/errors';
