export type JsonSchemaValidationError = {
  path: string;
  message: string;
};

type JsonSchemaObject = {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, unknown>;
  items?: unknown;
  enum?: unknown[];
};

const SUPPORTED_VALIDATION_KEYWORDS = new Set(['type', 'required', 'properties', 'items', 'enum']);
const SUPPORTED_ANNOTATION_KEYWORDS = new Set([
  '$schema',
  '$id',
  '$comment',
  'title',
  'description',
  'default',
  'examples',
  'deprecated',
  'readOnly',
  'writeOnly',
]);

export function expectJsonSchema(value: unknown, schema: unknown, label = 'JSON'): void {
  const schemaErrors = validateSchemaDefinition(schema, '$');
  if (schemaErrors.length > 0) {
    throw new Error(
      `${label} JSON schema 定义不受支持：${schemaErrors
        .map((error) => `${error.path} ${error.message}`)
        .join('；')}`,
    );
  }

  const errors = validateJsonSchema(value, schema, '$');

  if (errors.length > 0) {
    throw new Error(
      `${label} JSON schema 校验失败：${errors
        .map((error) => `${error.path} ${error.message}`)
        .join('；')}`,
    );
  }
}

function validateSchemaDefinition(
  schema: unknown,
  path: string,
): JsonSchemaValidationError[] {
  if (typeof schema === 'boolean') {
    return [];
  }

  if (!isRecord(schema)) {
    return [{ path: `schema ${path}`, message: 'schema 必须为对象或 boolean' }];
  }

  const errors: JsonSchemaValidationError[] = [];
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_VALIDATION_KEYWORDS.has(key) && !SUPPORTED_ANNOTATION_KEYWORDS.has(key)) {
      errors.push({
        path: `schema ${path}.${key}`,
        message: '使用了暂不支持的 JSON schema 关键字',
      });
    }
  }

  const schemaObject = schema as JsonSchemaObject;
  if (isRecord(schemaObject.properties)) {
    for (const [key, propertySchema] of Object.entries(schemaObject.properties)) {
      errors.push(...validateSchemaDefinition(propertySchema, `${path}.properties.${key}`));
    }
  }

  if (schemaObject.items !== undefined) {
    errors.push(...validateSchemaDefinition(schemaObject.items, `${path}.items`));
  }

  return errors;
}

function validateJsonSchema(
  value: unknown,
  schema: unknown,
  path: string,
): JsonSchemaValidationError[] {
  if (schema === true) {
    return [];
  }

  if (schema === false) {
    return [{ path, message: '不允许出现该值' }];
  }

  if (!isRecord(schema)) {
    return [{ path, message: 'schema 必须为对象或 boolean' }];
  }

  const errors: JsonSchemaValidationError[] = [];
  const schemaObject = schema as JsonSchemaObject;

  if (schemaObject.enum !== undefined && !schemaObject.enum.some((item) => Object.is(item, value))) {
    errors.push({ path, message: `应匹配枚举值 ${JSON.stringify(schemaObject.enum)}` });
    return errors;
  }

  if (schemaObject.type !== undefined && !matchesType(value, schemaObject.type)) {
    errors.push({ path, message: `应为 ${formatTypeName(schemaObject.type)}` });
    return errors;
  }

  if (isRecord(value)) {
    errors.push(...validateRequiredProperties(value, schemaObject, path));
    errors.push(...validateDefinedProperties(value, schemaObject, path));
  }

  if (Array.isArray(value) && schemaObject.items !== undefined) {
    value.forEach((item, index) => {
      errors.push(...validateJsonSchema(item, schemaObject.items, `${path}[${index}]`));
    });
  }

  return errors;
}

function validateRequiredProperties(
  value: Record<string, unknown>,
  schema: JsonSchemaObject,
  path: string,
): JsonSchemaValidationError[] {
  if (!Array.isArray(schema.required)) {
    return [];
  }

  return schema.required
    .filter((key) => !Object.prototype.hasOwnProperty.call(value, key))
    .map((key) => ({ path: `${path}.${key}`, message: '缺少必须字段' }));
}

function validateDefinedProperties(
  value: Record<string, unknown>,
  schema: JsonSchemaObject,
  path: string,
): JsonSchemaValidationError[] {
  if (!isRecord(schema.properties)) {
    return [];
  }

  const errors: JsonSchemaValidationError[] = [];
  for (const [key, propertySchema] of Object.entries(schema.properties)) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      errors.push(...validateJsonSchema(value[key], propertySchema, `${path}.${key}`));
    }
  }

  return errors;
}

function matchesType(value: unknown, type: string | string[]): boolean {
  const types = Array.isArray(type) ? type : [type];

  return types.some((singleType) => {
    switch (singleType) {
      case 'array':
        return Array.isArray(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'integer':
        return typeof value === 'number' && Number.isInteger(value);
      case 'null':
        return value === null;
      case 'number':
        return typeof value === 'number' && Number.isFinite(value);
      case 'object':
        return isRecord(value);
      case 'string':
        return typeof value === 'string';
      default:
        return false;
    }
  });
}

function formatTypeName(type: string | string[]): string {
  return Array.isArray(type) ? type.join(' 或 ') : type;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
