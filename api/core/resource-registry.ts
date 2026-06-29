export type ResourceId = string | number;

export type RegisteredResource = {
  type: string;
  id: ResourceId;
  name?: string;
  cleanupPriority: number;
  cleanup: () => Promise<unknown> | unknown;
};

export type RegisteredResourceSnapshot = {
  type: string;
  id: ResourceId;
  name?: string;
};

export type SerializedCleanupError = {
  message: string;
  name: string;
  stack?: string;
};

export type CleanupError = {
  resource: RegisteredResourceSnapshot;
  error: SerializedCleanupError;
};

export type CleanupResult = {
  cleaned: RegisteredResourceSnapshot[];
  errors: CleanupError[];
};

export class ResourceRegistry {
  private readonly resources: RegisteredResource[] = [];

  register(resource: RegisteredResource): void {
    this.resources.push(resource);
  }

  has(type: string, id: ResourceId): boolean {
    return this.resources.some((resource) => isSameResource(resource, type, id));
  }

  assertRegistered(type: string, id: ResourceId): RegisteredResource {
    const resource = this.resources.find((item) => isSameResource(item, type, id));

    if (!resource) {
      throw new Error(`API test resource is not registered: ${type}#${String(id)}.`);
    }

    return resource;
  }

  async cleanupAll(): Promise<CleanupResult> {
    const cleaned: RegisteredResourceSnapshot[] = [];
    const errors: CleanupError[] = [];
    const resources = [...this.resources].sort(
      (left, right) => right.cleanupPriority - left.cleanupPriority,
    );

    try {
      for (const resource of resources) {
        try {
          await resource.cleanup();
          cleaned.push(toResourceSnapshot(resource));
        } catch (error) {
          errors.push({
            resource: toResourceSnapshot(resource),
            error: serializeCleanupError(error),
          });
        }
      }
    } finally {
      this.resources.length = 0;
    }

    return { cleaned, errors };
  }
}

function isSameResource(resource: RegisteredResource, type: string, id: ResourceId): boolean {
  return resource.type === type && resource.id === id;
}

function toResourceSnapshot(resource: RegisteredResource): RegisteredResourceSnapshot {
  return resource.name
    ? { type: resource.type, id: resource.id, name: resource.name }
    : { type: resource.type, id: resource.id };
}

function serializeCleanupError(error: unknown): SerializedCleanupError {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }

  return {
    message: String(error),
    name: 'NonError',
  };
}
