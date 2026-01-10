#include <stdlib.h>
#include <stdio.h>

int main() {
    // 1. Limpa a tela pra ficar bonito (cls no Windows)
    system("cls");

    // 2. Mensagem de Status
    printf("\n");
    printf("==============================================\n");
    printf("RPTool ESTA RODANDO\n");
    printf("[Pressione Ctrl + C para destruir tudo]\n");
    printf("==============================================\n\n");

    // 3. Roda o Bot
    // O programa vai ficar PRESO nesta linha enquanto o bot estiver vivo.
    // Quando você der Ctrl+C, o Node fecha, essa linha termina e o programa desce.
    system("node index.js");

    // 4. Tchau!
    return 0;
}