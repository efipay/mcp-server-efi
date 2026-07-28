import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const EXPECTED_PACKAGE_NAME = 'mcp-server-efi';

function deriveReleaseMetadata(manifest, tag) {
  if (manifest.name !== EXPECTED_PACKAGE_NAME) {
    throw new Error(`Nome de pacote inesperado: ${String(manifest.name)}.`);
  }
  if (typeof manifest.version !== 'string' || !STABLE_SEMVER.test(manifest.version)) {
    throw new Error(
      `A versão ${String(manifest.version)} não é um SemVer estável no formato MAJOR.MINOR.PATCH.`,
    );
  }

  const expectedTag = `v${manifest.version}`;
  if (tag !== expectedTag) {
    throw new Error(`A tag ${tag} não corresponde à versão do pacote ${expectedTag}.`);
  }

  return {
    version: manifest.version,
    package_file: `${EXPECTED_PACKAGE_NAME}-${manifest.version}.tgz`,
    mcpb_file: `${EXPECTED_PACKAGE_NAME}-${manifest.version}.mcpb`,
  };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function appendVariables(path, variables) {
  if (path === undefined) {
    return;
  }
  appendFileSync(
    resolve(path),
    `${Object.entries(variables)
      .map(([name, value]) => `${name}=${value}`)
      .join('\n')}\n`,
  );
}

const manifest = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const tag = argumentValue('--tag') ?? process.env.GITHUB_REF_NAME;
const metadata = deriveReleaseMetadata(manifest, tag);

appendVariables(argumentValue('--github-output'), metadata);
appendVariables(argumentValue('--github-env'), {
  VERSION: metadata.version,
  PACKAGE_FILE: metadata.package_file,
  MCPB_FILE: metadata.mcpb_file,
});
process.stdout.write(`${JSON.stringify(metadata)}\n`);
