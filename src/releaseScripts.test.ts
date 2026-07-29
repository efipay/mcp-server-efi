import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function run(command: string, args: string[], cwd: string, env = process.env) {
  return spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
  });
}

function createRepository(parent: string, name: string): string {
  const repository = join(parent, name);
  mkdirSync(repository);
  expect(run('git', ['init', '--quiet'], repository).status).toBe(0);
  expect(run('git', ['config', 'user.name', 'Release Test'], repository).status).toBe(0);
  expect(run('git', ['config', 'user.email', 'release@example.test'], repository).status).toBe(0);
  writeFileSync(join(repository, 'package.json'), '{"name":"mirror","version":"1.0.0"}\n');
  writeFileSync(join(repository, 'tracked.txt'), 'conteúdo idêntico\n');
  expect(run('git', ['add', '.'], repository).status).toBe(0);
  expect(run('git', ['commit', '--quiet', '-m', 'fixture'], repository).status).toBe(0);
  return repository;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('scripts de coordenação do release', () => {
  it.each(['1.0.0', '1.12.3', '2.0.0'])(
    'deriva todos os artefatos de uma versão SemVer estável %s',
    (version) => {
      const repository = temporaryDirectory('mcp-release-metadata-');
      const githubOutput = join(repository, 'github-output');
      const githubEnv = join(repository, 'github-env');
      writeFileSync(
        join(repository, 'package.json'),
        `${JSON.stringify({ name: 'mcp-server-efi', version })}\n`,
      );

      const result = run(
        process.execPath,
        [
          resolve(process.cwd(), 'scripts/release-metadata.mjs'),
          '--tag',
          `v${version}`,
          '--github-output',
          githubOutput,
          '--github-env',
          githubEnv,
        ],
        repository,
      );

      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(githubOutput, 'utf8')).toBe(
        [
          `version=${version}`,
          `package_file=mcp-server-efi-${version}.tgz`,
          `mcpb_file=mcp-server-efi-${version}.mcpb`,
          `server_card_file=smithery-server-card-${version}.json`,
          '',
        ].join('\n'),
      );
      expect(readFileSync(githubEnv, 'utf8')).toBe(
        [
          `VERSION=${version}`,
          `PACKAGE_FILE=mcp-server-efi-${version}.tgz`,
          `MCPB_FILE=mcp-server-efi-${version}.mcpb`,
          `SERVER_CARD_FILE=smithery-server-card-${version}.json`,
          '',
        ].join('\n'),
      );
    },
  );

  it.each([
    ['1.0.0-rc.1', 'v1.0.0-rc.1', 'não é um SemVer estável'],
    ['01.0.0', 'v01.0.0', 'não é um SemVer estável'],
    ['1.0', 'v1.0', 'não é um SemVer estável'],
    ['1.2.3', 'v1.2.4', 'não corresponde à versão do pacote'],
  ])('rejeita release inválido para versão %s e tag %s', (version, tag, error) => {
    const repository = temporaryDirectory('mcp-release-invalid-');
    writeFileSync(
      join(repository, 'package.json'),
      `${JSON.stringify({ name: 'mcp-server-efi', version })}\n`,
    );

    const result = run(
      process.execPath,
      [resolve(process.cwd(), 'scripts/release-metadata.mjs'), '--tag', tag],
      repository,
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(error);
  });

  it('aceita clones limpos com a mesma versão, arquivos e árvore', () => {
    const parent = temporaryDirectory('mcp-mirror-');
    const first = createRepository(parent, 'first');
    const second = createRepository(parent, 'second');

    const result = run(
      process.execPath,
      [resolve(process.cwd(), 'scripts/check-mirror.mjs'), second],
      first,
    );

    expect(result.status, result.stderr).toBe(0);
  });

  it('rejeita um clone com alterações não commitadas', () => {
    const parent = temporaryDirectory('mcp-mirror-dirty-');
    const first = createRepository(parent, 'first');
    const second = createRepository(parent, 'second');
    writeFileSync(join(second, 'untracked.txt'), 'não rastreado\n');

    const result = run(
      process.execPath,
      [resolve(process.cwd(), 'scripts/check-mirror.mjs'), second],
      first,
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('alterações não commitadas');
  });

  it('audita um .tgz informado sem executar npm pack', () => {
    const temporary = temporaryDirectory('mcp-audit-script-');
    const fakeBin = join(temporary, 'bin');
    const archive = join(temporary, 'mcp-server-efi-1.0.0.tgz');
    const log = join(temporary, 'npm.log');
    mkdirSync(fakeBin);
    writeFileSync(archive, 'fixture');

    const fakeNpm = join(fakeBin, 'npm');
    writeFileSync(
      fakeNpm,
      `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_NPM_LOG"
case "$1" in
  install)
    prefix="$3"
    mkdir -p "$prefix/node_modules/mcp-server-efi/dist/src"
    printf 'StdioServerTransport\\n' > "$prefix/node_modules/mcp-server-efi/dist/src/index.js"
    ;;
  audit)
    printf '{"vulnerabilities":{}}'
    ;;
  ls)
    printf '{"dependencies":{"mcp-server-efi":{}}}'
    ;;
  *)
    printf 'comando npm inesperado: %s\\n' "$*" >&2
    exit 9
    ;;
esac
`,
    );
    chmodSync(fakeNpm, 0o755);

    const result = run(
      process.execPath,
      [resolve(process.cwd(), 'scripts/audit-package.mjs'), archive],
      process.cwd(),
      {
        ...process.env,
        FAKE_NPM_LOG: log,
        PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ''}`,
      },
    );

    expect(result.status, result.stderr).toBe(0);
    const invocations = readFileSync(log, 'utf8').trim().split('\n');
    expect(invocations.some((args) => args.startsWith('pack '))).toBe(false);
    expect(invocations.some((args) => args.includes(archive))).toBe(true);
  });
});
