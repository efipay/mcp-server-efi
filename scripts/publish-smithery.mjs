import process from 'node:process';
import { publishSmithery } from './publish-smithery-lib.mjs';

const DEFAULT_API_BASE = 'https://api.smithery.ai';
const DEFAULT_QUALIFIED_NAME = 'efipay/mcp-server-efi';

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function positiveInteger(value, label, fallback) {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`${label} deve ser um inteiro positivo.`);
  return Number(value);
}

if (!argumentValue('--bundle') || !argumentValue('--server-card')) {
  throw new Error('Informe --bundle e --server-card.');
}

const apiKey = process.env.SMITHERY_API_KEY;
const qualifiedName = argumentValue('--qualified-name') ?? DEFAULT_QUALIFIED_NAME;
const apiBase = (argumentValue('--api-base') ?? DEFAULT_API_BASE).replace(/\/$/, '');
const timeoutMs = positiveInteger(argumentValue('--timeout-ms'), '--timeout-ms', 10 * 60 * 1000);
const pollIntervalMs = positiveInteger(
  argumentValue('--poll-interval-ms'),
  '--poll-interval-ms',
  5000,
);
const result = await publishSmithery({
  bundlePath: argumentValue('--bundle'),
  cardPath: argumentValue('--server-card'),
  apiKey,
  qualifiedName,
  apiBase,
  timeoutMs,
  pollIntervalMs,
});

process.stdout.write(
  `Release ${result.deploymentId} publicada no Smithery com ${result.toolCount} tools.\n`,
);
