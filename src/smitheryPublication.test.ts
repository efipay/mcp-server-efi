import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { API_GROUPS } from './catalog/index.js';
import { createServer } from './server/createServer.js';

interface JsonSchema {
  type: string;
  properties: Record<string, Record<string, unknown>>;
  additionalProperties: boolean;
}

interface ServerCard {
  serverInfo: { name: string; version: string };
  tools: Array<Record<string, any>>;
}

interface PublishOptions {
  bundlePath: string;
  cardPath: string;
  apiKey: string;
  qualifiedName: string;
  apiBase: string;
  timeoutMs: number;
  pollIntervalMs: number;
  fetchImpl: typeof fetch;
}

type PublishSmithery = (options: PublishOptions) => Promise<{
  deploymentId: string;
  toolCount: number;
}>;

const temporary = mkdtempSync(join(tmpdir(), 'mcp-smithery-test-'));
const cardPath = join(temporary, 'server-card.json');
const bundlePath = join(temporary, 'server.mcpb');
let card: ServerCard;
let publishSmithery: PublishSmithery;

function configurationSchema(): JsonSchema {
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as Record<string, any>;
  return {
    type: 'object',
    properties: Object.fromEntries(
      Object.entries(manifest.user_config).map(([name, raw]) => {
        const field = raw as Record<string, unknown>;
        return [
          name,
          {
            type: field.type,
            ...(field.title ? { title: field.title } : {}),
            ...(field.description ? { description: field.description } : {}),
            ...(field.default !== undefined ? { default: field.default } : {}),
            ...(field.sensitive ? { writeOnly: true } : {}),
          },
        ];
      }),
    ),
    additionalProperties: false,
  };
}

async function runtimeTools() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({
    sdk: { sandbox: true, cert_base64: true, validateMtls: true, cache: true },
    enabledApis: new Set(API_GROUPS),
  });
  const client = new Client({ name: 'smithery-test', version: '1.0.1' });
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    return (await client.listTools()).tools;
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
}

function smitheryFetch(
  releaseStatus: 'SUCCESS' | 'FAILURE' | 'WORKING',
  alterPublishedSchema = false,
) {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const schema = configurationSchema();
  const publishedConfigSchema = structuredClone(schema);
  Object.values(publishedConfigSchema.properties).forEach((property, index) => {
    property['x-order'] = index;
  });
  const smitherySchema = (source: Record<string, unknown>) => {
    const normalized = structuredClone(source);
    delete normalized.$schema;
    delete normalized.additionalProperties;
    delete normalized.description;
    delete normalized.required;
    return normalized;
  };
  const tools = card.tools.map(({ name, description, inputSchema, outputSchema }) => ({
    name,
    description,
    inputSchema: smitherySchema(inputSchema),
    outputSchema: smitherySchema(outputSchema),
  }));
  if (alterPublishedSchema) {
    tools[0] = { ...tools[0], outputSchema: { type: 'object', properties: {} } };
  }
  const metadata = {
    qualifiedName: 'efipay/mcp-server-efi',
    displayName: 'Servidor MCP Efí',
    description: 'Acesso tipado às APIs da Efí por meio do Model Context Protocol.',
    iconUrl: 'https://github.com/efipay.png?size=512',
    tools,
    resources: [],
    prompts: [],
    connections: [
      {
        type: 'stdio',
        bundleUrl: 'https://example.test/server.mcpb',
        configSchema: publishedConfigSchema,
      },
    ],
  };

  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (init?.method === 'PATCH') {
      return new Response('{"success":true}', { status: 200 });
    }
    if (init?.method === 'PUT') {
      return new Response('{"deploymentId":"deployment-1","status":"WORKING"}', {
        status: 202,
      });
    }
    if (url.endsWith('/releases/deployment-1')) {
      return new Response(JSON.stringify({ id: 'deployment-1', status: releaseStatus, logs: [] }), {
        status: 200,
      });
    }
    return new Response(JSON.stringify(metadata), { status: 200 });
  });
  return { fetchImpl, requests };
}

