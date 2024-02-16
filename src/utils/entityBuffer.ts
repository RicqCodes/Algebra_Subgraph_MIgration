interface Entity {
  id: string;
}

export class EntityBuffer {
  // Method to add or merge entities in the buffer
  private static buffer: Record<string, Entity[]> = {};

  // Method to check if an entity exists in the buffer and return it
  static get(entityType: string, entityId: string): Entity | undefined {
    // Check if there's an array for the entityType
    const entities = this.buffer[entityType];
    if (!entities) {
      // No entities of this type are present in the buffer
      return undefined;
    }

    // Find the entity with the given ID in the array
    const entity = entities.find((e) => e.id === entityId);

    // Return the found entity, or undefined if not found
    return entity;
  }

  // Method to add or merge entities in the buffer
  static add<E extends Entity>(e: E) {
    if (!this.buffer[e.constructor.name]) {
      this.buffer[e.constructor.name] = [];
    }

    const entities = this.buffer[e.constructor.name];
    const index = entities.findIndex((entity) => entity.id === e.id);

    if (index !== -1) {
      // Entity exists, merge it
      entities[index] = EntityBuffer.mergeEntities(entities[index], e);
    } else {
      // Entity does not exist, add it to the array
      entities.push(e);
    }
  }

  // Method to merge two entities
  static mergeEntities<E extends Entity>(existingEntity: E, newEntity: E): E {
    // Create a new instance of the entity's class to preserve instance methods and properties
    const mergedEntity = Object.create(Object.getPrototypeOf(existingEntity));

    Object.keys(existingEntity).forEach((key) => {
      mergedEntity[key as keyof Entity] = existingEntity[key as keyof Entity];
    });

    Object.keys(newEntity).forEach((key) => {
      const existingValue = existingEntity[key as keyof Entity] as unknown;
      const newValue = newEntity[key as keyof Entity] as unknown;

      if (Array.isArray(existingValue) && Array.isArray(newValue)) {
        // Merge arrays by concatenating them and removing duplicates
        const newArr = Array.from(new Set([...existingValue, ...newValue]));
        mergedEntity[key] = newArr;
      } else if (isPlainObject(existingValue) && isPlainObject(newValue)) {
        // For nested objects within the entities, perform a deeper merge
        mergedEntity[key] = this.mergeEntities(
          existingValue as Entity,
          newValue as Entity
        );
      } else {
        // For primitive values or non-matching types, prefer the new value
        mergedEntity[key] = newValue;
      }
    });

    return mergedEntity;
  }

  static flush() {
    let values = Object.values(this.buffer);
    this.buffer = {};
    return values;
  }
}

// Utility function to check if a value is a plain object
function isPlainObject(obj: any): obj is Record<string, any> {
  return Object.prototype.toString.call(obj) === "[object Object]";
}
