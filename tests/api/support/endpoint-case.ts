export type EndpointMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS'
  | 'TRACE';

export type EndpointIdentity = {
  method: EndpointMethod;
  path: string;
};

export type EndpointCaseMetadata = EndpointIdentity & {
  title: string;
  description?: string;
};

export function toEndpointLabel(method: string, path: string): string {
  const endpointMethod = method.toUpperCase();
  const endpointPath = normalizeEndpointPath(path);

  return `${endpointMethod} ${endpointPath}`;
}

export function toEndpointTitle(method: string, path: string, title: string): string {
  return `${toEndpointLabel(method, path)} ${title}`;
}

function normalizeEndpointPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}
