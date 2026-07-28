import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const ALLOWED_ADVISORY = 'GHSA-frvp-7c67-39w9';
const ALLOWED_PACKAGES = new Set([
  '@hono/node-server',
  '@modelcontextprotocol/sdk',
  'mcp-server-efi',
]);
const REVIEW_DEADLINE = new Date('2026-10-27T00:00:00Z');
const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
  if (options.allowFailure !== true && result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} falhou:\n${result.stderr || result.stdout}`);
  }
  return result;
}

function containsAllowedAdvisory(via) {
  return via.some(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof entry.url === 'string' &&
      entry.url.endsWith(`/${ALLOWED_ADVISORY}`),
  );
}

function validateAudit(report) {
  const vulnerabilities = Object.values(report.vulnerabilities ?? {});
  if (vulnerabilities.length === 0) {
    return false;
  }
  if (Date.now() >= REVIEW_DEADLINE.getTime()) {
    throw new Error(`A exceção ${ALLOWED_ADVISORY} expirou e precisa ser reavaliada.`);
  }

  for (const vulnerability of vulnerabilities) {
    if (!ALLOWED_PACKAGES.has(vulnerability.name)) {
      throw new Error(`Vulnerabilidade não permitida no pacote: ${vulnerability.name}.`);
    }
    if (
      (severityRank[vulnerability.severity] ?? Number.POSITIVE_INFINITY) > severityRank.moderate
    ) {
      throw new Error(`A severidade de ${vulnerability.name} excedeu o máximo moderate permitido.`);
    }
    for (const via of vulnerability.via ?? []) {
      if (typeof via === 'string' && !ALLOWED_PACKAGES.has(via)) {
        throw new Error(`Cadeia de vulnerabilidade inesperada: ${via}.`);
      }
      if (
        typeof via === 'object' &&
        via !== null &&
        !(typeof via.url === 'string' && via.url.endsWith(`/${ALLOWED_ADVISORY}`))
      ) {
        throw new Error(
          `Advisory não permitido em ${vulnerability.name}: ${via.url ?? 'sem URL'}.`,
        );
      }
    }
  }

  const hono = vulnerabilities.find(({ name }) => name === '@hono/node-server');
  if (!hono || !containsAllowedAdvisory(hono.via ?? [])) {
    throw new Error(`A cadeia auditada não contém a exceção exata ${ALLOWED_ADVISORY}.`);
  }
  return true;
}

function dependencyPathExists(tree) {
  const server = tree.dependencies?.['mcp-server-efi'];
  const sdk = server?.dependencies?.['@modelcontextprotocol/sdk'];
  return sdk?.dependencies?.['@hono/node-server'] !== undefined;
}

const temporary = mkdtempSync(join(tmpdir(), 'mcp-server-efi-audit-'));

try {
  const suppliedArchive = process.argv[2];
  let archive;
  if (suppliedArchive !== undefined) {
    archive = resolve(process.cwd(), suppliedArchive);
    if (!existsSync(archive) || !statSync(archive).isFile() || !archive.endsWith('.tgz')) {
      throw new Error(`O artefato informado não é um arquivo .tgz válido: ${archive}`);
    }
  } else {
    const packed = run('npm', [
      'pack',
      '--ignore-scripts',
      '--json',
      '--pack-destination',
      temporary,
    ]);
    const [{ filename }] = JSON.parse(packed.stdout);
    archive = resolve(temporary, filename);
  }
  const consumer = join(temporary, 'consumer');

  run('npm', ['install', '--prefix', consumer, archive, '--ignore-scripts', '--no-fund'], {
    env: {
      ...process.env,
      NODE_TLS_REJECT_UNAUTHORIZED: '1',
      npm_config_strict_ssl: 'true',
    },
  });

  const audit = run('npm', ['audit', '--prefix', consumer, '--json'], {
    allowFailure: true,
    env: {
      ...process.env,
      NODE_TLS_REJECT_UNAUTHORIZED: '1',
      npm_config_strict_ssl: 'true',
    },
  });
  const report = JSON.parse(audit.stdout || audit.stderr);
  const exceptionUsed = validateAudit(report);

  const treeResult = run('npm', ['ls', '--prefix', consumer, '--all', '--json'], {
    allowFailure: true,
  });
  const tree = JSON.parse(treeResult.stdout);
  if (!dependencyPathExists(tree) && Object.keys(report.vulnerabilities ?? {}).length > 0) {
    throw new Error('A exceção Hono não veio exclusivamente de mcp-server-efi → MCP SDK oficial.');
  }

  const entrypoint = readFileSync(
    join(consumer, 'node_modules', 'mcp-server-efi', 'dist', 'src', 'index.js'),
    'utf8',
  );
  if (!entrypoint.includes('StdioServerTransport')) {
    throw new Error('O artefato auditado não usa exclusivamente o entrypoint stdio esperado.');
  }

  process.stdout.write(
    exceptionUsed
      ? `Auditoria do .tgz aprovada. Exceção temporária: ${ALLOWED_ADVISORY}, revisão até 2026-10-27.\n`
      : 'Auditoria do .tgz aprovada sem vulnerabilidades conhecidas; exceção Hono não utilizada.\n',
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
