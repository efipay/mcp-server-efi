import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { API_GROUPS, TOOL_CATALOG } from '../dist/src/catalog/index.js';
import { descriptionSourceFor } from './descriptionSources.mjs';

const reportUrl = new URL('../docs/tool-coverage.md', import.meta.url);

const apiLabels = {
  cobrancas: 'Cobranças',
  pix: 'Pix',
  'open-finance': 'Open Finance',
  'pagamento-contas': 'Pagamento de Contas',
  'abertura-contas': 'Abertura de Contas',
  extratos: 'Extratos',
};

export function coverageReport() {
  const lines = [
    '# Cobertura de tools do SDK Efí 2.0.0',
    '',
    'Relatório de desenvolvimento. Os contratos vêm do SDK; as referências indicam apenas as fontes usadas para redigir as descrições.',
    '',
    '## Resumo',
    '',
    '| API | HTTP | Local | Total |',
    '| --- | ---: | ---: | ---: |',
  ];

  for (const api of API_GROUPS) {
    const definitions = TOOL_CATALOG.filter((tool) => tool.api === api);
    const local = definitions.filter((tool) => tool.httpMethod === 'local').length;
    lines.push(
      `| ${apiLabels[api]} | ${definitions.length - local} | ${local} | ${definitions.length} |`,
    );
  }

  lines.push(
    '',
    '## Inventário',
    '',
    '| Método SDK | Tool MCP | API | Verbo/rota | Documento do recurso | Documento da operação |',
    '| --- | --- | --- | --- | --- | --- |',
  );

  for (const tool of TOOL_CATALOG) {
    const source = descriptionSourceFor(tool.method, tool.api);
    lines.push(
      `| \`${tool.method}\` | \`${tool.name}\` | ${apiLabels[tool.api]} | \`${tool.httpMethod.toUpperCase()} ${tool.route}\` | \`${source.resourceDoc}\` | ${source.operationDoc ? `\`${source.operationDoc}\`` : '—'} |`,
    );
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const expected = coverageReport();
  if (process.argv.includes('--check')) {
    const current = await readFile(reportUrl, 'utf8').catch(() => '');
    if (current !== expected) {
      process.stderr.write(
        `Relatório desatualizado: execute node ${fileURLToPath(import.meta.url)} --write.\n`,
      );
      process.exitCode = 1;
    }
    return;
  }

  await writeFile(reportUrl, expected);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
