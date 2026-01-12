#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    int major;
    int minor;
    int c_010; // Main
    int c_020; // Bugfix
    int c_030; // Demo
    char current_display[50];
} VersionData;

// Caminho do arquivo relativo a pasta output
const char* FILE_PATH = "../../Data/version.json";

VersionData load_version() {
    FILE *f = fopen(FILE_PATH, "r");
    VersionData v = {1, 0, 0, 0, 0, ""}; 
    
    if (f == NULL) {
        printf("ERRO: Nao achei '%s'.\n", FILE_PATH);
        return v;
    }

    char buffer[1024];
    char *ptr; // Ponteiro auxiliar

    while (fgets(buffer, 1024, f)) {
        // A LOGICA NOVA:
        // 1. Acha onde esta o ':' na linha
        // 2. Le o numero APENAS depois do ':'
        
        ptr = strchr(buffer, ':'); // Procura os dois pontos
        if (ptr != NULL) {
            // Se achou ':', tenta ler o que tem na frente
            if (strstr(buffer, "\"major\":")) sscanf(ptr, "%*[^0-9]%d", &v.major);
            if (strstr(buffer, "\"minor\":")) sscanf(ptr, "%*[^0-9]%d", &v.minor);
            if (strstr(buffer, "\"010\":")) sscanf(ptr, "%*[^0-9]%d", &v.c_010);
            if (strstr(buffer, "\"020\":")) sscanf(ptr, "%*[^0-9]%d", &v.c_020);
            if (strstr(buffer, "\"030\":")) sscanf(ptr, "%*[^0-9]%d", &v.c_030);
        }
    }
    fclose(f);
    return v;
}

void save_version(VersionData v) {
    FILE *f = fopen(FILE_PATH, "w");
    if (f == NULL) {
        printf("Erro critico ao salvar em: %s\n", FILE_PATH);
        return;
    }

    fprintf(f, "{\n");
    fprintf(f, "  \"major\": %d,\n", v.major);
    fprintf(f, "  \"minor\": %d,\n", v.minor);
    fprintf(f, "  \"last_counts\": {\n");
    fprintf(f, "    \"010\": %d,\n", v.c_010);
    fprintf(f, "    \"020\": %d,\n", v.c_020);
    fprintf(f, "    \"030\": %d\n", v.c_030);
    fprintf(f, "  },\n");
    fprintf(f, "  \"current_display\": \"%s\"\n", v.current_display);
    fprintf(f, "}\n");
    fclose(f);
    printf(">> Arquivo atualizado com sucesso!\n");
    printf(">> Nova Versao: %s\n", v.current_display);
}

int main() {
    VersionData v = load_version();
    int choice;
    int type = 10; 
    int *target_count = &v.c_010;

    printf("\n=== GERENCIADOR DE VERSAO RPTOOL ===\n");
    printf("Lido do JSON -> Major: %d | Minor: %d | Build 010: %d\n", v.major, v.minor, v.c_010);
    printf("Versao Atual: %s\n\n", v.current_display[0] ? v.current_display : "Desconhecida");
    
    printf("O que voce fez?\n");
    printf("1 - Apenas DEMONSTRACAO (Branch 030)\n");
    printf("2 - Correcao de BUGS (Branch 020)\n");
    printf("3 - Feature Nova / Comandos (Main 010)\n");
    printf("4 - MUDANCA EXTRAORDINARIA (+100 no Minor)\n");
    printf("0 - Sair (Nada mudou)\n");
    printf(">> ");
    scanf("%d", &choice);

    if (choice == 0) return 0;

    if (choice == 4) {
        v.minor += 100;
        if (v.minor >= 1000) { v.major += 1; v.minor = 0; }
        v.c_010++; 
        type = 10;
        target_count = &v.c_010;
    } 
    else if (choice == 1) { type = 30; v.c_030++; target_count = &v.c_030; }
    else if (choice == 2) { type = 20; v.c_020++; target_count = &v.c_020; }
    else if (choice == 3) { type = 10; v.c_010++; target_count = &v.c_010; }

    sprintf(v.current_display, "%d.%d.%03d-%02d", v.major, v.minor, type, *target_count);

    save_version(v);
    
    printf("\nPode commitar!.\n");
    system("pause");
    return 0;
}