import { EmbedBuilder, SlashCommandBuilder, Message, Client, TextChannel } from 'discord.js';
import { BirthdayModel, BirthdayConfigModel } from '../tools/models/BirthdaySchema';

export default {
    name: 'birthday',
    description: 'Sistema avançado de eventos e aniversários',
    aliases: ['niver', 'eventos', 'calendario'],

    async execute(message: Message, args: string[]) {
        const guildId = message.guild?.id;
        if (!guildId) return message.reply("⚠️ Use este comando dentro de um servidor.");

        const targetChannel = message.mentions.channels.first() as TextChannel; 
        if (targetChannel && !args[0].includes("add")) {
            const embed = new EmbedBuilder()
                .setTitle("🎂 Painel de Eventos do Servidor")
                .setDescription("⏳ *Verificando se temos o que comemorar hoje...*")
                .setColor(0x2B2D31);
            
            const sentMsg = await targetChannel.send({ embeds: [embed] });
            
            await BirthdayConfigModel.findOneAndUpdate(
                { guildId },
                { guildId, channelId: targetChannel.id, messageId: sentMsg.id },
                { upsert: true }
            );

            await this.updateBirthdayPanels(message.client, guildId);
            return message.reply(`✅ Painel fixado com sucesso em <#${targetChannel.id}>! Ele se atualizará sozinho.`);
        }

        const sub = args[0]?.toLowerCase();

        if (sub === 'list') {
            return await this.handleList(message, guildId);
        }

        if (sub === 'add') {
            
            if (message.content.includes('{') && message.content.includes('}')) {
                const block = message.content.substring(message.content.indexOf('{') + 1, message.content.lastIndexOf('}'));
                const lines = block.split('\n');
                let addedCount = 0;
                let pastCount = 0;

                for (const line of lines) {
                    if (!line.includes('->')) continue;
                    const [datePart, namePart] = line.split('->').map(s => s.trim());
                    if (!datePart || !namePart) continue;

                    const result = await this.saveBirthday(guildId, datePart, namePart);
                    if (result === 'ok') addedCount++;
                    if (result === 'past') pastCount++;
                }

                await this.updateBirthdayPanels(message.client, guildId);
                const aviso = pastCount > 0 ? `\n⚠️ **${pastCount}** ignorada(s) por estarem no passado.` : '';
                return message.reply(`✅ **${addedCount}** datas foram salvas para a eternidade!${aviso}`);
            }

            const dataStr = args[1];
            if (!dataStr) return message.reply("⚠️ Uso: `rp!birthday add DD/MM Evento` ou use chaves `{ 01/01 -> Evento }`");
            
            let namePart = args.slice(2).join(" ");
            if (!namePart) namePart = `<@${message.author.id}>`; 

            const result = await this.saveBirthday(guildId, dataStr, namePart);
            if (result === 'ok') {
                await this.updateBirthdayPanels(message.client, guildId);
                return message.reply(`🎉 Evento salvo para **${dataStr}**!`);
            } else if (result === 'past') {
                return message.reply("❌ Essa data já passou! Use uma data futura ou apenas `DD/MM` para eventos anuais.");
            } else {
                return message.reply("❌ Data inválida! Use `DD/MM` ou `DD/MM/AAAA`.");
            }
        }

        return message.reply("⚠️ Use `rp!birthday add`, `rp!birthday list`, ou `rp!birthday #chat` para instalar o painel.");
    },

    async saveBirthday(guildId: string, dateStr: string, namePart: string): Promise<'ok' | 'invalid' | 'past'> {
        const parts = dateStr.split('/');
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parts[2] ? parseInt(parts[2]) : undefined;

        if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) return 'invalid';
        if (year !== undefined && isNaN(year)) return 'invalid';

        let isUser = false;
        let identifier = namePart;

        const mentionMatch = namePart.match(/<@!?(\d+)>/);
        if (mentionMatch) {
            isUser = true;
            identifier = mentionMatch[1];
        }

        // Evento com data completa não pode estar no passado. Aniversários de usuários
        // ficam de fora: o ano informado é o de nascimento, sempre no passado.
        if (year !== undefined && !isUser) {
            const hoje = new Date();
            hoje.setHours(hoje.getHours() - 3);
            const dataEvento = new Date(year, month - 1, day);
            const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
            if (dataEvento < inicioHoje) return 'past';
        }

        await BirthdayModel.findOneAndUpdate(
            { guildId, identifier },
            { guildId, identifier, isUser, day, month, year },
            { upsert: true }
        );
        return 'ok';
    },

    async updateBirthdayPanels(client: Client, specificGuildId: string | null = null) {
        const today = new Date();
        today.setHours(today.getHours() - 3); 
        
        const currentDay = today.getDate();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        const query = specificGuildId ? { guildId: specificGuildId } : {};
        const configs = await BirthdayConfigModel.find(query);

        for (const config of configs) {
            const guild = client.guilds.cache.get(config.guildId);
            if (!guild) continue;
            
            const channel = guild.channels.cache.get(config.channelId) as TextChannel;
            if (!channel) continue;
            
            const todaysBdays = await BirthdayModel.find({ guildId: config.guildId, day: currentDay, month: currentMonth });

            const embed = new EmbedBuilder()
                .setTitle(`🎂 Eventos do Dia (${currentDay.toString().padStart(2, '0')}/${currentMonth.toString().padStart(2, '0')})`);

            if (todaysBdays.length === 0) {
                embed.setDescription("📭 *Ninguém faz aniversário hoje e nenhum evento histórico aconteceu.*")
                     .setColor(0x2B2D31);
            } else {
                let desc = "🎉 **Hoje é dia de comemorar!**\n\n";
                for (const b of todaysBdays) {
                    let ageStr = "";
                    if (b.year) {
                        const age = currentYear - b.year;
                        ageStr = ` (**${age} anos**)`;
                    }
                    const nameDisplay = b.isUser ? `<@${b.identifier}>` : `**${b.identifier}**`;
                    desc += `🎁 ${nameDisplay}${ageStr}\n`;
                }
                embed.setDescription(desc).setColor(0xFFD700);
            }

            // Edita o painel; se a mensagem foi apagada (10008), recria UMA vez e salva o novo id —
            // assim a rotina horária para de tentar buscar pra sempre uma mensagem que não existe.
            try {
                const msg = await channel.messages.fetch(config.messageId);
                await msg.edit({ embeds: [embed] });
            } catch (e: any) {
                if (e?.code === 10008) {
                    const novo = await channel.send({ embeds: [embed] }).catch(() => null);
                    if (novo) {
                        await BirthdayConfigModel.updateOne({ guildId: config.guildId }, { $set: { messageId: novo.id } });
                        console.log(`🎂 [BIRTHDAY] Painel recriado em "${guild.name}" (a mensagem anterior tinha sido apagada).`);
                    }
                } else {
                    console.warn(`[BIRTHDAY] Falha ao atualizar painel em "${guild.name}":`, e?.message ?? e);
                }
            }
        }
    },

    async handleList(context: any, guildId: string) {
        const birthdays = await BirthdayModel.find({ guildId }).sort({ month: 1, day: 1 });
        if (birthdays.length === 0) return context.reply("📭 Nenhum evento registrado neste servidor.");

        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        let desc = "";
        
        for (let m = 1; m <= 12; m++) {
            const bdaysInMonth = birthdays.filter(b => b.month === m);
            if (bdaysInMonth.length > 0) {
                desc += `\n**📅 ${meses[m-1]}**\n`;
                
                bdaysInMonth.forEach(b => {
                    const dayStr = b.day.toString().padStart(2, '0');
                    const monthStr = b.month.toString().padStart(2, '0');
                    const nameDisplay = b.isUser ? `<@${b.identifier}>` : b.identifier;
                    
                    desc += `\`${dayStr}/${monthStr}\` - ${nameDisplay}\n`;
                });
            }
        }

        const embed = new EmbedBuilder().setTitle("🎂 Calendário do Servidor").setDescription(desc.trim()).setColor(0xFFD700);
        return context.reply({ embeds: [embed] });
    }
};