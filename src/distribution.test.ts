import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadRuntimeConfig } from './config/runtime.js';
import { SERVER_INFO } from './server/createServer.js';

const read = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

interface PackageManifest {
  version: string;
  repository: { type: string; url: string };
  homepage: string;
  bugs: { url: string };
  bin: Record<string, string>;
  scripts: Record<string, string>;
  files: string[];
  engines: { node: string };
  overrides: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  publishConfig: Record<string, unknown>;
}

interface PackageLock {
  version: string;
  packages: Record<string, { version?: string }>;
}

describe('distribuição', () => {
  it('mantém versão, Node e entrypoint sincronizados', () => {
    const packageJson = JSON.parse(read('package.json')) as PackageManifest;
    const packageLock = JSON.parse(read('package-lock.json')) as PackageLock;
    const mcpb = JSON.parse(read('manifest.json')) as Record<string, any>;
    const dockerfile = read('Dockerfile');
    const mcpExample = read('mcp.jsonc');

    expect(SERVER_INFO.version).toBe(packageJson.version);
    expect(packageLock.version).toBe(packageJson.version);
    expect(packageLock.packages['']?.version).toBe(packageJson.version);
    expect(packageJson.engines.node).toBe('>=22');

    expect(packageJson.bin['mcp-server-efi']).toBe('dist/src/index.js');
    expect(packageJson.scripts.start).toContain('dist/src/index.js');
    expect(mcpb.manifest_version).toBe('0.3');
    expect(mcpb.version).toBe(packageJson.version);
    expect(mcpb.icon).toBe('icon.svg');
    expect(existsSync(resolve(process.cwd(), 'assets/icon.svg'))).toBe(true);
    expect(mcpb.server.entry_point).toBe('dist/src/index.js');
    expect(mcpb.server.mcp_config.args).toEqual(['${__dirname}/dist/src/index.js']);
    expect(existsSync(resolve(process.cwd(), 'smithery.yaml'))).toBe(false);
    expect(mcpExample).toContain('/dist/src/index.js');
    expect(dockerfile).toContain('ENTRYPOINT ["node", "dist/src/index.js"]');

    expect(dockerfile.match(/^FROM node:22-alpine@sha256:[a-f0-9]{64}/gm)).toHaveLength(2);
    expect(dockerfile).toMatch(/^FROM node:22-alpine@sha256:[a-f0-9]{64} AS builder$/m);
    expect(dockerfile).toMatch(/^FROM node:22-alpine@sha256:[a-f0-9]{64} AS release$/m);
    expect(dockerfile).toContain('ARG VERSION=development');
    expect(dockerfile).toContain('org.opencontainers.image.version="${VERSION}"');
    expect(dockerfile).toMatch(/^USER node$/m);
    expect(dockerfile).toContain('rm -rf /usr/local/lib/node_modules/npm');
    expect(dockerfile).toContain('rm -rf /usr/local/lib/node_modules/corepack');
    expect(dockerfile).toContain('rm -rf /opt/yarn-v1.22.22');
    expect(dockerfile).toContain('rm -f /usr/local/bin/npm /usr/local/bin/npx');
  });

  it('publica somente o runtime compilado e os metadados padrão do npm', () => {
    const packageJson = JSON.parse(read('package.json')) as PackageManifest;
    const mcpb = JSON.parse(read('manifest.json')) as Record<string, any>;
    const dockerfile = read('Dockerfile');

    // README, LICENSE e package.json são incluídos automaticamente pelo npm.
    // O único caminho adicional autorizado é o runtime em dist.
    expect(packageJson.files).toEqual(['dist']);
    expect(packageJson.repository.url).toBe('git+https://github.com/efipay/mcp-server-efi.git');
    expect(packageJson.homepage).toBe('https://github.com/efipay/mcp-server-efi#readme');
    expect(packageJson.bugs.url).toBe('https://github.com/efipay/mcp-server-efi/issues');
    expect(mcpb.repository.url).toBe('https://github.com/efipay/mcp-server-efi.git');
    expect(dockerfile).toContain(
      'org.opencontainers.image.source="https://github.com/efipay/mcp-server-efi"',
    );
  });

  it('preserva as intenções dos commits pessoais de configuração, documentação e npx', () => {
    const packageJson = JSON.parse(read('package.json')) as PackageManifest;
    const entrypoint = read('src/index.ts');
    const readme = read('README.md');
    const mcpExample = read('mcp.jsonc');

    expect(entrypoint.startsWith('#!/usr/bin/env node\n')).toBe(true);
    expect(packageJson.bin['mcp-server-efi']).toBe('dist/src/index.js');
    expect(readme).toContain('npx -y mcp-server-efi');
    expect(readme).toContain('"command": "npx"');
    expect(mcpExample).toContain('"EFI_CLIENT_ID"');
    expect(mcpExample).toContain('"EFI_CLIENT_SECRET"');
    expect(mcpExample).not.toMatch(/--client-id|--client-secret|--certificate/);
  });

  it('fixa dependências de runtime e mantém somente o override Hono documentado', () => {
    const packageJson = JSON.parse(read('package.json')) as PackageManifest;
    const packageLock = JSON.parse(read('package-lock.json')) as PackageLock;

    expect(packageJson.overrides).toEqual({ '@hono/node-server': '2.0.11' });
    expect(packageLock.packages['node_modules/@hono/node-server']?.version).toBe('2.0.11');
    expect(packageLock.packages['node_modules/brace-expansion']?.version).toBe('5.0.8');
    expect(packageJson.dependencies).toMatchObject({
      '@modelcontextprotocol/sdk': '1.29.0',
      jose: '6.2.4',
      'pix-qr-code-detail': '1.2.0',
      'sdk-node-apis-efi': '2.0.0',
      zod: '4.4.3',
    });
    expect(packageJson.devDependencies).toMatchObject({
      '@vitest/coverage-v8': '4.1.10',
      eslint: '10.8.0',
      prettier: '3.9.6',
      'typescript-eslint': '8.65.0',
      vitest: '4.1.10',
    });
    expect(packageJson.publishConfig).toEqual({ access: 'public', provenance: true });
  });

  it('não transporta material secreto em argumentos públicos', () => {
    const publicConfiguration = [
      read('README.md'),
      read('mcp.jsonc'),
      read('Dockerfile'),
      read('manifest.json'),
    ].join('\n');

    expect(publicConfiguration).not.toMatch(
      /--(?:client-id|client-secret|certificate|pem-key|partner-token|idempotency-key)(?:=|\b)/,
    );

    const mcpb = read('manifest.json');
    for (const variable of [
      'EFI_CLIENT_ID',
      'EFI_CLIENT_SECRET',
      'EFI_CERTIFICATE',
      'EFI_PEM_KEY',
      'EFI_PARTNER_TOKEN',
      'EFI_SENSITIVE_TOOLS',
      'EFI_ACCEPT_SENSITIVE_OUTPUT_RISK',
    ]) {
      expect(mcpb).toContain(variable);
    }
    expect(mcpb).not.toContain('EFI_IDEMPOTENCY_KEY');
    const parsed = JSON.parse(mcpb) as Record<string, any>;
    expect(parsed.user_config.client_id.sensitive).toBe(true);
    expect(parsed.user_config.client_secret.sensitive).toBe(true);
    expect(parsed.user_config.certificate.sensitive).toBe(true);
    expect(parsed.user_config.certificate.required).toBe(false);
    expect(
      Object.values(parsed.user_config).every(
        (field) => (field as { required?: boolean }).required !== true,
      ),
    ).toBe(true);
    expect(parsed.user_config.apis.default).toBe(
      'cobrancas,pix,open-finance,pagamento-contas,abertura-contas,extratos',
    );
  });

  it('aceita configuração MCPB vazia e habilita todos os domínios', () => {
    const mcpb = JSON.parse(read('manifest.json')) as Record<string, any>;
    const configuration = loadRuntimeConfig([], mcpb.server.mcp_config.env as NodeJS.ProcessEnv);
    expect([...configuration.enabledApis]).toEqual([
      'cobrancas',
      'pix',
      'open-finance',
      'pagamento-contas',
      'abertura-contas',
      'extratos',
    ]);
    expect(configuration.sdk.certificate).toBeUndefined();
    expect(configuration.sdk.client_id).toBeUndefined();
    expect(configuration.sdk.client_secret).toBeUndefined();
  });

  it('mantém no CI todos os gates de distribuição e segurança', () => {
    const workflow = read('.github/workflows/ci.yml');

    expect(workflow).toMatch(/^\s*run: npm ci$/m);
    expect(workflow).toMatch(/^\s*run: npm run check$/m);
    expect(workflow).toMatch(/^\s*run: npm run build$/m);
    expect(workflow).toContain('npm start -- --help');
    expect(workflow).toContain('npm pack --dry-run --ignore-scripts');
    expect(workflow).toContain('node_modules/.bin/mcp-server-efi');
    expect(workflow).toContain('npm run audit:artifact -- "./$PACKAGE_FILE"');
    expect(workflow).toContain('npm run mcpb:pack');
    expect(workflow).toContain('test "$PACKAGE_FILE" = "mcp-server-efi-$VERSION.tgz"');
    expect(workflow).toContain('MCPB_FILE="mcp-server-efi-$VERSION.mcpb"');
    expect(workflow).toContain('SERVER_CARD_FILE="smithery-server-card-$VERSION.json"');
    expect(workflow).toContain("grep -F 'icon.svg'");
    expect(workflow).not.toContain('mcp-server-efi-1.0.0');
    expect(workflow).toMatch(/NODE_TLS_REJECT_UNAUTHORIZED: ['"]1['"]/);
    expect(workflow).toMatch(/npm_config_strict_ssl: ['"]true['"]/);

    expect(workflow).toContain(
      'docker build --build-arg VERSION="${{ needs.quality.outputs.version }}" --tag mcp-server-efi:test .',
    );
    expect(workflow).toContain("--format '{{.Config.User}}'");
    expect(workflow).toContain('docker run --rm mcp-server-efi:test --help');
    expect(workflow).toContain('test ! -e /usr/local/lib/node_modules/npm');
    expect(workflow).toContain('test ! -e /usr/local/bin/corepack');
    expect(workflow).toContain('scanners: vuln');
  });

  it('mantém o release restrito ao repositório Efí e com permissões por job', () => {
    const workflow = read('.github/workflows/release.yml');
    const jobNames = [
      'preflight',
      'publish-ghcr',
      'publish-npm',
      'publish-smithery',
      'github-release',
    ];

    expect(workflow).toContain("- 'v*.*.*'");
    expect(workflow).not.toContain("- 'v1.0.0'");
    expect(workflow).toContain('node scripts/release-metadata.mjs');
    expect(workflow).toContain('--github-output "$GITHUB_OUTPUT"');
    expect(workflow).toContain('--github-env "$GITHUB_ENV"');
    expect(workflow.match(/if: github\.repository == 'efipay\/mcp-server-efi'/g)).toHaveLength(
      jobNames.length,
    );
    expect(workflow).toMatch(/^permissions: \{\}$/m);
    expect(workflow).not.toContain('cache: npm');

    expect(workflow).toMatch(
      /preflight:[\s\S]*?permissions:\n\s+contents: read[\s\S]*?publish-ghcr:/,
    );
    expect(workflow).toMatch(
      /publish-ghcr:[\s\S]*?permissions:\n\s+contents: read\n\s+packages: write\n\s+id-token: write[\s\S]*?publish-npm:/,
    );
    expect(workflow).toMatch(
      /publish-npm:[\s\S]*?permissions:\n\s+id-token: write\n\s+environment: production/,
    );
    expect(workflow).toMatch(/publish-smithery:[\s\S]*?permissions: \{\}/);
    expect(workflow).toContain('SMITHERY_API_KEY');
    expect(workflow).toContain('node scripts/publish-smithery.mjs');
    expect(workflow).toContain('--server-card "./$SERVER_CARD_FILE"');
    expect(workflow).not.toContain('smithery@1.2.0 mcp publish');
    expect(workflow).toContain('--tag "$IMAGE:$VERSION"');
    expect(workflow).toContain('--title "mcp-server-efi $VERSION"');
    expect(workflow).not.toContain('mcp-server-efi-1.0.0.tgz');
    expect(workflow).not.toContain('mcp-server-efi-1.0.0.mcpb');
    expect(workflow).toMatch(/github-release:[\s\S]*?permissions:\n\s+contents: write/);
    expect(workflow).toContain('actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10');
    expect(workflow).toContain('actions/setup-node@820762786026740c76f36085b0efc47a31fe5020');
    expect(workflow).toContain('docker/login-action@abd2ef45e78c5afb21d64d4ca52ee8550d9572c7');
    expect(workflow).toContain(
      'docker/setup-buildx-action@bb05f3f5519dd87d3ba754cc423b652a5edd6d2c',
    );
    expect(workflow).toContain('docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a');
    expect(workflow.match(/^\s+version: v0\.72\.0$/gm)).toHaveLength(2);
    expect(workflow).not.toContain('trivy-version:');
  });

  it('publica e anexa exatamente os artefatos auditados e conferidos por checksum', () => {
    const workflow = read('.github/workflows/release.yml');

    expect(workflow.match(/npm pack --ignore-scripts --pack-destination \./g)).toHaveLength(1);
    expect(workflow).not.toContain('npm pack --ignore-scripts --json');
    expect(workflow).toContain('test -f "$PACKAGE_FILE"');
    expect(workflow).toContain('npm run audit:artifact -- "./$PACKAGE_FILE"');
    expect(workflow).toContain('npm publish "./$PACKAGE_FILE" --access public --provenance');
    expect(workflow).toContain('"release-artifacts/$PACKAGE_FILE"');
    expect(workflow).toContain('"release-artifacts/$MCPB_FILE"');
    expect(workflow).toContain('"release-artifacts/$SERVER_CARD_FILE"');
    expect(workflow).toContain('"release-artifacts/$SBOM_FILE"');
    expect(workflow).toContain('"release-artifacts/SHA256SUMS"');
    expect(workflow.match(/sha256sum --check SHA256SUMS/g)).toHaveLength(4);
    expect(workflow).toContain('actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a');
    expect(workflow).toContain(
      'actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131',
    );
  });

  it('exige as duas assinaturas SSH e árvores idênticas antes de qualquer deploy', () => {
    const workflow = read('.github/workflows/release.yml');

    expect(workflow).toContain('test -s .github/allowed_signers');
    expect(workflow).toContain('git config gpg.format ssh');
    expect(workflow).toContain('git verify-tag --raw "$GITHUB_REF_NAME"');
    expect(workflow).toContain('https://github.com/JoaoLucasAl/mcp-server-efi.git');
    expect(workflow).toContain('git verify-tag --raw "$PERSONAL_TAG"');
    expect(workflow).toContain('joao.muniz@gerencianet.com.br');
    expect(workflow).toContain('joaolucas.power@gmail.com');
    expect(workflow).toContain('git rev-parse "$GITHUB_REF_NAME^{tree}"');
    expect(workflow).toContain('git rev-parse "$PERSONAL_TAG^{tree}"');
    expect(workflow).toContain("if: github.repository == 'efipay/mcp-server-efi'");
  });

  it('recupera apenas o GitHub Release a partir de um artifact imutável da tag', () => {
    const workflow = read('.github/workflows/recover-release.yml');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain("if: github.repository == 'efipay/mcp-server-efi'");
    expect(workflow).toMatch(/^permissions: \{\}$/m);
    expect(workflow).toMatch(
      /recover-release:[\s\S]*?permissions:\n\s+actions: read\n\s+contents: write/,
    );
    expect(workflow).toContain('environment: production');
    expect(workflow).toContain('[[ "$SOURCE_RUN_ID" =~ ^[1-9][0-9]*$ ]]');
    expect(workflow).toContain('git verify-tag --raw "$RELEASE_TAG"');
    expect(workflow).toContain('git rev-parse "$PERSONAL_TAG^{tree}"');
    expect(workflow).toContain('test "$(jq -r \'.event\' <<<"$RUN_JSON")" = push');
    expect(workflow).toContain('test "$(jq -r \'.head_branch\' <<<"$RUN_JSON")"');
    expect(workflow).toContain('test "$PREFLIGHT_CONCLUSION" = success');
    expect(workflow).toContain(
      'actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131',
    );
    expect(workflow).toContain('run-id: ${{ inputs.source_run_id }}');
    expect(workflow).toContain('sha256sum --check SHA256SUMS');
    expect(workflow).not.toContain('ARTIFACT_DIR: ${{ runner.temp }}');
    expect(workflow).toContain('$RUNNER_TEMP/release-artifacts/$PACKAGE_FILE');
    expect(workflow).toContain('gh release create "$RELEASE_TAG"');
    expect(workflow).toContain('gh release verify-asset "$RELEASE_TAG"');
    expect(workflow).not.toContain('npm publish');
    expect(workflow).not.toContain('docker build');
    expect(workflow).not.toContain('publish-smithery');
  });
});
