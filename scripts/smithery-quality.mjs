const EXPECTED_TOOL_COUNT = 173;
const SMITHERY_OMITTED_ROOT_SCHEMA_FIELDS = new Set([
  '$schema',
  'additionalProperties',
  'description',
  'required',
]);

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJson(entry)]),
  );
}

function withoutSmitheryOmittedRootFields(schema) {
  return Object.fromEntries(
    Object.entries(schema).filter(([key]) => !SMITHERY_OMITTED_ROOT_SCHEMA_FIELDS.has(key)),
  );
}

function assertPublishedSchemaMatches(published, expected, label, toolName) {
  for (const field of SMITHERY_OMITTED_ROOT_SCHEMA_FIELDS) {
    if (!(field in published)) continue;
    assert(
      JSON.stringify(canonicalJson(published[field])) ===
        JSON.stringify(canonicalJson(expected[field])),
      `${label} divergente: ${toolName}.`,
    );
  }

  assert(
    JSON.stringify(canonicalJson(withoutSmitheryOmittedRootFields(published))) ===
      JSON.stringify(canonicalJson(withoutSmitheryOmittedRootFields(expected))),
    `${label} divergente: ${toolName}.`,
  );
}

function assertPublishedConfigSchemaMatches(published, expected) {
  assert(isObject(published?.properties), 'O schema de configuração publicado não possui campos.');
  const expectedProperties = Object.keys(expected.properties ?? {});
  const normalizedProperties = Object.fromEntries(
    Object.entries(published.properties).map(([name, property]) => {
      assert(isObject(property), `Configuração publicada inválida: ${name}.`);
      const expectedOrder = expectedProperties.indexOf(name);
      assert(expectedOrder >= 0, `Configuração publicada inesperada: ${name}.`);
      if ('x-order' in property) {
        assert(
          property['x-order'] === expectedOrder,
          `Ordem publicada divergente para a configuração ${name}.`,
        );
      }
      const contract = { ...property };
      delete contract['x-order'];
      return [name, contract];
    }),
  );
  const normalized = { ...published, properties: normalizedProperties };

  assert(
    JSON.stringify(canonicalJson(normalized)) === JSON.stringify(canonicalJson(expected)),
    'O schema de configuração publicado diverge do artefato.',
  );
}

function visitSchema(schema, path, visitor) {
  if (!isObject(schema)) return;
  visitor(schema, path);

  if (isObject(schema.properties)) {
    for (const [name, property] of Object.entries(schema.properties)) {
      visitSchema(property, `${path}.properties.${name}`, visitor);
    }
  }
  if (isObject(schema.items)) visitSchema(schema.items, `${path}.items`, visitor);
  if (isObject(schema.additionalProperties)) {
    visitSchema(schema.additionalProperties, `${path}.additionalProperties`, visitor);
  }
  if (isObject(schema.propertyNames)) {
    visitSchema(schema.propertyNames, `${path}.propertyNames`, visitor);
  }
  if (isObject(schema.not)) visitSchema(schema.not, `${path}.not`, visitor);
  for (const keyword of ['anyOf', 'oneOf', 'allOf']) {
    if (!Array.isArray(schema[keyword])) continue;
    schema[keyword].forEach((entry, index) =>
      visitSchema(entry, `${path}.${keyword}[${index}]`, visitor),
    );
  }
}

