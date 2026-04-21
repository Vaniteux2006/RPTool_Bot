import { Schema, Document } from 'mongoose';
import { mainConnection } from '../database';
 
export interface IAutoroleConfig extends Document {
    guildId: string;
    autorole: string[];
}
 
const AutoroleSchema = new Schema<IAutoroleConfig>({
    guildId:  { type: String, required: true, unique: true },
    autorole: { type: [String], default: [] },
});
 
// Guarda de idempotência: evita "Cannot overwrite model once compiled"
export const AutoroleModel =
    mainConnection.models['AutoroleConfig'] ??
    mainConnection.model<IAutoroleConfig>('AutoroleConfig', AutoroleSchema);