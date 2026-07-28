import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} falhou:\n${result.stderr || result.stdout}`);
  }
}

const workspace = process.cwd();
const manifest = JSON.parse(readFileSync(join(workspace, 'manifest.json'), 'utf8'));
const output = resolve(workspace, process.argv[2] ?? `mcp-server-efi-${manifest.version}.mcpb`);
const temporary = mkdtempSync(join(tmpdir(), 'mcp-server-efi-mcpb-'));
const staging = join(temporary, 'bundle');

try {
  mkdirSync(staging, { recursive: true });
  for (const path of [
    'dist',
    'manifest.json',
    'package.json',
    'package-lock.json',
    'README.md',
    'LICENSE',
  ]) {
    cpSync(join(workspace, path), join(staging, path), { recursive: true });
  }

  run('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-fund'], {
    cwd: staging,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NODE_TLS_REJECT_UNAUTHORIZED: '1',
      npm_config_strict_ssl: 'true',
    },
  });
  rmSync(join(staging, 'package-lock.json'));

  const packagedManifest = JSON.parse(readFileSync(join(staging, 'manifest.json'), 'utf8'));
  if (
    packagedManifest.manifest_version !== '0.3' ||
    packagedManifest.version !== manifest.version ||
    packagedManifest.server?.entry_point !== 'dist/src/index.js'
  ) {
    throw new Error(`O manifest MCPB não corresponde ao runtime ${manifest.version}.`);
  }

  rmSync(output, { force: true });
  run('zip', ['-q', '-X', '-r', output, '.'], { cwd: staging });
  run('unzip', ['-t', output]);
  writeFileSync(join(temporary, 'result.txt'), `MCPB ${basename(output)} gerado com sucesso.\n`);
  process.stdout.write(readFileSync(join(temporary, 'result.txt'), 'utf8'));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
