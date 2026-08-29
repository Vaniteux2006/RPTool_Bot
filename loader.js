// transpileOnly: não executa o type-checker do TypeScript em produção.
// O ts-node padrão mantinha o Program + TypeChecker residentes na RAM (a parte
// mais pesada — facilmente centenas de MB num projeto deste tamanho). O bot não
// depende de checagem de tipos em runtime, então só transpilamos cada arquivo.
require('ts-node').register({ transpileOnly: true });
require('./index.ts');
