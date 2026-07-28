import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { EfiMethodName, HttpMethod } from './types.js';

/**
 * Mutations that only append or create resources. Every other mutation is treated
 * conservatively as destructive because it can alter existing state or move funds.
 */
export const ADDITIVE_METHODS = new Set<EfiMethodName>([
  'sendSubscriptionLinkEmail',
  'sendLinkEmail',
  'createOneStepLink',
  'createCharge',
  'createCarnet',
  'createPlan',
  'createSubscription',
  'createOneStepSubscriptionLink',
  'sendBilletEmail',
  'createChargeHistory',
  'sendCarnetEmail',
  'sendCarnetParcelEmail',
  'createCarnetHistory',
  'createSubscriptionHistory',
  'pixCreateDueCharge',
  'createReport',
  'pixCreateCharge',
  'pixCreateImmediateCharge',
  'pixCreateLocation',
  'pixCreateEvp',
  'pixSplitConfig',
  'pixCreateDueChargeBatch',
  'pixResendWebhook',
  'pixCreateRecurrenceAutomatic',
  'pixCreateRequestRecurrenceAutomatic',
  'pixCreateAutomaticChargeTxid',
  'pixCreateAutomaticCharge',
  'pixCreateLocationRecurrenceAutomatic',
  'ofCreateBiometricEnrollment',
  'ofCreateAutomaticEnrollment',
  'createAccount',
  'createAccountCertificate',
  'createStatementRecurrency',
]);

export function annotationsFor(method: EfiMethodName, httpMethod: HttpMethod): ToolAnnotations {
  const readOnly = httpMethod === 'get' || httpMethod === 'local';
  const annotations: ToolAnnotations = {
    readOnlyHint: readOnly,
    idempotentHint: readOnly || httpMethod === 'put' || httpMethod === 'delete',
    // pixQrCodeDetail é implementado localmente, mas acessa o payload dinâmico e o JWKS
    // publicados pelo recebedor. Portanto, ele interage com o mundo externo para fins MCP.
    openWorldHint: httpMethod !== 'local' || method === 'pixQrCodeDetail',
  };

  if (!readOnly) annotations.destructiveHint = !ADDITIVE_METHODS.has(method);
  return annotations;
}
