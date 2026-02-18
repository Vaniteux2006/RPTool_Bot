import mongoose, { Schema, Document } from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const generalConnection = mongoose.createConnection(process.env.DB_FICHA as string);

export interface IReactionRole extends Document {
    guildId: string;
    channelId: string;
    messageId: string;
    emoji: string;
    roleId: string;
}

const ReactionRoleSchema = new Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    emoji: { type: String, required: true },
    roleId: { type: String, required: true }
});

export const ReactionRoleModel = generalConnection.model<IReactionRole>('ReactionRole', ReactionRoleSchema);