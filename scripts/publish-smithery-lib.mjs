import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import {
  configSchemaFromManifest,
  validateEmptyConfiguration,
  validatePublishedServer,
  validateServerCard,
} from './smithery-quality.mjs';

const WORKING_STATUSES = new Set(['QUEUED', 'WORKING']);
const SUCCESS_STATUS = 'SUCCESS';

function redact(value, secret) {
  return String(value).split(secret).join('[REDACTED]');
}

async function responseBody(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function requestJson(fetchImpl, url, init, secret) {
  const response = await fetchImpl(url, init);
  const body = await responseBody(response);
  if (!response.ok) {
    throw new Error(
      redact(
        `Smithery respondeu HTTP ${response.status}: ${JSON.stringify(body).slice(0, 4000)}`,
        secret,
      ),
    );
  }
  return body;
}

export async function publishSmithery({
  bundlePath,
  cardPath,
  apiKey,
  qualifiedName = 'efipay/mcp-server-efi',
  apiBase = 'https://api.smithery.ai',
  timeoutMs = 10 * 60 * 1000,
  pollIntervalMs = 5000,
  fetchImpl = globalThis.fetch,
  manifestPath = 'manifest.json',
}) {
  if (!apiKey) throw new Error('SMITHERY_API_KEY não foi configurada.');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('timeoutMs deve ser um inteiro positivo.');
  }
  if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs <= 0) {
    throw new Error('pollIntervalMs deve ser um inteiro positivo.');
  }

  const manifest = JSON.parse(readFileSync(resolve(manifestPath), 'utf8'));
  const resolvedCard = resolve(cardPath);
  const resolvedBundle = resolve(bundlePath);
  const card = validateServerCard(JSON.parse(readFileSync(resolvedCard, 'utf8')), manifest.version);
  const bundle = readFileSync(resolvedBundle);
  const configSchema = validateEmptyConfiguration(configSchemaFromManifest(manifest));
  const encodedName = encodeURIComponent(qualifiedName);
  const normalizedBase = apiBase.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${apiKey}` };
  const metadata = {
    displayName: manifest.display_name,
    description: manifest.description,
    homepage: manifest.homepage,
    repositoryUrl: manifest.repository.url,
    backlinkUrl: `${manifest.homepage}#smithery`,
    license: manifest.license,
    iconUrl: 'https://github.com/efipay.png?size=512',
    unlisted: false,
  };

  await requestJson(
    fetchImpl,
    `${normalizedBase}/servers/${encodedName}`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    },
    apiKey,
  );

  const form = new globalThis.FormData();
  form.append(
    'payload',
    JSON.stringify({
      type: 'stdio',
      runtime: 'node',
      serverCard: card,
      configSchema,
    }),
  );
  form.append(
    'bundle',
    new globalThis.Blob([bundle], { type: 'application/octet-stream' }),
    basename(resolvedBundle),
  );

  const deployment = await requestJson(
    fetchImpl,
    `${normalizedBase}/servers/${encodedName}/releases`,
    { method: 'PUT', headers, body: form },
    apiKey,
  );
  if (typeof deployment.deploymentId !== 'string') {
    throw new Error('O Smithery não retornou deploymentId.');
  }

  const deadline = Date.now() + timeoutMs;
  let release;
  let finished = false;
  do {
    release = await requestJson(
      fetchImpl,
      `${normalizedBase}/servers/${encodedName}/releases/${encodeURIComponent(deployment.deploymentId)}`,
      { headers },
      apiKey,
    );
    if (release.status === SUCCESS_STATUS) {
      finished = true;
      continue;
    }
    if (!WORKING_STATUSES.has(release.status)) {
      throw new Error(
        redact(
          `A publicação no Smithery terminou com status ${String(release.status)}: ` +
            `${JSON.stringify(release.logs ?? []).slice(0, 4000)}`,
          apiKey,
        ),
      );
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timeout aguardando a release ${deployment.deploymentId} no Smithery.`);
    }
    await wait(Math.min(pollIntervalMs, Math.max(1, deadline - Date.now())));
  } while (!finished);

  const publishedServer = await requestJson(
    fetchImpl,
    `${normalizedBase}/servers/${encodedName}`,
    { headers },
    apiKey,
  );
  validatePublishedServer(publishedServer, card, configSchema, metadata);

  return {
    deploymentId: deployment.deploymentId,
    toolCount: card.tools.length,
    release,
  };
}
