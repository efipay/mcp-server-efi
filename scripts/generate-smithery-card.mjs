import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { API_GROUPS } from '../dist/src/catalog/index.js';
import { createServer } from '../dist/src/server/createServer.js';
import { validateServerCard } from './smithery-quality.mjs';

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const manifest = JSON.parse(readFileSync(resolve('manifest.json'), 'utf8'));
const output = resolve(
  argumentValue('--output') ?? `smithery-server-card-${manifest.version}.json`,
);

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const server = createServer({
  sdk: {
    sandbox: true,
    cert_base64: true,
    validateMtls: true,
    cache: true,
  },
  enabledApis: new Set(API_GROUPS),
});
const client = new Client({ name: 'smithery-card-generator', version: manifest.version });

try {
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const { tools } = await client.listTools();
  const serverInfo = client.getServerVersion();
  if (!serverInfo) throw new Error('O handshake MCP não retornou serverInfo.');

  const card = validateServerCard(
    {
      serverInfo,
      tools,
      // O formato estático do Smithery aceita Resource (uri), não ResourceTemplate
      // (uriTemplate). O template continua anunciado pelo protocolo MCP em runtime.
      resources: [],
      prompts: [],
    },
    manifest.version,
  );
  writeFileSync(output, `${JSON.stringify(card, undefined, 2)}\n`);
  process.stdout.write(`Server Card ${output} gerado com ${tools.length} tools.\n`);
} finally {
  await Promise.allSettled([client.close(), server.close()]);
}
