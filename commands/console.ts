import { Message, TextChannel } from "discord.js";
import { Command } from "../interfaces/Command";
import * as vm from 'vm'; // Módulo nativo do Node.js para criar Sandboxes

export const command: Command = {
    name: "console",
    description: "Executa código JavaScript simulado (Sandbox).",
    aliases: ["js", "run", "eval"],
    execute: async (message: Message, args: string[]) => {
        const channel = message.channel as TextChannel;
        let code = message.content.replace(/^rp!(console|js|run|eval)(\s+js)?\s*/i, "");

        if (code.startsWith("```") && code.endsWith("```")) {
            code = code.replace(/^```(js|javascript)?\n/i, "").replace(/```$/, "");
        } 
        else if (code.startsWith("{") && code.endsWith("}")) {
            code = code.slice(1, -1);
        }

        if (!code.trim()) {
            return message.reply("💻 **Uso:** `rp!console js { seu_codigo_aqui }` ou use blocos de código com crases.");
        }
        let output = "";
        const customConsole = {
            log: (...args: any[]) => {
                // Junta os argumentos do console.log igual o JS de verdade faz
                const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ");
                output += line + "\n";
            },
            error: (...args: any[]) => {
                const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ");
                output += "[ERRO] " + line + "\n";
            }
        };

        const input = async (promptMsg: string = "") => {
            if (promptMsg) {
                await channel.send(`📥 **Console aguardando:** \`${promptMsg}\``); 
            }
            
            const filter = (m: Message) => m.author.bot === false; 
            
            try {
                const collected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] }); 
                return collected.first()?.content || "";
            } catch (e) {
                throw new Error("Timeout: Ninguém digitou nada no input a tempo.");
            }
        };

        const context = vm.createContext({
            console: customConsole,
            input: input,
            Math: Math,
            Date: Date,
            Number: Number,
            String: String,
            Array: Array,
            Object: Object,
            JSON: JSON,
            setTimeout: setTimeout 
        });

        const wrappedCode = `(async () => { \n${code}\n })()`;

        try {
            const script = new vm.Script(wrappedCode);
            
            channel.sendTyping();

            const resultPromise = script.runInContext(context, { timeout: 3000 });
            await resultPromise;
            
            if (output.trim()) {
                message.reply(`✅ **Execução Concluída:**\n\`\`\`js\n${output.substring(0, 1900)}\n\`\`\``);
            } else {
                message.reply("✅ **Executado!** *(O código rodou sem erros, mas não imprimiu nada no console).*");
            }

        } catch (error: any) {
            message.reply(`❌ **Erro de Compilação/Execução:**\n\`\`\`js\n${error.message}\n\`\`\``);
        }
    }
};