import { SlashCommandBuilder } from "discord.js";
import { ChatInputCommandInteraction } from "discord.js";
import { Message } from "discord.js";
import { AttachmentBuilder } from "discord.js";

import { generateDashboard } from "../commands/generateDashboard";
import { DashboardStats } from "../commands/dashboard";

export default {

name: "dashboard",
description: "Mostra analytics do servidor",

data: new SlashCommandBuilder()
.setName("dashboard")
.setDescription("Mostra analytics do servidor"),


async execute(message: Message, args: string[]) {

const stats: DashboardStats = generateFakeStats()

const buffer = await generateDashboard(message.guild!, stats)

const attachment = new AttachmentBuilder(buffer,{
name:"dashboard.png"
})

await message.reply({
files:[attachment]
})

},


async executeSlash(interaction: ChatInputCommandInteraction) {

await interaction.deferReply()

const stats: DashboardStats = generateFakeStats()

const buffer = await generateDashboard(interaction.guild!, stats)

const attachment = new AttachmentBuilder(buffer,{
name:"dashboard.png"
})

await interaction.editReply({
files:[attachment]
})

}

}


function generateFakeStats(): DashboardStats {

return {

audit:{
bans:2,
warns:4,
roles:3
},

events:{
messages:3200,
calls:140,
joins:20
},

topUsers:[
{
name:"João",
messages:430,
call:3
},
{
name:"Maria",
messages:380,
call:2
},
{
name:"Pedro",
messages:300,
call:1
}
],

activity:{
hours:["00","03","06","09","12","15","18","21"],
messages:[50,120,300,450,600,700,500,200],
calls:[10,20,40,50,60,80,50,30]
},

inactiveChannels:[
{name:"#hospital",time:"4h"},
{name:"#prefeitura",time:"3h"},
{name:"#mercado",time:"2h"}
]

}
}