export function configSchemaFromManifest(manifest) {
  const properties = {};
  const required = [];

  for (const [name, field] of Object.entries(manifest.user_config ?? {})) {
    const type = field.type === 'directory' || field.type === 'file' ? 'string' : field.type;
    const metadata = {
      ...(field.title ? { title: field.title } : {}),
      ...(field.description ? { description: field.description } : {}),
      ...(field.default !== undefined ? { default: field.default } : {}),
      ...(field.sensitive ? { writeOnly: true } : {}),
    };
    properties[name] = field.multiple
      ? { type: 'array', items: { type }, ...metadata }
      : { type, ...metadata };
    if (field.required) required.push(name);
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

export function validateServerCard(card, expectedVersion) {
  assert(isObject(card), 'O Server Card deve ser um objeto.');
  assert(card.serverInfo?.name === 'mcp-server-efi', 'Nome incorreto no Server Card.');
  assert(card.serverInfo?.version === expectedVersion, 'Versão incorreta no Server Card.');
  assert(Array.isArray(card.tools), 'O Server Card não contém uma lista de tools.');
  assert(
    card.tools.length === EXPECTED_TOOL_COUNT,
    `O Server Card deve conter ${EXPECTED_TOOL_COUNT} tools; recebeu ${card.tools.length}.`,
  );

  const names = new Set();
  for (const tool of card.tools) {
    assert(typeof tool.name === 'string' && tool.name.length > 0, 'Tool sem nome no Server Card.');
    assert(!names.has(tool.name), `Tool duplicada no Server Card: ${tool.name}.`);
    names.add(tool.name);
    assert(
      typeof tool.title === 'string' && tool.title.length > 0,
      `${tool.name} não possui título.`,
    );
    assert(
      typeof tool.description === 'string' && tool.description.length > 0,
      `${tool.name} não possui descrição.`,
    );
    assert(tool.inputSchema?.type === 'object', `${tool.name} não possui inputSchema objeto.`);
    assert(tool.outputSchema?.type === 'object', `${tool.name} não possui outputSchema objeto.`);
    assert(isObject(tool.annotations), `${tool.name} não possui annotations.`);

    for (const [purpose, schema] of [
      ['inputSchema', tool.inputSchema],
      ['outputSchema', tool.outputSchema],
    ]) {
      visitSchema(schema, `${tool.name}.${purpose}`, (node, path) => {
        assert(
          typeof node.description === 'string' && node.description.trim().length > 0,
          `Nó de schema sem descrição: ${path}.`,
        );
      });
    }
  }

  const serialized = JSON.stringify(card);
  assert(!serialized.includes('contexto/'), 'O Server Card expõe um caminho de contexto interno.');
  assert(!serialized.includes('EFI_CLIENT_SECRET'), 'O Server Card expõe configuração secreta.');
  return card;
}

export function validateEmptyConfiguration(configSchema) {
  assert(configSchema?.type === 'object', 'O schema de configuração deve possuir raiz object.');
  assert(
    !Array.isArray(configSchema.required) || configSchema.required.length === 0,
    'O schema de configuração não deve exigir campos.',
  );
  assert(
    configSchema.additionalProperties === false,
    'O schema de configuração deve rejeitar propriedades desconhecidas.',
  );
  return configSchema;
}

export function validatePublishedServer(server, card, configSchema, expectedMetadata) {
  assert(server.qualifiedName === 'efipay/mcp-server-efi', 'Qualified name inesperado.');
  assert(server.displayName === expectedMetadata.displayName, 'Display name não sincronizado.');
  assert(server.description === expectedMetadata.description, 'Descrição não sincronizada.');
  assert(typeof server.iconUrl === 'string' && server.iconUrl.length > 0, 'Ícone não publicado.');
  assert(Array.isArray(server.tools), 'O cadastro publicado não retornou tools.');
  assert(server.tools.length === card.tools.length, 'O Smithery não publicou todas as tools.');

  const publishedByName = new Map(server.tools.map((tool) => [tool.name, tool]));
  assert(
    publishedByName.size === server.tools.length,
    'O cadastro publicado contém nomes de tools duplicados.',
  );
  for (const expected of card.tools) {
    const published = publishedByName.get(expected.name);
    assert(published, `Tool ausente no Smithery: ${expected.name}.`);
    assert(
      published.description === expected.description,
      `Descrição divergente: ${expected.name}.`,
    );
    assert(isObject(published.inputSchema), `Input schema ausente: ${expected.name}.`);
    assert(isObject(published.outputSchema), `Output schema ausente: ${expected.name}.`);
    // O GET público do Smithery omite estes metadados somente na raiz dos schemas.
    // Quando algum deles for devolvido, seu valor ainda deverá ser exatamente o enviado.
    assertPublishedSchemaMatches(
      published.inputSchema,
      expected.inputSchema,
      'Input schema',
      expected.name,
    );
    assertPublishedSchemaMatches(
      published.outputSchema,
      expected.outputSchema,
      'Output schema',
      expected.name,
    );
    for (const [purpose, schema] of [
      ['inputSchema', published.inputSchema],
      ['outputSchema', published.outputSchema],
    ]) {
      const rootPath = `${expected.name}.${purpose}`;
      visitSchema(schema, rootPath, (node, path) => {
        if (path === rootPath) return;
        assert(
          typeof node.description === 'string' && node.description.trim().length > 0,
          `Nó de schema publicado sem descrição: ${path}.`,
        );
      });
    }
  }

  const stdioConnection = server.connections?.find((connection) => connection.type === 'stdio');
  assert(stdioConnection, 'O cadastro não retornou uma conexão stdio.');
  assertPublishedConfigSchemaMatches(stdioConnection.configSchema, configSchema);
}

export const SMITHERY_EXPECTED_TOOL_COUNT = EXPECTED_TOOL_COUNT;
