import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type EfiPay from 'sdk-node-apis-efi';
import type { RequestHeaders } from 'sdk-node-apis-efi';
import type { z } from 'zod';

export const API_GROUPS = [
  'cobrancas',
  'pix',
  'open-finance',
  'pagamento-contas',
  'abertura-contas',
  'extratos',
] as const;

export type ApiGroup = (typeof API_GROUPS)[number];

export type EfiMethodName = {
  [K in keyof EfiPay]: EfiPay[K] extends (...args: never[]) => Promise<unknown> ? K : never;
}[keyof EfiPay] &
  string;

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'local';
export type CallShape = 'none' | 'body' | 'params' | 'params-body';
export type ResponseKind = 'json' | 'void' | 'pdf' | 'qr';

export interface ToolInvocationInput {
  params?: unknown;
  body?: unknown;
}

export type ToolInvoker = (
  client: EfiPay,
  input: ToolInvocationInput,
  headers?: RequestHeaders,
) => Promise<unknown>;

export interface RawToolDefinition {
  method: EfiMethodName;
  api: ApiGroup;
  httpMethod: HttpMethod;
  route: string;
  callShape: CallShape;
  paramsSchema?: z.ZodType;
  bodySchema?: z.ZodType;
  responseSchema?: z.ZodType;
  optionalParams: boolean;
  optionalBody: boolean;
  acceptsIdempotencyKey: boolean;
  responseKind: ResponseKind;
  invoke: ToolInvoker;
}

export interface ToolDefinition extends RawToolDefinition {
  name: string;
  title: string;
  description: string;
  annotations: ToolAnnotations;
}

type MethodOverloads<T> = T extends {
  (...args: infer A1): infer R1;
  (...args: infer A2): infer R2;
}
  ? [A1, R1] | [A2, R2]
  : T extends (...args: infer A) => infer R
    ? [A, R]
    : never;

type CompatibleOverload<Overload, Args extends unknown[], Result> = Overload extends [
  infer SdkArgs extends unknown[],
  infer SdkResult,
]
  ? ((...args: SdkArgs) => SdkResult) extends (...args: Args) => Promise<Result>
    ? Overload
    : never
  : never;

type SupportedInvocation<
  M extends EfiMethodName,
  Args extends unknown[],
  Result,
> = CompatibleOverload<MethodOverloads<EfiPay[M]>, Args, Result>;

type ContractCheck<M extends EfiMethodName, Args extends unknown[], Result> = [
  SupportedInvocation<M, Args, Result>,
] extends [never]
  ? { readonly __invalid_sdk_contract__: never }
  : unknown;

type SchemaResponse<S extends z.ZodType = z.ZodType> = {
  responseSchema: S;
  responseKind?: 'json' | 'qr';
};

type VoidResponse<S extends z.ZodType<void> | undefined = z.ZodType<void> | undefined> = {
  responseSchema?: S;
  responseKind: 'void';
};

type PdfResponse = {
  responseSchema?: never;
  responseKind: 'pdf';
};

type ResponseContract = SchemaResponse | VoidResponse | PdfResponse;

type ResponseValue<C extends ResponseContract> = C extends PdfResponse
  ? Buffer
  : C extends VoidResponse
    ? void
    : C extends SchemaResponse<infer S>
      ? z.output<S>
      : never;

type BaseDefinition<M extends EfiMethodName> = {
  method: M;
  httpMethod: HttpMethod;
  route: string;
};

type NoInputDefinition<M extends EfiMethodName, C extends ResponseContract> = BaseDefinition<M> &
  C &
  ContractCheck<M, [], ResponseValue<C>>;

type BodyDefinition<
  M extends EfiMethodName,
  B extends z.ZodType,
  C extends ResponseContract,
> = BaseDefinition<M> &
  C & {
    bodySchema: B;
  } & ContractCheck<M, [z.output<B>], ResponseValue<C>>;

type ParamsDefinition<
  M extends EfiMethodName,
  P extends z.ZodType,
  C extends ResponseContract,
