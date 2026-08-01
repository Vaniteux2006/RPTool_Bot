// A versão vem do package.json — fonte única de verdade (bump lá, aparece em todo lugar).
export default function returnVersion(): string {
    try {
        return require('../package.json').version || '?.?.?';
    } catch {
        return '?.?.?';
    }
}
