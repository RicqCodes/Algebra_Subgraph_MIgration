interface Entity {
  id: string;
}

export class EntityBuffer {
  // Using Map for efficient lookups and storage
  private static buffer: Map<string, Map<string, Entity>> | null = new Map();

  static get(entityType: string, entityId: string): Entity | undefined {
    if (!this.buffer) return undefined;
    const entities = this.buffer.get(entityType);
    return entities?.get(entityId);
  }

  static add<E extends Entity>(entity: E) {
    if (!this.buffer) {
      this.buffer = new Map<string, Map<string, Entity>>();
    }
    let entities = this.buffer!.get(entity.constructor.name);
    if (!entities) {
      entities = new Map();
      this.buffer!.set(entity.constructor.name, entities);
    }

    const existingEntity = entities.get(entity.id);
    if (existingEntity) {
      // Merge directly into the existing entity to avoid creating a new instance
      this.mergeEntities(existingEntity, entity);
    } else {
      entities.set(entity.id, entity);
    }
  }

  // static mergeEntities<E extends Entity>(target: E, source: E): void {
  //   Object.keys(source).forEach((key) => {
  //     const targetValue = target[key as keyof E];
  //     const sourceValue = source[key as keyof E];

  //     if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
  //       // Efficiently handle array merging without unnecessary deduplication
  //       target[key as keyof E] = [
  //         ...new Set([...targetValue, ...sourceValue]),
  //       ] as any;
  //     } else if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
  //       // Correctly perform a deep merge by updating the target object directly
  //       // Ensure both targetValue and sourceValue are treated as Entity for recursive merging
  //       if (!isPlainObject(target[key as keyof E])) {
  //         // Initialize target[key] as an object if it's not already an object
  //         target[key as keyof E] = {} as any;
  //       }
  //       // Recursively merge nested objects without returning and spreading
  //       this.mergeEntities(targetValue as any, sourceValue as any);
  //     } else {
  //       target[key as keyof E] = sourceValue;
  //     }
  //   });
  // }

  static mergeEntities<E extends Entity>(target: E, source: E): void {
    // Define properties that should not be merged
    const immutableProperties = ["id"]; // Add any other unique or immutable properties here

    Object.keys(source).forEach((key) => {
      if (immutableProperties.includes(key)) {
        // Skip merging for immutable properties
        return;
      }

      const targetValue = target[key as keyof E];
      const sourceValue = source[key as keyof E];

      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        // For arrays containing objects, merge based on a unique property (e.g., 'id')
        if (
          targetValue.length > 0 &&
          typeof targetValue[0] === "object" &&
          "id" in targetValue[0]
        ) {
          const mergedArray = [...targetValue];

          sourceValue.forEach((sourceItem) => {
            const index = mergedArray.findIndex(
              (targetItem) => targetItem.id === sourceItem.id
            );
            if (index !== -1) {
              // For existing items, merge them
              this.mergeEntities(mergedArray[index] as any, sourceItem);
            } else {
              // Add new items
              mergedArray.push(sourceItem);
            }
          });

          target[key as keyof E] = mergedArray as any;
        } else {
          // For arrays not containing objects or without unique identifiers, use Set for deduplication
          target[key as keyof E] = [
            ...new Set([...targetValue, ...sourceValue]),
          ] as any;
        }
      } else if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
        // Ensure target[key] is an object for recursive merging
        if (!isPlainObject(target[key as keyof E])) {
          target[key as keyof E] = {} as any;
        }
        // Recursively merge nested objects
        this.mergeEntities(targetValue as any, sourceValue as any);
      } else {
        // Directly assign sourceValue to target for other types
        target[key as keyof E] = sourceValue;
      }
    });
  }

  // Helper function to check if a value is a plain object

  static flush() {
    const values = Array.from(this.buffer!.values()).map((entities) =>
      Array.from(entities.values())
    );
    this.buffer!.clear();
    this.buffer = null;
    return values.flat();
  }
}

// function isPlainObject(obj: any): obj is Record<string, any> {
//   return Object.prototype.toString.call(obj) === "[object Object]";
// }
function isPlainObject(obj: any): obj is Object {
  return typeof obj === "object" && obj !== null && obj.constructor === Object;
}
