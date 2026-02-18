"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = runInteractionChecks;
const ficha_1 = require("./commands/ficha");
async function runInteractionChecks(interaction, client) {
    if (interaction.isButton() && interaction.customId.startsWith('ficha_')) {
        await (0, ficha_1.handleFichaInteraction)(interaction);
        return true;
    }
    return false;
}
