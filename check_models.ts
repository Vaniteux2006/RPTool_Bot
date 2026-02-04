import 'dotenv/config';

// Hack para garantir que o fetch funcione em qualquer versão do Node
declare const fetch: any;

async function listGoogleModels() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("❌ ERRO: GEMINI_API_KEY não encontrada no .env");
        return;
    }

    console.log("📡 Perguntando ao Google: 'O que eu posso usar?'...\n");

    try {
        // Chama a API direta do Google para listar modelos (GET /models)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            console.error(`❌ Erro do Google: ${data.error.message}`);
            return;
        }

        if (!data.models || data.models.length === 0) {
            console.log("⚠️ O Google respondeu, mas a lista de modelos veio vazia.");
            return;
        }

        console.log("✅ Lista Oficial de Modelos Disponíveis para sua Chave:");
        console.log("======================================================");

        // Filtra e exibe
        data.models.forEach((model: any) => {
            // Mostra apenas modelos que geram texto (ignora embeddings se quiser limpar, 
            // mas vou deixar tudo já que vc pediu "o que o google responder")
            
            const capabilities = model.supportedGenerationMethods.join(", ");
            console.log(`📦 NOME: ${model.name.replace('models/', '')}`); // Remove o prefixo 'models/' pra ficar limpo
        });

    } catch (error) {
        console.error("🔥 Erro fatal ao conectar:", error);
    }
}

listGoogleModels();