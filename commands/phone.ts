import { SlashCommandBuilder, ChatInputCommandInteraction, Message, Client } from 'discord.js';
import { PhoneRegistryModel } from '../models/Outros'; 

interface PhoneServer {
    channelId: string;
    marker?: string;
    status: 'idle' | 'ringing' | 'connected' | 'voting';
    partnerId?: string; 
    groupVotes?: Set<string>; 
}

class PhoneSystem {
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
}

const phoneSystem = new PhoneSystem();

async function notifyServer(client: Client, channelId: string, text: string) {
    try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) await (channel as any).send(text);
    } catch (e) {}
}

export default {
    name: 'phone',
    description: 'Sistema de Telefone Inter-Servidores',
    data: new SlashCommandBuilder().setName('phone').setDescription('Telefone Inter-Servidores')
        .addSubcommand(sub => sub.setName('call').setDescription('Liga para um servidor').addStringOption(op => op.setName('alvo').setDescription('ID ou Nome do servidor').setRequired(true)))
        .addSubcommand(sub => sub.setName('register').setDescription('Instala o telefone neste canal').addStringOption(op => op.setName('nome').setDescription('Nome público do local').setRequired(false)))
        .addSubcommand(sub => sub.setName('accept').setDescription('Atende uma chamada'))
        .addSubcommand(sub => sub.setName('decline').setDescription('Recusa uma chamada'))
        .addSubcommand(sub => sub.setName('end').setDescription('Desliga a chamada')),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        const args = [sub]; 
        const alvo = interaction.options.getString('alvo') || interaction.options.getString('nome');
        if (alvo) args.push(alvo); 

        const fakeMessage: any = {
            content: `rp!phone ${args.join(' ')}`, author: interaction.user, guild: interaction.guild,
            channel: interaction.channel, client: interaction.client, 
            reply: async (payload: any) => interaction.replied || interaction.deferred ? interaction.followUp(payload) : interaction.reply(payload)
        };
        await this.execute(fakeMessage, args);
    },

    async execute(message: Message | any, args: string[]) {
        await phoneSystem.init();

        const action = args[0] ? args[0].toLowerCase() : null;
        const serverId = message.guild?.id;

        let data: any = {};
        try {
            switch (action) {
                case 'register':
                    const marker = args[1] ? args.slice(1).join(" ") : undefined;
                    data = await phoneSystem.register(serverId, message.channel.id, marker); 
                    break;
                case 'off':
                    data = await phoneSystem.turn_off(serverId); 
                    break;
                case 'call':
                    data = phoneSystem.call(serverId, args.slice(1).join(" "));
                    break;
                case 'accept':
                    data = phoneSystem.accept(serverId);
                    break;
                case 'decline':
                    data = phoneSystem.decline(serverId);
                    break;
                case 'end':
                    data = phoneSystem.end_call(serverId);
                    break;
                default:
                    return message.reply("📱 **Telefone:** Use `register, call, accept, decline, end`.");
            }

            if (data.error) return message.reply(`❌ **Erro:** ${data.error}`);
            
            if (data.status === 'ringing') {
                message.reply(`📞 **Chamando...**`);
                if (data.target_channel) notifyServer(message.client, data.target_channel, `📞 **TRIM TRIM!** O servidor **${message.guild.name}** está ligando!\nDigite \`/phone accept\` para atender.`);
            }
            else if (data.status === 'connected') {
                message.reply("🟢 **Ligação Conectada!**");
                if (data.partners) data.partners.forEach((cId: string) => notifyServer(message.client, cId, `🟢 **${message.guild.name}** atendeu!`));
            }
            else if (data.status === 'ended') {
                message.reply("🔴 **Ligação Encerrada.**");
                if (data.notify_channels) data.notify_channels.forEach((cId: string) => notifyServer(message.client, cId, `🔴 **${message.guild.name}** desligou.`));
            }
            else if (data.status === 'declined') {
                message.reply("🚫 **Chamada Recusada.**");
                if (data.target_channel) notifyServer(message.client, data.target_channel, `🚫 **${message.guild.name}** recusou a chamada.`);
            }
            else if (data.msg) message.reply(`📱 ${data.msg}`);

        } catch (e) {
            console.error(e);
            message.reply("❌ Erro interno no telefone.");
        }
    },

    async processPhoneMessage(message: Message): Promise<boolean> {
        await phoneSystem.init(); 
        if (message.author.bot || message.content.startsWith('rp!') || message.content.startsWith('/')) return false;
        if (!message.guild) return false;

        const result = phoneSystem.transmit(message.guild.id, message.channel.id, message.content, message.author.username, message.guild.name);
        if (result && result.targets) {
            result.targets.forEach((cId: string) => notifyServer(message.client, cId, result.msg));
            return true;
        }
        return false;
    }
};