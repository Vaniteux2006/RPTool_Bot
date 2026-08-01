// RPTool/tools/models/ChessSchema.ts
// ─── Partidas de xadrez em andamento ──────────────────────────────────────────
// Antes as partidas viviam só num Map na RAM — qualquer restart do bot (deploy,
// crash) apagava tudo e dava "Partida não encontrada". Agora persistem no Mongo
// e expiram sozinhas 1h após o último lance, via índice TTL em `updatedAt`.
import mongoose, { Schema, Document } from 'mongoose';
import { getConnection } from '../database';
import 'dotenv/config';

const restanteConnection = getConnection(process.env.DB_RESTANTE as string, 'Geral');

export interface IChessGame extends Document {
    gameId: string;
    channelId: string;
    white: string;          // userId ou 'bot'
    black: string;          // userId ou 'bot'
    vsBot: boolean;
    difficulty: 'easy' | 'medium' | 'hard';
    fen: string;
    history: string[];
    lastMoveUci?: string | null;
    lastEval?: string | null;
    drawOfferedBy?: string | null;
    createdAt: number;
    updatedAt: Date;
}

const chessGameSchema = new Schema<IChessGame>({
    gameId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    white: { type: String, required: true },
    black: { type: String, required: true },
    vsBot: { type: Boolean, default: false },
    difficulty: { type: String, default: 'medium' },
    fen: { type: String, required: true },
    history: { type: [String], default: [] },
    lastMoveUci: { type: String, default: null },
    lastEval: { type: String, default: null },
    drawOfferedBy: { type: String, default: null },
    createdAt: { type: Number, default: () => Date.now() },
    // TTL: o documento é removido 3600s (1h) depois de `updatedAt`. Atualizamos
    // `updatedAt` a cada jogada, então o relógio de expiração reinicia a cada lance.
    updatedAt: { type: Date, default: () => new Date(), expires: 3600 },
});

export const ChessGameModel =
    restanteConnection.models.ChessGame || restanteConnection.model<IChessGame>('ChessGame', chessGameSchema);
