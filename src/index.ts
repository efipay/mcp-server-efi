#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ConfigurationError, helpText, loadRuntimeConfig } from './config/runtime.js';
import { createServer } from './server/createServer.js';

async function main(): Promise<void> {
  const runtime = loadRuntimeConfig();
  const server = createServer(runtime);
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  if (error instanceof ConfigurationError && error.message === 'HELP') {
    process.stdout.write(`${helpText()}\n`);
    process.exitCode = 0;
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Falha ao iniciar o servidor MCP: ${message}\n`);
  process.exitCode = 1;
});
