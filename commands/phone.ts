import { SlashCommandBuilder, ChatInputCommandInteraction, Message, Client } from 'discord.js';

// --- LÓGICA DO SISTEMA DE TELEFONE (Antigo phone_logic.ts) ---

interface PhoneServer {
    channelId: string;
    marker?: string;
    status: 'idle' | 'ringing' | 'connected' | 'voting';
    partnerId?: string; // ID do servidor com quem está falando
    groupVotes?: Set<string>; // IDs de quem votou sim
}

class PhoneSystem {
    // Armazena estado: ServerID -> Dados
    private servers: Map<string, PhoneServer> = new Map();

    register(serverId: string, channelId: string, marker?: string) {
        this.servers.set(serverId, {
            channelId,
            marker,
            status: 'idle'
        });
        return { msg: "Telefone instalado com sucesso!" };
    }

    turn_off(serverId: string) {
        if (this.servers.has(serverId)) {
            this.servers.delete(serverId);
            return { msg: "Telefone desinstalado/desligado." };
        }
        return { error: "Não há telefone registrado aqui." };
    }

    call(originId: string, targetIdentifier: string) {
        const origin = this.servers.get(originId);
        if (!origin) return { error: "Você precisa dar /phone register primeiro." };
        if (origin.status !== 'idle') return { error: "Linha ocupada." };

        // Busca alvo por ID ou Nome (Marker)
        let targetId: string | undefined;
        let target: PhoneServer | undefined;

        // Tenta achar por ID exato
        if (this.servers.has(targetIdentifier)) {
            targetId = targetIdentifier;
            target = this.servers.get(targetId);
        } 
        // Se não, procura pelo nome/marker
        else {
            for (const [sId, sData] of this.servers.entries()) {
                if (sData.marker && sData.marker.toLowerCase() === targetIdentifier.toLowerCase()) {
                    targetId = sId;
                    target = sData;
                    break;
                }
            }
        }

        if (!target || !targetId) return { error: "Servidor não encontrado ou sem telefone." };
        if (targetId === originId) return { error: "Você não pode ligar para si mesmo." };
        if (target.status !== 'idle') return { status: 'busy', msg: "O número discado está ocupado." };

        // Inicia a chamada
        origin.status = 'ringing';
        origin.partnerId = targetId;
        
        target.status = 'ringing';
        target.partnerId = originId;

        return { 
            status: 'ringing', 
            target_channel: target.channelId 
        };
    }

    accept(serverId: string) {
        const me = this.servers.get(serverId);
        if (!me || me.status !== 'ringing' || !me.partnerId) {
            return { error: "Ninguém está te ligando." };
        }

        const partner = this.servers.get(me.partnerId);
        if (!partner) {
            me.status = 'idle';
            return { error: "A chamada caiu." };
        }

        me.status = 'connected';
        partner.status = 'connected';

        return { 
            status: 'connected', 
            partners: [partner.channelId] // Lista de canais para avisar
        };
    }

    decline(serverId: string) {
        const me = this.servers.get(serverId);
        if (!me || me.status !== 'ringing' || !me.partnerId) return { error: "Nada para recusar." };

        const partnerId = me.partnerId;
        const partner = this.servers.get(partnerId);

        me.status = 'idle';
        me.partnerId = undefined;

        if (partner) {
            partner.status = 'idle';
            partner.partnerId = undefined;
            return { status: 'declined', target_channel: partner.channelId };
        }
        return { msg: "Chamada recusada." };
    }

    end_call(serverId: string) {
        const me = this.servers.get(serverId);
        if (!me || me.status === 'idle') return { error: "O telefone está no gancho." };

        const partnerId = me.partnerId;
        const notifyList = [];

        // Reseta eu
        me.status = 'idle';
        me.partnerId = undefined;

        // Reseta o parceiro
        if (partnerId) {
            const partner = this.servers.get(partnerId);
            if (partner) {
                partner.status = 'idle';
                partner.partnerId = undefined;
                notifyList.push(partner.channelId);
            }
        }

        return { status: 'ended', notify_channels: notifyList };
    }

    transmit(originId: string, originChannelId: string, content: string, user: string, serverName: string) {
        const me = this.servers.get(originId);
        
        // Valida se está conectado e se está falando do canal certo
        if (!me || me.status !== 'connected' || !me.partnerId || me.channelId !== originChannelId) {
            return null; // Ignora
        }

        const partner = this.servers.get(me.partnerId);
        if (!partner) return null;

        return {
            msg: `📞 **[${serverName}] ${user}:** ${content}`,
            targets: [partner.channelId]
        };
    }

