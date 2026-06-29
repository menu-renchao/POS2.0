export type CreateShortTestNameOptions = {
  prefix: string;
  domain: string;
  maxLength: number;
  seed?: string;
};

export function createShortTestName(options: CreateShortTestNameOptions): string {
  const normalizedPrefix = normalizeToken(options.prefix);
  if (!normalizedPrefix) {
    throw new Error('prefix must contain at least one alphanumeric character.');
  }

  const prefix = `${normalizedPrefix}_`;
  if (!Number.isInteger(options.maxLength) || options.maxLength <= 0) {
    throw new Error('maxLength must be a positive integer.');
  }

  if (options.maxLength < prefix.length) {
    throw new Error(
      `maxLength ${options.maxLength} is too short to preserve prefix "${prefix}".`,
    );
  }

  const domain = normalizeToken(options.domain) || 'TEST';
  const seed = normalizeToken(options.seed ?? Math.random().toString(36).slice(2, 10)) || '0';
  const name = `${prefix}${domain}_${seed}`;

  if (name.length <= options.maxLength) {
    return name;
  }

  return name.slice(0, options.maxLength);
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
