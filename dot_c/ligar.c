#include <windows.h>
#include <stdio.h>
#include <conio.h>
#include <stdlib.h>

// Definições de Cores para o Terminal
#define PRETO 0
#define AZUL 1
#define VERDE 2
#define CIANO 3
#define VERMELHO 4
#define ROXO 5
#define AMARELO 6
#define BRANCO 7

// Variável global para controlar o processo do Node
PROCESS_INFORMATION pi;
STARTUPINFO si;
int botRodando = 0;

// Função para mudar cor do texto
void MudarCor(int cor) {
    HANDLE hConsole = GetStdHandle(STD_OUTPUT_HANDLE);
    SetConsoleTextAttribute(hConsole, cor);
}

// Função para posicionar o cursor (pra ficar bonitinho)
void Gotoxy(int x, int y) {
    COORD coord;
    coord.X = x;
    coord.Y = y;
    SetConsoleCursorPosition(GetStdHandle(STD_OUTPUT_HANDLE), coord);
}

// Mata o processo do Node se estiver rodando
void MatarBot() {
    if (botRodando) {
        TerminateProcess(pi.hProcess, 1);
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        botRodando = 0;
        MudarCor(VERMELHO);
        printf("\n\n[SISTEMA] O Bot foi desligado forcadamente pelo usuario.\n");
        MudarCor(BRANCO);
    }
}

// Inicia o Node.js
void IniciarBot() {
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&pi, sizeof(pi));

    MudarCor(VERDE);
    printf("\n[SISTEMA] Iniciando 'node index.js'...\n");
    printf("--------------------------------------------------\n");
    MudarCor(BRANCO);

    // Cria o processo. 
    // NULL no primeiro parametro faz ele usar o PATH (acha o node automaticamente)
    // O segundo parametro é a linha de comando.
    if (!CreateProcess(NULL,   // Não executável direto
        "node index.js",        // Linha de comando
        NULL,                   // Atributos de processo
        NULL,                   // Atributos de thread
        TRUE,                   // Herdar handles (importante pro log aparecer aqui)
        0,                      // Flags de criação
        NULL,                   // Ambiente
        NULL,                   // Diretório atual (usa a raiz onde o .exe está)
        &si,                    // Startup Info
        &pi)                    // Process Info
    ) {
        MudarCor(VERMELHO);
        printf("[ERRO] Nao foi possivel iniciar o Node.js. O node esta instalado? O index.js esta na pasta?\n");
        printf("Erro do Windows: %d\n", GetLastError());
        MudarCor(BRANCO);
        return;
    }

    botRodando = 1;
}

// Loop de Monitoramento
void Monitorar() {
    while (botRodando) {
        // 1. Verifica se o processo morreu sozinho (Crash ou fim)
        DWORD exitCode;
        if (GetExitCodeProcess(pi.hProcess, &exitCode)) {
            if (exitCode != STILL_ACTIVE) {
                botRodando = 0;
                MudarCor(VERMELHO);
                printf("\n\n[AVISO] O Bot encerrou sozinho (Codigo: %lu).\n", exitCode);
                MudarCor(BRANCO);
                break;
            }
        }

        // 2. Verifica se o usuário apertou DELETE
        // Usamos GetAsyncKeyState para checar a tecla sem pausar o programa
        if (GetAsyncKeyState(VK_DELETE) & 0x8000) {
            MatarBot();
            break;
        }

        // Dorme um pouquinho pra não fritar a CPU (100ms)
        Sleep(100);
    }

    // Quando sai do loop (crashou ou mataram)
    MudarCor(AMARELO);
    printf("\nO Programa foi encerrado. Deseja iniciar de novo? (Y/N): ");
    MudarCor(BRANCO);

    char opcao;
    // Loop pra pegar Y ou N
    while(1) {
        if (_kbhit()) {
            opcao = _getch();
            if (opcao == 'y' || opcao == 'Y') {
                system("cls"); // Limpa tela
                IniciarBot();
                Monitorar(); // Recursão simples pra voltar a monitorar
                return;
            }
            if (opcao == 'n' || opcao == 'N') {
                exit(0);
            }
        }
    }
}

int main() {
    SetCurrentDirectory("..");
    // Configura título da janela
    SetConsoleTitle("Launcher RPTools - Painel de Controle");

    while (1) {
        system("cls");
        MudarCor(CIANO);
        printf("==========================================\n");
        printf("       BEM VINDO AO RPTools Launcher      \n");
        printf("==========================================\n");
        MudarCor(BRANCO);
        printf("Comandos:\n");
        printf(" [C]      - Ligar o Bot\n");
        printf(" [DELETE] - Matar o processo a qualquer momento\n");
        printf(" [ESC]    - Sair do Launcher\n\n");
        
        MudarCor(AMARELO);
        printf("O que deseja fazer? > ");
        
        char tecla = _getch(); // Espera uma tecla

        if (tecla == 'c' || tecla == 'C') {
            IniciarBot();
            Monitorar();
        }
        else if (tecla == 27) { // 27 é ESC
            return 0;
        }
    }
    return 0;
}