    request_group_join(requesterId: string, targetIdentifier: string) {
        return { error: "Chamadas em grupo em manutenção na versão TS." };
    }
}

// Instância Local (Singleton do Arquivo)
const phoneSystem = new PhoneSystem();

// --- FUNÇÕES AUXILIARES ---

async function notifyServer(client: Client, channelId: string, text: string) {
    try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
            await (channel as any).send(text);
        }
    } catch (e) { console.error(`Erro ao notificar ${channelId}:`, e); }
}

// --- COMANDO ---

export default {
    name: 'phone',
    description: 'Sistema de Telefone Inter-Servidores',
    
    data: new SlashCommandBuilder()
        .setName('phone')
        .setDescription('Telefone Inter-Servidores')
        .addSubcommand(sub => 
            sub.setName('call')
                .setDescription('Liga para um servidor')
                .addStringOption(op => op.setName('alvo').setDescription('ID ou Nome do servidor').setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('register')
                .setDescription('Instala o telefone neste canal')
                .addStringOption(op => op.setName('nome').setDescription('Nome público do local').setRequired(false)))
        .addSubcommand(sub => sub.setName('accept').setDescription('Atende uma chamada'))
        .addSubcommand(sub => sub.setName('decline').setDescription('Recusa uma chamada'))
        .addSubcommand(sub => sub.setName('end').setDescription('Desliga a chamada'))
        .addSubcommand(sub => sub.setName('group').setDescription('Pede para entrar na chamada em grupo')
             .addStringOption(op => op.setName('alvo').setDescription('ID ou Nome de quem já está na call').setRequired(true))),

    async executeSlash(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        const args = [sub]; 

        if (sub === 'call' || sub === 'group') {
            const alvo = interaction.options.getString('alvo');
            if (alvo) args.push(alvo); 
        }
        else if (sub === 'register') {
            const nome = interaction.options.getString('nome');
            if (nome) args.push(nome);
        }

        // Fake Message para reaproveitar lógica
        const fakeMessage: any = {
            content: `rp!phone ${args.join(' ')}`,
            author: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            client: interaction.client, 
            reply: async (payload: any) => {
                if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
                return interaction.reply(payload);
            }
        };

        await this.execute(fakeMessage, args);
    },

    async execute(message: Message | any, args: string[]) {
        const action = args[0] ? args[0].toLowerCase() : null;
        const serverId = message.guild?.id;
        const validActions = ['register', 'call', 'group', 'accept', 'decline', 'end', 'off'];

        if (!action || !validActions.includes(action)) {
            return message.reply("📱 **Telefone:** Use `register, call, group, accept, decline, end`.");
        }

        let data: any = {};

        try {
            switch (action) {
                case 'register':
                    const marker = args[1] ? args.slice(1).join(" ") : undefined;
                    data = phoneSystem.register(serverId, message.channel.id, marker);
                    break;
                case 'off':
                    data = phoneSystem.turn_off(serverId);
                    break;
                case 'call':
                    const targetCall = args.slice(1).join(" ");
                    if (!targetCall) return message.reply("⚠️ Digite o ID ou Nome.");
                    data = phoneSystem.call(serverId, targetCall);
                    break;
                case 'group':
                    const targetGroup = args.slice(1).join(" ");
                    if (!targetGroup) return message.reply("⚠️ Digite o ID ou Nome.");
                    data = phoneSystem.request_group_join(serverId, targetGroup);
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
            }

            if (data.error) return message.reply(`❌ **Erro:** ${data.error}`);
            
            if (data.status === 'busy') message.reply(data.msg);
            else if (data.status === 'ringing') {
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
            else if (data.msg) {
                message.reply(`📱 ${data.msg}`);
            }

        } catch (e) {
            console.error(e);
            message.reply("❌ Erro interno no telefone.");
        }
    },

    async processPhoneMessage(message: Message): Promise<boolean> {
        if (message.author.bot || message.content.startsWith('rp!') || message.content.startsWith('/')) return false;
        if (!message.guild) return false;

        const result = phoneSystem.transmit(
            message.guild.id,
            message.channel.id,
            message.content,
            message.author.username,
            message.guild.name
        );

        if (result && result.targets) {
            result.targets.forEach((channelId: string) => {
                notifyServer(message.client, channelId, result.msg);
            });
            return true;
        }
        return false;
    }
};