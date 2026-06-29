export type ResourceId = string | number;

export type RegisteredResource = {
  type: string;
  id: ResourceId;
  cleanupPriority: number;
  cleanup: () => Promise<unknown> | unknown;
};

export type CleanupError = {
  resource: RegisteredResource;
  error: unknown;
};

export type CleanupResult = {
  cleaned: RegisteredResource[];
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
    const cleaned: RegisteredResource[] = [];
    const errors: CleanupError[] = [];
    const resources = [...this.resources].sort(
      (left, right) => right.cleanupPriority - left.cleanupPriority,
    );

    try {
      for (const resource of resources) {
        try {
          await resource.cleanup();
          cleaned.push(resource);
        } catch (error) {
          errors.push({ resource, error });
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
