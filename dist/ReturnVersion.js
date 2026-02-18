"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReturnVersion;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function ReturnVersion() {
    try {
        const versionPath = path_1.default.join(__dirname, 'Data/version.json');
        if (fs_1.default.existsSync(versionPath)) {
            const rawData = fs_1.default.readFileSync(versionPath, 'utf-8');
            const data = JSON.parse(rawData);
            return data.current_display || "?.?.?";
        }
    }
    catch (e) {
        console.error("⚠️ [ReturnVersion] Não foi possível ler a versão.");
    }
    return "1.4";
}
