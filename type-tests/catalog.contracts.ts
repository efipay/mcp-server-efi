import {
  PixDetailChargeParamsSchema,
  PixDetailChargeResponseSchema,
  PixUpdateChargeBodySchema,
  PixUpdateChargeParamsSchema,
  PixUpdateChargeResponseSchema,
} from 'sdk-node-apis-efi';
import { z } from 'zod';
import { createDomainBuilders } from '../src/catalog/types.js';

const { body, params, paramsBody } = createDomainBuilders('pix');

// Controle positivo: assinatura, schemas e retorno oficiais são aceitos juntos.
paramsBody({
  method: 'pixUpdateCharge',
  httpMethod: 'patch',
  route: '/v2/cob/:txid',
  paramsSchema: PixUpdateChargeParamsSchema,
  bodySchema: PixUpdateChargeBodySchema,
  responseSchema: PixUpdateChargeResponseSchema,
});

// Os três controles negativos tornam o gate sensível a regressões do builder. Se algum contrato
// incompatível deixar de produzir erro, o próprio TypeScript reprovará o @ts-expect-error ocioso.
// @ts-expect-error pixUpdateCharge não possui overload que receba somente body.
body({
  method: 'pixUpdateCharge',
  httpMethod: 'patch',
  route: '/v2/cob/:txid',
  bodySchema: PixUpdateChargeBodySchema,
  responseSchema: PixUpdateChargeResponseSchema,
});

// @ts-expect-error o SDK exige txid string, não number.
params({
  method: 'pixDetailCharge',
  httpMethod: 'get',
  route: '/v2/cob/:txid',
  paramsSchema: z.object({ txid: z.number() }),
  responseSchema: PixDetailChargeResponseSchema,
});

// @ts-expect-error a resposta pública do método é um objeto, não string.
params({
  method: 'pixDetailCharge',
  httpMethod: 'get',
  route: '/v2/cob/:txid',
  paramsSchema: PixDetailChargeParamsSchema,
  responseSchema: z.string(),
});
