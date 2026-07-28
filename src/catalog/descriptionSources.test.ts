import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { descriptionSourceFor } from '../../scripts/descriptionSources.mjs';
import { TOOL_CATALOG } from './index.js';

describe('procedência das descrições', () => {
  it('mantém uma referência documental para cada método fora do catálogo MCP', () => {
    const developmentContextIsAvailable = existsSync('contexto');

    for (const tool of TOOL_CATALOG) {
      const source = descriptionSourceFor(tool.method, tool.api);
      expect(source.resourceDoc).toMatch(/^contexto\/docs\//);
      if (developmentContextIsAvailable) {
        expect(existsSync(source.resourceDoc), source.resourceDoc).toBe(true);
      }
      if (source.operationDoc !== undefined) {
        expect(source.operationDoc).toMatch(/^contexto\/markdown\//);
        if (developmentContextIsAvailable) {
          expect(existsSync(source.operationDoc), source.operationDoc).toBe(true);
        }
      }
      expect(tool).not.toHaveProperty('context');
    }
  });
});
