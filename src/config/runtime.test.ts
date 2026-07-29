import { describe, expect, it } from 'vitest';
import { ConfigurationError, helpText, loadRuntimeConfig } from './runtime.js';

const baseEnv = {
  EFI_SANDBOX: 'true',
  EFI_CLIENT_ID: 'id',
  EFI_CLIENT_SECRET: 'secret',
  EFI_CERTIFICATE: 'certificate',
};

describe('configuração de runtime', () => {
  it('habilita todas as APIs por padrão', () => {
    const config = loadRuntimeConfig([], baseEnv);
    expect(config.enabledApis.size).toBe(6);
    expect(config.sdk.cert_base64).toBe(true);
    expect(config.sdk.validateMtls).toBe(true);
    expect(config.sdk.cache).toBe(true);
  });

  it('inicia com ambiente vazio e aplica defaults seguros', () => {
    const config = loadRuntimeConfig([], {});

    expect([...config.enabledApis]).toHaveLength(6);
    expect(config.sdk).toMatchObject({
      sandbox: true,
      cert_base64: true,
      validateMtls: true,
      cache: true,
    });
    expect(config.sdk.client_id).toBeUndefined();
    expect(config.sdk.client_secret).toBeUndefined();
    expect(config.sdk.certificate).toBeUndefined();
  });

  it('trata placeholders MCPB opcionais não resolvidos como valores ausentes', () => {
    const config = loadRuntimeConfig([], {
      EFI_CLIENT_ID: '${user_config.client_id}',
      EFI_CLIENT_SECRET: '${user_config.client_secret}',
      EFI_CERTIFICATE: '${user_config.certificate}',
      EFI_SANDBOX: '${user_config.sandbox}',
      EFI_APIS: '${user_config.apis}',
      EFI_CERT_BASE64: '${user_config.cert_base64}',
      EFI_VALIDATE_MTLS: '${user_config.validate_mtls}',
      EFI_CACHE: '${user_config.cache}',
    });

    expect(config.sdk).toMatchObject({
      sandbox: true,
      cert_base64: true,
      validateMtls: true,
      cache: true,
    });
    expect(config.sdk.client_id).toBeUndefined();
    expect(config.sdk.client_secret).toBeUndefined();
    expect(config.sdk.certificate).toBeUndefined();
    expect(config.enabledApis.size).toBe(6);
  });

  it('aplica precedência CLI, EFI_* e variável legada somente às opções não secretas', () => {
    const config = loadRuntimeConfig(
      [
        '--sandbox=false',
        '--apis=cobrancas',
        '--cert-base64=false',
        '--validate-mtls=false',
        '--cache=false',
      ],
      {
        ...baseEnv,
        EFI_SANDBOX: 'true',
        SANDBOX: 'true',
        EFI_APIS: 'pix',
        APIS: 'extratos',
        EFI_CERT_BASE64: 'true',
        CERT_BASE64: 'true',
        EFI_VALIDATE_MTLS: 'true',
        VALIDATE_MTLS: 'true',
        EFI_CACHE: 'true',
        CACHE: 'true',
      },
    );

    expect(config.sdk.sandbox).toBe(false);
    expect(config.sdk.cert_base64).toBe(false);
    expect(config.sdk.validateMtls).toBe(false);
    expect(config.sdk.cache).toBe(false);
    expect([...config.enabledApis]).toEqual(['cobrancas']);
  });

  it('usa EFI_* antes das variáveis legadas para opções não secretas', () => {
    const config = loadRuntimeConfig([], {
      ...baseEnv,
      EFI_SANDBOX: 'false',
      SANDBOX: 'true',
      EFI_APIS: 'cobrancas',
      APIS: 'pix',
      EFI_CERT_BASE64: 'false',
      CERT_BASE64: 'true',
      EFI_VALIDATE_MTLS: 'false',
      VALIDATE_MTLS: 'true',
      EFI_CACHE: 'false',
      CACHE: 'true',
    });

    expect(config.sdk.sandbox).toBe(false);
    expect(config.sdk.cert_base64).toBe(false);
    expect(config.sdk.validateMtls).toBe(false);
    expect(config.sdk.cache).toBe(false);
    expect([...config.enabledApis]).toEqual(['cobrancas']);
  });

  it('mantém fallback legado apenas para opções não secretas', () => {
    const config = loadRuntimeConfig([], {
      EFI_CLIENT_ID: 'id',
      EFI_CLIENT_SECRET: 'secret',
      SANDBOX: 'false',
      APIS: 'cobrancas',
      CERT_BASE64: 'false',
      VALIDATE_MTLS: 'false',
      CACHE: 'false',
    });

    expect(config.sdk.sandbox).toBe(false);
    expect(config.sdk.cert_base64).toBe(false);
    expect(config.sdk.validateMtls).toBe(false);
    expect(config.sdk.cache).toBe(false);
    expect([...config.enabledApis]).toEqual(['cobrancas']);
  });

  it('encaminha material de autenticação somente das variáveis EFI_*', () => {
    const config = loadRuntimeConfig([], {
      ...baseEnv,
      EFI_PEM_KEY: 'pem',
      EFI_PARTNER_TOKEN: 'partner',
      PEM_KEY: 'legacy-pem',
      PARTNER_TOKEN: 'legacy-partner',
    });

    expect(config.sdk).toMatchObject({
      client_id: 'id',
      client_secret: 'secret',
      certificate: 'certificate',
      pemKey: 'pem',
      partner_token: 'partner',
    });
    expect(config.sdk).not.toHaveProperty('idempotencyKey');
  });

  it('não aceita aliases de ambiente para material sensível', () => {
    const config = loadRuntimeConfig([], {
      SANDBOX: 'true',
      CLIENT_ID: 'legacy-id',
      CLIENT_SECRET: 'legacy-secret',
      CERTIFICATE: 'legacy-certificate',
    });

    expect(config.sdk.client_id).toBeUndefined();
    expect(config.sdk.client_secret).toBeUndefined();
    expect(config.sdk.certificate).toBeUndefined();
  });

  it.each([
    '--client-id=id',
    '--client-secret=secret',
    '--certificate=certificate',
    '--pem-key=pem',
    '--partner-token=partner',
    '--idempotency-key=key',
  ])('rejeita o argumento secreto %s', (argument) => {
    expect(() => loadRuntimeConfig([argument], baseEnv)).toThrow(/Argumentos inválidos/);
  });

  it('aceita booleanos 1 e 0', () => {
    const config = loadRuntimeConfig(['--cache=0', '--validate-mtls=1'], baseEnv);
    expect(config.sdk.cache).toBe(false);
    expect(config.sdk.validateMtls).toBe(true);
  });

  it('rejeita API desconhecida e seleção vazia', () => {
    expect(() => loadRuntimeConfig(['--apis=desconhecida'], baseEnv)).toThrow(ConfigurationError);
    expect(() => loadRuntimeConfig(['--apis=,,,'], baseEnv)).toThrow(ConfigurationError);
  });

  it('adia a exigência de certificado para a execução da operação mTLS', () => {
    const allApis = loadRuntimeConfig([], {
      EFI_CLIENT_ID: 'id',
      EFI_CLIENT_SECRET: 'secret',
    });
    const cobrancas = loadRuntimeConfig(['--apis=cobrancas'], {
      EFI_CLIENT_ID: 'id',
      EFI_CLIENT_SECRET: 'secret',
    });

    expect(allApis.sdk.certificate).toBeUndefined();
    expect(cobrancas.sdk.certificate).toBeUndefined();
  });

  it('expõe ajuda sem sugerir credenciais por argumentos', () => {
    const help = helpText();

    expect(help).toContain('EFI_CLIENT_SECRET');
    expect(help).toContain('CLI > EFI_* > variável legada');
    expect(help).not.toMatch(/--client-(?:id|secret)|--certificate|--pem-key|--partner-token/);
    expect(() => loadRuntimeConfig(['--help'], {})).toThrowError(
      expect.objectContaining({ message: 'HELP' }),
    );
  });

  it('mantém tools sensíveis bloqueadas por padrão e exige allowlist com aceite literal', () => {
    expect(loadRuntimeConfig([], baseEnv).allowedSensitiveTools.size).toBe(0);

    const config = loadRuntimeConfig([], {
      ...baseEnv,
      EFI_SENSITIVE_TOOLS: 'create_account_certificate,get_account_credentials,create_sftp_key',
      EFI_ACCEPT_SENSITIVE_OUTPUT_RISK: 'I_UNDERSTAND',
    });
    expect([...config.allowedSensitiveTools]).toEqual([
      'create_account_certificate',
      'get_account_credentials',
      'create_sftp_key',
    ]);

    expect(() =>
      loadRuntimeConfig([], {
        ...baseEnv,
        EFI_SENSITIVE_TOOLS: 'create_account_certificate',
      }),
    ).toThrow(/devem ser informadas juntas/);
    expect(() =>
      loadRuntimeConfig([], {
        ...baseEnv,
        EFI_SENSITIVE_TOOLS: '*',
        EFI_ACCEPT_SENSITIVE_OUTPUT_RISK: 'I_UNDERSTAND',
      }),
    ).toThrow(/somente nomes explícitos/);
    expect(() =>
      loadRuntimeConfig([], {
        ...baseEnv,
        EFI_SENSITIVE_TOOLS: 'create_account_certificate',
        EFI_ACCEPT_SENSITIVE_OUTPUT_RISK: 'yes',
      }),
    ).toThrow(/I_UNDERSTAND/);
  });

  it('rejeita tool sensível cujo domínio foi desabilitado', () => {
    expect(() =>
      loadRuntimeConfig(['--apis=pix'], {
        ...baseEnv,
        EFI_SENSITIVE_TOOLS: 'create_sftp_key',
        EFI_ACCEPT_SENSITIVE_OUTPUT_RISK: 'I_UNDERSTAND',
      }),
    ).toThrow(/APIs desabilitadas/);
  });

  it('aplica limites conservadores e permite configuração por EFI_*', () => {
    expect(loadRuntimeConfig([], baseEnv).limits).toEqual({
      maxConcurrency: 4,
      mutationMaxConcurrency: 1,
      readRatePerMinute: 60,
      mutationRatePerMinute: 10,
      sensitiveRatePerMinute: 1,
    });

    const config = loadRuntimeConfig([], {
      ...baseEnv,
      EFI_MAX_CONCURRENCY: '8',
      EFI_MUTATION_MAX_CONCURRENCY: '2',
      EFI_READ_RATE_PER_MINUTE: '120',
      EFI_MUTATION_RATE_PER_MINUTE: '20',
      EFI_SENSITIVE_RATE_PER_MINUTE: '2',
    });
    expect(config.limits).toEqual({
      maxConcurrency: 8,
      mutationMaxConcurrency: 2,
      readRatePerMinute: 120,
      mutationRatePerMinute: 20,
      sensitiveRatePerMinute: 2,
    });
    expect(() => loadRuntimeConfig([], { ...baseEnv, EFI_MAX_CONCURRENCY: '0' })).toThrow(
      /inteiro positivo/,
    );
  });
});
