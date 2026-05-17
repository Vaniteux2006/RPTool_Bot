// RPTool/tools/models/LogConfig.ts
// Schema de configuração do sistema de logs por servidor
import { Schema, Document } from 'mongoose';
import { mainConnection } from '../database';
import { LogCategory } from '../../supercommands/logs/index';

export interface ILogConfig extends Document {
    guildId:    string;
    channelId:  string | null;       // canal onde os logs são enviados
    enabled:    boolean;             // liga/desliga sem perder o canal
    categories: LogCategory[];       // categorias ativas (todas por padrão)
    updatedAt:  Date;
}

const LogConfigSchema = new Schema<ILogConfig>({
    guildId:    { type: String, required: true, unique: true },
    channelId:  { type: String, default: null },
    enabled:    { type: Boolean, default: false },
    categories: {
        type:    [String],
        default: [
            // Categorias ativas por padrão (excluem as de alto volume)
            'members', 'messages', 'channels', 'roles',
            'moderation', 'voice', 'invites', 'integrations',
            'expressions', 'threads', 'scheduled', 'automod',
        ],
    },
    updatedAt: { type: Date, default: Date.now },
});

// Atualiza updatedAt automaticamente em qualquer save
LogConfigSchema.pre('save', function () { this.updatedAt = new Date(); });

export const LogModel =
    mainConnection.models['LogConfig'] ??
    mainConnection.model<ILogConfig>('LogConfig', LogConfigSchema);