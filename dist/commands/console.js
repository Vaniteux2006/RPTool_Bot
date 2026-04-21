"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = void 0;
const vm = __importStar(require("vm")); // Módulo nativo do Node.js para criar Sandboxes
exports.command = {
    name: "console",
    description: "Executa código JavaScript simulado (Sandbox).",
    aliases: ["js", "run", "eval"],
    execute: async (message, args) => {
        const channel = message.channel;
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
            log: (...args) => {
                // Junta os argumentos do console.log igual o JS de verdade faz
                const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ");
                output += line + "\n";
            },
            error: (...args) => {
                const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ");
                output += "[ERRO] " + line + "\n";
            }
        };
        const input = async (promptMsg = "") => {
            if (promptMsg) {
                await channel.send(`📥 **Console aguardando:** \`${promptMsg}\``);
            }
            const filter = (m) => m.author.bot === false;
            try {
                const collected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
                return collected.first()?.content || "";
            }
            catch (e) {
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
            }
            else {
                message.reply("✅ **Executado!** *(O código rodou sem erros, mas não imprimiu nada no console).*");
            }
        }
        catch (error) {
            message.reply(`❌ **Erro de Compilação/Execução:**\n\`\`\`js\n${error.message}\n\`\`\``);
        }
    }
};
