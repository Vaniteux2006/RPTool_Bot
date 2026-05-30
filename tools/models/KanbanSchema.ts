import mongoose, { Schema, Document } from 'mongoose';
import 'dotenv/config';

// Segue o seu padrão de usar conexões separadas
const restanteConnection = mongoose.createConnection(process.env.DB_RESTANTE as string);

// ==========================================
// 1. TAREFAS (ITENS)
// ==========================================
export interface IKanbanItem extends Document {
    guildId: string;
    userId: string;
    shortId: string;
    title: string;
    status: 'TODO' | 'DOING' | 'DONE';
}

const kanbanItemSchema = new Schema<IKanbanItem>({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    shortId: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: String, required: true, enum: ['TODO', 'DOING', 'DONE'] }
});

// ==========================================
// 2. PAINEL FIXO (LIVE BOARD)
// ==========================================
export interface IKanbanPainel extends Document {
    guildId: string;
    channelId: string;
    messageId: string;
}

const kanbanPainelSchema = new Schema<IKanbanPainel>({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true }
});

// Exportando os Models já prontos para uso
export const KanbanItemModel = restanteConnection.models.KanbanItem || restanteConnection.model<IKanbanItem>('KanbanItem', kanbanItemSchema);
export const KanbanPainelModel = restanteConnection.models.KanbanPainel || restanteConnection.model<IKanbanPainel>('KanbanPainel', kanbanPainelSchema);