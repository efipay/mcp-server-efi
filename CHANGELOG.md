# Changelog

## 1.0.2 — 2026-07-31

- Os contratos públicos acompanham automaticamente as atualizações compatíveis do `sdk-node-apis-efi` 2.x via dependabot.

## 1.0.1 — 2026-07-29

- Inicialização e descoberta das 173 tools sem exigir credenciais.
- Validação de autenticação e certificado sob demanda, antes de qualquer chamada HTTP.
- Server Card completo, parâmetros descritos e output estruturado para comprovantes PDF.
- Configuração MCPB opcional, metadados públicos e ícone Efí sincronizados no Smithery.
- Publicador Smithery controlado e pós-validação semântica dos contratos publicados.

## 1.0.0 — 2026-07-27

- Cobertura dos 173 métodos públicos de `sdk-node-apis-efi@2.0.0`, com contratos Zod oficiais.
- Catálogo declarativo por domínio, overloads tipados e exposição MCP interoperável.
- Descrições PT-BR derivadas da documentação Efí sem alterar contratos.
- Comprovantes Pix como Resources PDF e QR Code com conteúdo estruturado.
- Verificação da assinatura JWS em `pix_qr_code_detail`, incluindo correspondência de origem do `jku`.
- Saídas de certificados, credenciais e chaves privadas ocultas por padrão e habilitadas somente por allowlist com aceite explícito.
- Idempotência Open Finance por operação, com geração criptográfica quando omitida.
- Sanitização defensiva de erros, limites de concorrência e taxas configuráveis.
- Distribuição definitiva via npm, imagem GHCR, GitHub Release e bundle MCPB 0.3 no Smithery.
- Node.js 22, Docker sem root fixado por digest, SBOM, proveniência e gates de auditoria do artefato consumidor.
