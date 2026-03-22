import mongoose, { Schema, Document } from 'mongoose';

// Usamos a mesma conexão de configurações do servidor para não misturar com as fichas/OCs
const configConnection = mongoose.createConnection(process.env.DB_RESTANTE as string);

export interface IAutoroleConfig extends Document {
    guildId: string;
    autorole: string[];
}

const AutoroleSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    autorole: { type: [String], default: [] }
});

export const AutoroleModel = configConnection.models.AutoroleConfig || configConnection.model<IAutoroleConfig>('AutoroleConfig', AutoroleSchema);