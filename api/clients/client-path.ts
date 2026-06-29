export type ApiPathParamValue = string | number | boolean;
export type ApiPathParams = Record<string, ApiPathParamValue>;
export type ApiQueryParams = Record<string, ApiPathParamValue | undefined>;
export type ApiRequestData = Record<string, unknown> | unknown[];

export function toApiClientPath(swaggerPath: string, pathParams?: ApiPathParams): string {
  const interpolatedPath = swaggerPath.replace(/\{([^}]+)\}/g, (placeholder, name: string) => {
    const value = pathParams?.[name];
    if (value === undefined) {
      throw new Error(`Missing API path parameter: ${name}`);
    }

    return encodeURIComponent(String(value));
  });

  return interpolatedPath.replace(/^\/+/, '');
}

export function toRequestParams(
  params?: ApiQueryParams,
): Record<string, ApiPathParamValue> | undefined {
  if (!params) {
    return undefined;
  }

  const definedParams = Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, ApiPathParamValue] => {
      const [, value] = entry;
      return value !== undefined;
    }),
  );

  return Object.keys(definedParams).length > 0 ? definedParams : undefined;
}
