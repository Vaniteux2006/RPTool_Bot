import { Message, TextChannel } from "discord.js";
import { Command } from "../tools/interfaces/Command";
import * as vm from 'vm'; 

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
            return message.reply("💻 **Uso:** `rp!console js { seu_codigo_aqui }`");
        }
        let output = "";
        const customConsole = {
            log: (...args: any[]) => {
                const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ");
                output += line + "\n";
            },
            error: (...args: any[]) => {
                const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ");
                output += "[ERRO] " + line + "\n";
            }
        };

        const input = async (promptMsg: string = "") => {
            if (promptMsg) await channel.send(`📥 **Console aguardando:** \`${promptMsg}\``); 
            
            // 🔥 Segurança extra: Apenas quem rodou o comando pode responder o input
            const filter = (m: Message) => m.author.id === message.author.id; 
            
            try {
                const collected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] }); 
                return collected.first()?.content || "";
            } catch (e) {
                throw new Error("Timeout: Ninguém digitou nada a tempo.");
            }
        };

        // 🔥 Removemos o setTimeout e setInterval para impedir tarefas em background
        const context = vm.createContext({
            console: customConsole,
            input: input,
            Math: Math,
            Date: Date,
            Number: Number,
            String: String,
            Array: Array,
            Object: Object,
            JSON: JSON
        });

        const wrappedCode = `(async () => { \n${code}\n })()`;

        try {
            const script = new vm.Script(wrappedCode, {
                // Quando ele tentar usar o "await import()", a VM joga um erro com uma tag secreta nossa
                importModuleDynamically: async (specifier) => {
                    throw new Error(`[SECURITY_BREACH] ${specifier}`);
                }
            });
            
            channel.sendTyping();

            const resultPromise = script.runInContext(context, { timeout: 3000 });
            await resultPromise;
            
            if (output.trim()) {
                message.reply(`✅ **Execução Concluída:**\n\`\`\`js\n${output.substring(0, 1900)}\n\`\`\``);
            } else {
                message.reply("✅ **Executado!** *(O código rodou sem erros, mas não imprimiu nada no console).*");
            }

        } catch (error: any) {
            // Se o erro tiver a nossa tag secreta, a gente ativa o modo passivo-agressivo
            if (error.message && error.message.startsWith("[SECURITY_BREACH]")) {
                const moduleName = error.message.replace("[SECURITY_BREACH] ", "");
                return message.reply(`🚨 **ALERTA DE INTRUSÃO:** Encontramos tentativa de brecha maliciosa no seu código tentando importar o pacote \`${moduleName}\`. Você se acha muito esperto, não é mesmo? 🤨`);
            }

            // Se for um erro normal (sintaxe, timeout, etc), segue o padrão
            message.reply(`❌ **Erro de Compilação/Execução:**\n\`\`\`js\n${error.message}\n\`\`\``);
        }
    }
};