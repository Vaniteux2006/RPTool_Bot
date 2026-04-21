// RPTool/commands/autorole.ts
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    GuildMember,
    Message,
} from 'discord.js';
import { AutoroleModel } from '../tools/models/AutoroleConfig';

export default {
    name: 'autorole',
    description: 'Gerencia cargos automáticos ao entrar (add, del, list)',

    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Configura o sistema de cargos automáticos')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Adiciona um cargo ao autorole')
                .addRoleOption(opt =>
                    opt.setName('cargo').setDescription('Cargo a ser dado').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('del')
                .setDescription('Remove um cargo do autorole')
                .addRoleOption(opt =>
                    opt.setName('cargo').setDescription('Cargo a ser removido').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Lista os cargos configurados no autorole')),

    // ─── Slash command (/autorole) ────────────────────────────────────────────
    // O index.ts chama executeSlash(interaction) quando é um slash command.
    executeSlash: async (interaction: ChatInputCommandInteraction) => {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        if (!guildId) return;

        let config = await AutoroleModel.findOne({ guildId });
        if (!config) config = new AutoroleModel({ guildId, autorole: [] });

        if (sub === 'add') {
            const role = interaction.options.getRole('cargo');
            if (!role) return;
            if (config.autorole.includes(role.id)) {
                return interaction.reply({ content: `⚠️ O cargo **${role.name}** já está na lista.`, ephemeral: true });
            }
            config.autorole.push(role.id);
            await config.save();
            return interaction.reply(`✅ Cargo **${role.name}** adicionado ao Autorole.`);
        }

        if (sub === 'del') {
            const role = interaction.options.getRole('cargo');
            if (!role) return;
            if (!config.autorole.includes(role.id)) {
                return interaction.reply({ content: `⚠️ O cargo **${role.name}** não está configurado.`, ephemeral: true });
            }
            config.autorole = config.autorole.filter(id => id !== role.id);
            await config.save();
            return interaction.reply(`🗑️ Cargo **${role.name}** removido do Autorole.`);
        }

        if (sub === 'list') {
            if (!config.autorole || config.autorole.length === 0) {
                return interaction.reply('📭 Nenhum cargo configurado para autorole.');
            }
            return interaction.reply(`📋 **Cargos Automáticos:**\n${config.autorole.map(id => `<@&${id}>`).join(', ')}`);
        }
    },

    // ─── Texto (rp!autorole add/del/list @cargo) ──────────────────────────────
    // CORREÇÃO: o index.ts chama command.execute(message, args) para rp!comandos.
    // A versão anterior só tinha "execute" recebendo uma ChatInputCommandInteraction,
    // então quando chegava uma Message, interaction.options era undefined → crash.
    execute: async (message: Message, args: string[]) => {
        const sub     = args[0]?.toLowerCase();
        const guildId = message.guild?.id;
        if (!guildId) return;

        if (!sub || sub === 'help') {
            return message.reply(
                '⚙️ **Autorole — Comandos de Texto**\n' +
                '`rp!autorole add @cargo` — adiciona cargo ao autorole\n' +
                '`rp!autorole del @cargo` — remove cargo do autorole\n' +
                '`rp!autorole list` — lista os cargos configurados\n\n' +
                '-# Também disponível como `/autorole` (slash command).',
            );
        }

        // Verifica permissão de Administrador
        const member = message.guild!.members.cache.get(message.author.id);
        if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Apenas administradores podem configurar o Autorole.');
        }

        let config = await AutoroleModel.findOne({ guildId });
        if (!config) config = new AutoroleModel({ guildId, autorole: [] });

        if (sub === 'add' || sub === 'del') {
            // Aceita menção (<@&123456>) ou ID direto
            const rawRole = args[1];
            const roleId  = rawRole?.replace(/[<@&>]/g, '');
            if (!roleId) {
                return message.reply(`⚠️ **Uso:** \`rp!autorole ${sub} @cargo\``);
            }

            const role = message.guild!.roles.cache.get(roleId)
                ?? await message.guild!.roles.fetch(roleId).catch(() => null);
            if (!role) {
                return message.reply('❌ Cargo não encontrado. Mencione o cargo ou use o ID.');
            }

            if (sub === 'add') {
                if (config.autorole.includes(role.id)) {
                    return message.reply(`⚠️ O cargo **${role.name}** já está na lista.`);
                }
                config.autorole.push(role.id);
                await config.save();
                return message.reply(`✅ Cargo **${role.name}** adicionado ao Autorole.`);
            } else {
                if (!config.autorole.includes(role.id)) {
                    return message.reply(`⚠️ O cargo **${role.name}** não está configurado.`);
                }
                config.autorole = config.autorole.filter(id => id !== role.id);
                await config.save();
                return message.reply(`🗑️ Cargo **${role.name}** removido do Autorole.`);
            }
        }

        if (sub === 'list') {
            if (!config.autorole || config.autorole.length === 0) {
                return message.reply('📭 Nenhum cargo configurado para autorole.');
            }
            return message.reply(`📋 **Cargos Automáticos:**\n${config.autorole.map(id => `<@&${id}>`).join(', ')}`);
        }

        return message.reply(`❌ Subcomando \`${sub}\` desconhecido. Use \`rp!autorole help\`.`);
    },

    // ─── Dá os cargos quando o membro entra ──────────────────────────────────
    giveRole: async (member: GuildMember) => {
        const config = await AutoroleModel.findOne({ guildId: member.guild.id });
        if (!config || config.autorole.length === 0) return;

        console.log(`⚙️ [AUTOROLE] Processando cargos para: ${member.user.tag} (${member.guild.name})`);

        for (const roleId of config.autorole) {
            try {
                // Tenta o cache primeiro; se não estiver lá, busca na API.
                // roles.cache pode estar vazio logo após reinicialização do bot.
                const role = member.guild.roles.cache.get(roleId)
                    ?? await member.guild.roles.fetch(roleId).catch(() => null);

                if (!role) {
                    console.warn(`⚠️ [AUTOROLE] Cargo ${roleId} não encontrado em ${member.guild.name}.`);
                    continue;
                }

                await member.roles.add(role, 'Autorole automático ao entrar no servidor');
                console.log(`✅ [AUTOROLE] Cargo "${role.name}" dado para ${member.user.tag}.`);

            } catch (e: any) {
                console.error(
                    `❌ [AUTOROLE] Falha ao dar cargo ${roleId} para ${member.user.tag}.\n` +
                    `   Motivo: ${e?.message ?? e}\n` +
                    `   → Verifique: bot tem permissão "Gerenciar Cargos" e está ACIMA do cargo na hierarquia?`,
                );
            }
        }
    },
};