function publishOptions(fetchImpl: typeof fetch, timeoutMs = 500): PublishOptions {
  return {
    bundlePath,
    cardPath,
    apiKey: 'smithery-test-secret',
    qualifiedName: 'efipay/mcp-server-efi',
    apiBase: 'https://smithery.test',
    timeoutMs,
    pollIntervalMs: 5,
    fetchImpl,
  };
}

beforeAll(async () => {
  const build = spawnSync('npm', ['run', 'build', '--silent'], { encoding: 'utf8' });
  expect(build.status, build.stderr).toBe(0);
  const generated = spawnSync(
    process.execPath,
    [resolve('scripts/generate-smithery-card.mjs'), '--output', cardPath],
    { encoding: 'utf8' },
  );
  expect(generated.status, generated.stderr).toBe(0);
  card = JSON.parse(readFileSync(cardPath, 'utf8')) as ServerCard;
  writeFileSync(bundlePath, 'MCPB fixture');

  const libraryPath = new URL('../scripts/publish-smithery-lib.mjs', import.meta.url).href;
  const library = (await import(libraryPath)) as { publishSmithery: PublishSmithery };
  publishSmithery = library.publishSmithery;
}, 30_000);

afterAll(() => {
  rmSync(temporary, { recursive: true, force: true });
});

describe('Server Card e publicação Smithery', () => {
  it('gera o Server Card por handshake e mantém igualdade profunda com tools/list', async () => {
    expect(card.tools).toHaveLength(173);
    expect(card.tools).toEqual(await runtimeTools());
    expect(card.tools.every((tool) => tool.outputSchema && tool.annotations)).toBe(true);
    expect(JSON.stringify(card)).not.toMatch(/contexto\/|EFI_CLIENT_SECRET/);
  });

  it('publica bundle e card e aceita somente a normalização de raiz feita pelo Smithery', async () => {
    const { fetchImpl, requests } = smitheryFetch('SUCCESS');
    const result = await publishSmithery(publishOptions(fetchImpl));
    expect(result).toMatchObject({ deploymentId: 'deployment-1', toolCount: 173 });

    const patch = requests.find(({ init }) => init?.method === 'PATCH');
    const upload = requests.find(({ init }) => init?.method === 'PUT');
    expect(JSON.parse(String(patch?.init?.body))).toMatchObject({
      displayName: 'Servidor MCP Efí',
      description: 'Acesso tipado às APIs da Efí por meio do Model Context Protocol.',
      homepage: 'https://github.com/efipay/mcp-server-efi',
      repositoryUrl: 'https://github.com/efipay/mcp-server-efi.git',
      license: 'MIT',
      iconUrl: 'https://github.com/efipay.png?size=512',
      unlisted: false,
    });

    const form = upload?.init?.body as FormData;
    const payload = JSON.parse(String(form.get('payload'))) as Record<string, any>;
    expect(payload).toMatchObject({
      type: 'stdio',
      runtime: 'node',
      serverCard: { tools: expect.arrayContaining([expect.any(Object)]) },
      configSchema: { type: 'object', additionalProperties: false },
    });
    expect(payload.serverCard.tools).toHaveLength(173);
    expect(payload.configSchema.required).toBeUndefined();
    expect(form.get('bundle')).toBeInstanceOf(Blob);
  });

  it('falha quando a release termina sem sucesso', async () => {
    const { fetchImpl } = smitheryFetch('FAILURE');
    await expect(publishSmithery(publishOptions(fetchImpl))).rejects.toThrow(/status FAILURE/);
  });

  it('falha por timeout enquanto a release permanece em processamento', async () => {
    const { fetchImpl } = smitheryFetch('WORKING');
    await expect(publishSmithery(publishOptions(fetchImpl, 20))).rejects.toThrow(
      /Timeout aguardando/,
    );
  });

  it('rejeita um contrato publicado que diverge do Server Card auditado', async () => {
    const { fetchImpl } = smitheryFetch('SUCCESS', true);
    await expect(publishSmithery(publishOptions(fetchImpl))).rejects.toThrow(
      /Output schema divergente/,
    );
  });

  it('remove a chave da mensagem de erro HTTP do Smithery', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response('smithery-test-secret', { status: 401 }),
    );
    await expect(publishSmithery(publishOptions(fetchImpl))).rejects.toThrow(
      /HTTP 401.*\[REDACTED\]/,
    );
  });
});
