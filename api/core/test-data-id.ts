export type CreateShortTestNameOptions = {
  prefix: string;
  domain: string;
  maxLength: number;
  seed?: string;
};

export function createShortTestName(options: CreateShortTestNameOptions): string {
  if (!Number.isInteger(options.maxLength) || options.maxLength <= 0) {
    throw new Error('maxLength must be a positive integer.');
  }

  const prefix = normalizeToken(options.prefix) || 'AT';
  const seed = normalizeToken(options.seed ?? Math.random().toString(36).slice(2, 10)) || '0';
  const minimumName = `${prefix}_${seed}`;

  if (options.maxLength < minimumName.length) {
    throw new Error(
      `maxLength ${options.maxLength} is too short to preserve prefix and seed "${minimumName}".`,
    );
  }

  const domain = compactDomain(options.domain) || 'TEST';
  const availableDomainLength = options.maxLength - prefix.length - seed.length - 2;

  if (availableDomainLength <= 0) {
    return minimumName;
  }

  return `${prefix}_${domain.slice(0, availableDomainLength)}_${seed}`;
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function compactDomain(value: string): string {
  return normalizeToken(value).replace(/_/g, '');
}
