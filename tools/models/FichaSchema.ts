// RPTool/tools/models/FichaSchema.ts
import mongoose, { Schema, Document } from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const fichaConnection = mongoose.createConnection(process.env.DB_FICHA as string);

export interface ITemplate extends Document {
    guildId:        string;
    rawText:        string;
    fields:         any[];
    checkChannelId: string | null;  // rp!ficha check #canal  → aprovação
    showChannelId:  string | null;  // rp!ficha show  #canal  → exibição pública
    ocPrefixLabel:  string | null;  // label do campo {prefix} no template
}

const TemplateSchema = new Schema({
    guildId:        { type: String, required: true, unique: true },
    rawText:        { type: String, default: '' },
    fields:         { type: Array,  default: [] },
    checkChannelId: { type: String, default: null },
    showChannelId:  { type: String, default: null },
    ocPrefixLabel:  { type: String, default: null },
});

export interface IFicha extends Document {
    guildId:       string;
    userId:        string;
    characterName: string;
    status:        'pending' | 'approved' | 'rejected';
    data:          Record<string, any>;
    avatar:        string;
    integrateOC:   boolean;       // veio de rp!ficha new +oc?
    showMessageId: string | null; // ID da mensagem no showChannel após decisão
}

const FichaSchema = new Schema({
    guildId:       { type: String,  required: true },
    userId:        { type: String,  required: true },
    characterName: { type: String,  required: true },
    status:        { type: String,  enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    data:          { type: Schema.Types.Mixed, default: {} },
    avatar:        { type: String,  default: '' },
    integrateOC:   { type: Boolean, default: false },
    showMessageId: { type: String,  default: null },
});

export const TemplateModel = fichaConnection.model<ITemplate>('Template', TemplateSchema);
export const FichaModel    = fichaConnection.model<IFicha>('Ficha', FichaSchema);