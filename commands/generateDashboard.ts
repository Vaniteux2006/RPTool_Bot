import { createCanvas, loadImage } from "canvas"
import { Guild } from "discord.js"
import { DashboardStats } from "../commands/dashboard"
export async function generateDashboard(
    guild: Guild,
    data: DashboardStats
): Promise<Buffer> {

    const width = 1400
    const height = 800

    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext("2d")

    ctx.fillStyle = "#0f1117"
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = "#ffffff"
    ctx.font = "28px Sans-serif"
    ctx.fillText(`${guild.name} Analytics`, 40, 50)

    drawCard(ctx, 40, 100, 300, 200)
    drawCard(ctx, 360, 100, 300, 200)
    drawCard(ctx, 680, 100, 680, 200)
    drawCard(ctx, 40, 320, 900, 420)
    drawCard(ctx, 960, 320, 400, 420)

    ctx.fillStyle = "#ffffff"
    ctx.font = "18px Sans-serif"

    ctx.fillText("Audit Logs", 60, 140)
    ctx.fillText(`Bans: ${data.audit.bans}`, 60, 170)
    ctx.fillText(`Warns: ${data.audit.warns}`, 60, 195)
    ctx.fillText(`Roles: ${data.audit.roles}`, 60, 220)

    ctx.fillText("Server Events", 380, 140)
    ctx.fillText(`Messages: ${data.events.messages}`, 380, 170)
    ctx.fillText(`Calls: ${data.events.calls}`, 380, 195)
    ctx.fillText(`Joins: ${data.events.joins}`, 380, 220)

    ctx.fillText("Top Users", 700, 140)

    let y = 170

    for (const user of data.topUsers) {

        if (user.avatar) {

            const avatar = await loadImage(user.avatar)

            ctx.beginPath()
            ctx.arc(710, y - 5, 12, 0, Math.PI * 2)
            ctx.clip()

            ctx.drawImage(avatar, 698, y - 17, 24, 24)
            ctx.restore()

        }

        ctx.fillText(
            `${user.name} - ${user.messages} msgs - ${user.call}h`,
            740,
            y
        )

        y += 25
    }

    const chartUrl = createActivityChart(data)

    const chartImage = await loadImage(chartUrl)

    ctx.drawImage(chartImage, 60, 360, 860, 350)

    ctx.fillText("Inactive Channels", 980, 360)

    let cy = 390

    for (const ch of data.inactiveChannels) {

        ctx.fillText(`${ch.name} - ${ch.time}`, 980, cy)

        cy += 25
    }

    return canvas.toBuffer("image/png")
}


function drawCard(
    ctx: any,
    x: number,
    y: number,
    w: number,
    h: number
) {

    ctx.shadowColor = "rgba(0,0,0,0.4)"
    ctx.shadowBlur = 15

    ctx.fillStyle = "#1a1d24"

    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 12)
    ctx.fill()

    ctx.shadowBlur = 0
}


function createActivityChart(data: DashboardStats): string {

    const config = {

        type: "line",

        data: {

            labels: data.activity.hours,

            datasets: [

                {
                    label: "Messages",
                    data: data.activity.messages,
                    borderColor: "#5865F2",
                    backgroundColor: "rgba(88,101,242,0.25)",
                    fill: true,
                    tension: 0.4
                },

                {
                    label: "Calls",
                    data: data.activity.calls,
                    borderColor: "#57F287",
                    backgroundColor: "rgba(87,242,135,0.15)",
                    fill: true,
                    tension: 0.4
                }

            ]
        },

        options: {

            plugins: {
                legend: { display: false }
            },

            scales: {

                x: {
                    ticks: { color: "#aaa" }
                },

                y: {
                    ticks: { color: "#aaa" }
                }
            }
        }
    }

    return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}`
}
