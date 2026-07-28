import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

function git(repository, ...args) {
  return execFileSync('git', ['-C', repository, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function assertRepository(repository, label) {
  if (!existsSync(repository) || !statSync(repository).isDirectory()) {
    throw new Error(`${label} não é um diretório: ${repository}`);
  }
  if (git(repository, 'rev-parse', '--is-inside-work-tree') !== 'true') {
    throw new Error(`${label} não é um repositório Git: ${repository}`);
  }
  const status = git(repository, 'status', '--porcelain=v1', '--untracked-files=all');
  if (status !== '') {
    throw new Error(`${label} possui alterações não commitadas:\n${status}`);
  }
}

function packageVersion(repository) {
  const manifest = JSON.parse(readFileSync(resolve(repository, 'package.json'), 'utf8'));
  return manifest.version;
}

const otherArgument = process.argv[2];
if (otherArgument === undefined) {
  throw new Error('Uso: npm run mirror:check -- <caminho-do-outro-clone>');
}

const current = process.cwd();
const other = resolve(current, otherArgument);
assertRepository(current, 'O clone atual');
assertRepository(other, 'O outro clone');

const currentVersion = packageVersion(current);
const otherVersion = packageVersion(other);
if (currentVersion !== otherVersion) {
  throw new Error(`Versões divergentes: ${currentVersion} e ${otherVersion}.`);
}

const currentFiles = git(current, 'ls-files', '-z');
const otherFiles = git(other, 'ls-files', '-z');
if (currentFiles !== otherFiles) {
  throw new Error('As listas de arquivos rastreados dos clones são diferentes.');
}

const currentTree = git(current, 'rev-parse', 'HEAD^{tree}');
const otherTree = git(other, 'rev-parse', 'HEAD^{tree}');
if (currentTree !== otherTree) {
  throw new Error(`As árvores Git são diferentes: ${currentTree} e ${otherTree}.`);
}

process.stdout.write(
  `Espelho conferido: versão ${currentVersion}, árvore ${currentTree} e arquivos rastreados idênticos.\n`,
);
