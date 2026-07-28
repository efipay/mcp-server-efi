import { ABERTURA_CONTAS_DEFINITIONS } from './domains/aberturaContas.js';
import { COBRANCAS_DEFINITIONS } from './domains/cobrancas.js';
import { EXTRATOS_DEFINITIONS } from './domains/extratos.js';
import { OPEN_FINANCE_DEFINITIONS } from './domains/openFinance.js';
import { PAGAMENTO_CONTAS_DEFINITIONS } from './domains/pagamentoContas.js';
import { PIX_DEFINITIONS } from './domains/pix.js';

export const RAW_TOOL_DEFINITIONS = [
  ...COBRANCAS_DEFINITIONS,
  ...PIX_DEFINITIONS,
  ...OPEN_FINANCE_DEFINITIONS,
  ...PAGAMENTO_CONTAS_DEFINITIONS,
  ...ABERTURA_CONTAS_DEFINITIONS,
  ...EXTRATOS_DEFINITIONS,
] as const;
