// RPTool/supercommands/logs/events/GuildLifecycleLogs.ts
// ─── Log: Ciclo de Vida do Servidor ──────────────────────────────────────────
// Intent: GUILDS (1 << 0)
// Eventos: GUILD_CREATE (bot adicionado) · GUILD_DELETE (bot removido/servidor deletado)
//
// ⚠️ Esses eventos NÃO logam no canal do servidor — porque o bot acabou de
//    entrar (sem canal configurado ainda) ou não está mais lá.
//    Em vez disso, logam no console e, se configurado, num canal de "owner log"
//    (canal privado do dono do bot, útil para monitorar adoções do bot) —
//    basta definir OWNER_LOG_CHANNEL_ID no .env. Sem a variável, fica só o console.

import { Guild, EmbedBuilder, TextChannel, Client } from 'discord.js';
import { EventCheckout } from '../../../tools/eventCheckout';
import { formatDate, daysAgo } from '../utils/LogMinister';

// Envia um embed para o canal de "owner log" global, se OWNER_LOG_CHANNEL_ID estiver no .env.
async function sendOwnerLog(client: Client, embed: EmbedBuilder): Promise<void> {
    const channelId = process.env.OWNER_LOG_CHANNEL_ID;
    if (!channelId) return;
    const channel = client.channels.cache.get(channelId)
        ?? await client.channels.fetch(channelId).catch(() => null);
    if (channel && (channel as TextChannel).isTextBased?.()) {
        await (channel as TextChannel).send({ embeds: [embed] }).catch(() => {});
    }
}

// ─── Bot adicionado a um servidor ────────────────────────────────────────────
// GUILD_CREATE também dispara na inicialização do bot para cada servidor
// onde ele já está — filtrar eventos de inicialização vs. adição real.
//
// discord.js marca como "available" os servidores já conhecidos ao iniciar.
// Um servidor realmente novo chega com guild.joinedTimestamp próximo de Date.now().
EventCheckout.onGuildCreate('logs:guildCreate', async (guild: Guild) => {
    const isNewJoin = Date.now() - guild.joinedTimestamp < 10_000;
    if (!isNewJoin) return; // ignora restauração de cache na inicialização

    const ownerTag = guild.ownerId
        ? await guild.fetchOwner().then(o => o.user.tag).catch(() => guild.ownerId)
        : 'Desconhecido';

    console.log(
        `\n🎉 [GUILD_CREATE] Bot adicionado a um novo servidor!\n` +
        `   Nome:          ${guild.name} (${guild.id})\n` +
        `   Dono:          ${ownerTag}\n` +
        `   Membros:       ${guild.memberCount}\n` +
        `   Criado em:     ${formatDate(guild.createdAt)}\n` +
        `   Verificação:   ${guild.verificationLevel}\n`,
    );

    await sendOwnerLog(guild.client, new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🎉 Bot adicionado a um servidor')
        .setThumbnail(guild.iconURL())
        .addFields(
            { name: 'Servidor', value: `${guild.name} (\`${guild.id}\`)`, inline: false },
            { name: 'Dono', value: ownerTag, inline: true },
            { name: 'Membros', value: `${guild.memberCount}`, inline: true },
            { name: 'Criado em', value: formatDate(guild.createdAt), inline: true },
        )
        .setTimestamp());

    // Inicializar cache de convites do servidor recém-adicionado
    // (necessário para o detector de invite no Memberlogs.ts)
    try {
        const invites = await guild.invites.fetch();
        console.log(`🔗 [GUILD_CREATE] ${invites.size} convite(s) cacheados para ${guild.name}`);
    } catch {
        // Sem permissão de gerenciar convites — ok
    }
});

// ─── Bot removido de um servidor / servidor deletado ─────────────────────────
// GUILD_DELETE também dispara quando o servidor fica indisponível (outage).
// guild.available === false indica outage — ignorar.
EventCheckout.onGuildDelete('logs:guildDelete', async (guild: Guild) => {
    // Outage temporária — não logar
    if (!guild.available) return;

    const daysWithBot = daysAgo(new Date(guild.joinedTimestamp));

    console.log(
        `\n💔 [GUILD_DELETE] Bot removido de um servidor.\n` +
        `   Nome:          ${guild.name} (${guild.id})\n` +
        `   Membros:       ${guild.memberCount}\n` +
        `   Dias com o bot: ${daysWithBot}\n`,
    );

    await sendOwnerLog(guild.client, new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('💔 Bot removido de um servidor')
        .setThumbnail(guild.iconURL())
        .addFields(
            { name: 'Servidor', value: `${guild.name} (\`${guild.id}\`)`, inline: false },
            { name: 'Membros', value: `${guild.memberCount}`, inline: true },
            { name: 'Dias com o bot', value: `${daysWithBot}`, inline: true },
        )
        .setTimestamp());

    // Limpar cache de convites do servidor removido
    // Se GuildLifecycleLogs.ts importar o inviteCache do Memberlogs.ts,
    // pode fazer: inviteCache.delete(guild.id);
    // Por ora, o Map será limpo automaticamente pelo GC quando o bot reiniciar.
});
