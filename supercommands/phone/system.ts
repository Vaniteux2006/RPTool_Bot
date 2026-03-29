// RPTool/supercommands/phone/system.ts
import { Message, Client } from 'discord.js';
// Ajuste o caminho dos models dependendo de onde a pasta supercommands ficar
import { PhoneRegistryModel } from '../../tools/models/Outros'; 

export interface PhoneServer {
    channelId: string;
    marker?: string;
    status: 'idle' | 'ringing' | 'connected' | 'voting';
    partnerId?: string; 
    groupVotes?: Set<string>; 
}

export class PhoneSystem {
    private servers: Map<string, PhoneServer> = new Map();
    public isInitialized = false;

    async init() {
        if (this.isInitialized) return;
        const regs = await PhoneRegistryModel.find({});
        for (const reg of regs) {
            this.servers.set(reg.serverId, { channelId: reg.channelId, marker: reg.marker, status: 'idle' });
        }
        console.log(`📞 [Telefone] ${regs.length} linhas ativas carregadas do MongoDB.`);
        this.isInitialized = true;
    }

    async register(serverId: string, channelId: string, marker?: string) {
        this.servers.set(serverId, { channelId, marker, status: 'idle' });
        await PhoneRegistryModel.findOneAndUpdate(
            { serverId }, { serverId, channelId, marker }, { upsert: true }
        );
        return { msg: "Telefone instalado e sincronizado na nuvem com sucesso!" };
    }

    async turn_off(serverId: string) {
        if (this.servers.has(serverId)) {
            this.servers.delete(serverId);
            await PhoneRegistryModel.deleteOne({ serverId });
            return { msg: "Telefone desinstalado permanentemente." };
        }
        return { error: "Não há telefone registrado aqui." };
    }

    call(originId: string, targetIdentifier: string) {
        const origin = this.servers.get(originId);
        if (!origin) return { error: "Você precisa dar /phone register primeiro." };
        if (origin.status !== 'idle') return { error: "Linha ocupada." };

        let targetId: string | undefined;
        let target: PhoneServer | undefined;

        if (this.servers.has(targetIdentifier)) {
            targetId = targetIdentifier;
            target = this.servers.get(targetId);
        } else {
            for (const [sId, sData] of this.servers.entries()) {
                if (sData.marker && sData.marker.toLowerCase() === targetIdentifier.toLowerCase()) {
                    targetId = sId; target = sData; break;
                }
            }
        }

        if (!target || !targetId) return { error: "Servidor não encontrado ou sem telefone." };
        if (targetId === originId) return { error: "Você não pode ligar para si mesmo." };
        if (target.status !== 'idle') return { status: 'busy', msg: "O número discado está ocupado." };

        origin.status = 'ringing'; origin.partnerId = targetId;
        target.status = 'ringing'; target.partnerId = originId;

        return { status: 'ringing', target_channel: target.channelId };
    }

    accept(serverId: string) {
        const me = this.servers.get(serverId);
        if (!me || me.status !== 'ringing' || !me.partnerId) return { error: "Ninguém está te ligando." };

        const partner = this.servers.get(me.partnerId);
        if (!partner) {
            me.status = 'idle'; return { error: "A chamada caiu." };
        }
        me.status = 'connected'; partner.status = 'connected';
        return { status: 'connected', partners: [partner.channelId] };
    }

    decline(serverId: string) {
        const me = this.servers.get(serverId);
        if (!me || me.status !== 'ringing' || !me.partnerId) return { error: "Nada para recusar." };

        const partner = this.servers.get(me.partnerId);
        me.status = 'idle'; me.partnerId = undefined;

        if (partner) {
            partner.status = 'idle'; partner.partnerId = undefined;
            return { status: 'declined', target_channel: partner.channelId };
        }
        return { msg: "Chamada recusada." };
    }

    end_call(serverId: string) {
        const me = this.servers.get(serverId);
        if (!me || me.status === 'idle') return { error: "O telefone está no gancho." };

        const partnerId = me.partnerId;
        const notifyList = [];
        me.status = 'idle'; me.partnerId = undefined;

        if (partnerId) {
            const partner = this.servers.get(partnerId);
            if (partner) {
                partner.status = 'idle'; partner.partnerId = undefined;
                notifyList.push(partner.channelId);
            }
        }
        return { status: 'ended', notify_channels: notifyList };
    }

    transmit(originId: string, originChannelId: string, content: string, user: string, serverName: string) {
        const me = this.servers.get(originId);
        if (!me || me.status !== 'connected' || !me.partnerId || me.channelId !== originChannelId) return null;

        const partner = this.servers.get(me.partnerId);
        if (!partner) return null;
        return { msg: `📞 **[${serverName}] ${user}:** ${content}`, targets: [partner.channelId] };
    }

    // A função principal que escuta as mensagens e envia pros parceiros
    async processPhoneMessage(message: Message): Promise<boolean> {
        await this.init(); 
        if (message.author.bot || message.content.startsWith('rp!') || message.content.startsWith('/')) return false;
        if (!message.guild) return false;

        const result = this.transmit(message.guild.id, message.channel.id, message.content, message.author.username, message.guild.name);
        if (result && result.targets) {
            result.targets.forEach((cId: string) => notifyServer(message.client, cId, result.msg));
            return true; // Retorna true para avisar o client.on que a mensagem foi interceptada pelo telefone
        }
        return false;
    }
}

// Utilitário para notificar os canais (exportado pra ser usado nos comandos de atender/ligar se precisar)
export async function notifyServer(client: Client, channelId: string, text: string) {
    try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) await (channel as any).send(text);
    } catch (e) {
        // Ignora silenciosamente se não tiver permissão
    }
}

// Exporta a instância única do motor
export const phoneSystem = new PhoneSystem();