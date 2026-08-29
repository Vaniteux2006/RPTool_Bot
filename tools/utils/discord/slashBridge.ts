// RPTool/tools/utils/discord/slashBridge.ts
// ─── Adaptador slash → prefix ────────────────────────────────────────────────
// Os comandos deste projeto são escritos para Message (rp!). Os shims de slash
// montavam cada um o seu "fakeMessage" com um subconjunto DIFERENTE do Message —
// a fonte estrutural de "funciona no rp! mas quebra no /". Este é o adaptador
// único e completo: author, member, guild, channel, client, mentions e reply
// (que resolve deferred/replied sozinho).
import {
    ChatInputCommandInteraction,
    Message,
    User,
    Channel,
} from 'discord.js';

export interface BridgeOpts {
    /** `content` sintético (ex: "rp!status @user") — comandos que reparseiam o content. */
    content?: string;
    /** Usuários que o comando espera achar em message.mentions.users. */
    users?: User[];
    /** Canais que o comando espera achar em message.mentions.channels. */
    channels?: Channel[];
}

/**
 * Constrói um objeto compatível com Message a partir de uma interação de slash.
 * `reply` responde a interação: usa editReply quando já deferida, followUp
 * quando já respondida, reply caso contrário — sempre devolvendo a Message.
 */
export function messageFromInteraction(
    interaction: ChatInputCommandInteraction,
    opts: BridgeOpts = {},
): Message {
    const users = opts.users ?? [];
    const channels = opts.channels ?? [];

    const fake: any = {
        // Identidade / contexto — o conjunto COMPLETO, não um subconjunto
        author: interaction.user,
        member: interaction.member,
        guild: interaction.guild,
        guildId: interaction.guildId,
        channel: interaction.channel,
        channelId: interaction.channelId,
        client: interaction.client,
        id: interaction.id,
        createdTimestamp: interaction.createdTimestamp,
        content: opts.content ?? '',
        attachments: new Map(),

        mentions: {
            users: { first: () => users[0] ?? null, has: (u: any) => users.some(x => x?.id === (u?.id ?? u)) },
            channels: { first: () => channels[0] ?? null },
            members: { first: () => null },
            roles: { first: () => null },
        },

        reply: async (payload: any): Promise<Message> => {
            if (interaction.deferred && !interaction.replied) {
                return interaction.editReply(payload) as Promise<Message>;
            }
            if (interaction.replied) {
                return interaction.followUp(payload) as Promise<Message>;
            }
            await interaction.reply(typeof payload === 'string' ? { content: payload } : payload);
            return interaction.fetchReply();
        },
    };

    return fake as Message;
}