> = BaseDefinition<M> &
  C & {
    paramsSchema: P;
  } & ContractCheck<M, [z.output<P>], ResponseValue<C>>;

type OptionalParamsDefinition<
  M extends EfiMethodName,
  P extends z.ZodType,
  C extends ResponseContract,
> = BaseDefinition<M> &
  C & {
    paramsSchema: P;
  } & ContractCheck<M, [params?: z.output<P>], ResponseValue<C>>;

type ParamsBodyDefinition<
  M extends EfiMethodName,
  P extends z.ZodType,
  B extends z.ZodType,
  C extends ResponseContract,
> = BaseDefinition<M> &
  C & {
    paramsSchema: P;
    bodySchema: B;
  } & ContractCheck<M, [z.output<P>, z.output<B>], ResponseValue<C>>;

type ParamsOptionalBodyDefinition<
  M extends EfiMethodName,
  P extends z.ZodType,
  B extends z.ZodType,
  C extends ResponseContract,
> = BaseDefinition<M> &
  C & {
    paramsSchema: P;
    bodySchema: B;
  } & ContractCheck<M, [z.output<P>, body?: z.output<B>], ResponseValue<C>>;

type DefinitionInput = BaseDefinition<EfiMethodName> &
  Partial<Pick<RawToolDefinition, 'paramsSchema' | 'bodySchema' | 'responseSchema'>> & {
    responseKind?: ResponseKind;
  };

function invocationFor(method: EfiMethodName, shape: CallShape): ToolInvoker {
  return (client, input, headers) => {
    const args: unknown[] = [];
    if (shape === 'params' || shape === 'params-body') args.push(input.params);
    if (shape === 'body' || shape === 'params-body') args.push(input.body);
    if (headers !== undefined) args.push(headers);

    // O builder já provou estaticamente a assinatura em ContractCheck. Reflect.apply é apenas a
    // ponte de despacho necessária para selecionar em runtime uma das 173 propriedades tipadas.
    return Reflect.apply(client[method], client, args);
  };
}

function materialize(
  api: ApiGroup,
  callShape: CallShape,
  definition: DefinitionInput,
  optionalParams = false,
  optionalBody = false,
): RawToolDefinition {
  return {
    ...definition,
    api,
    callShape,
    optionalParams,
    optionalBody,
    acceptsIdempotencyKey: api === 'open-finance' && definition.httpMethod !== 'get',
    responseKind: definition.responseKind ?? 'json',
    invoke: invocationFor(definition.method, callShape),
  };
}

export function createDomainBuilders(api: ApiGroup) {
  return {
    noInput<M extends EfiMethodName, C extends ResponseContract>(
      definition: NoInputDefinition<M, C>,
    ): RawToolDefinition {
      return materialize(api, 'none', definition);
    },

    body<M extends EfiMethodName, B extends z.ZodType, C extends ResponseContract>(
      definition: BodyDefinition<M, B, C>,
    ): RawToolDefinition {
      return materialize(api, 'body', definition);
    },

    params<M extends EfiMethodName, P extends z.ZodType, C extends ResponseContract>(
      definition: ParamsDefinition<M, P, C>,
    ): RawToolDefinition {
      return materialize(api, 'params', definition);
    },

    optionalParams<M extends EfiMethodName, P extends z.ZodType, C extends ResponseContract>(
      definition: OptionalParamsDefinition<M, P, C>,
    ): RawToolDefinition {
      return materialize(api, 'params', definition, true);
    },

    paramsBody<
      M extends EfiMethodName,
      P extends z.ZodType,
      B extends z.ZodType,
      C extends ResponseContract,
    >(definition: ParamsBodyDefinition<M, P, B, C>): RawToolDefinition {
      return materialize(api, 'params-body', definition);
    },

    paramsOptionalBody<
      M extends EfiMethodName,
      P extends z.ZodType,
      B extends z.ZodType,
      C extends ResponseContract,
    >(definition: ParamsOptionalBodyDefinition<M, P, B, C>): RawToolDefinition {
      return materialize(api, 'params-body', definition, false, true);
    },
  };
}
