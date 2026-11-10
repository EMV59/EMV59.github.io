/**
 * Step 5. Generics and the Generic Repository pattern.
 *
 * The contract is split into two small interfaces (Interface Segregation Principle):
 * code that only reads data can depend on `IReadRepository` and cannot accidentally write.
 * `IRepository` combines both through interface inheritance (`extends`).
 *
 * All methods return Promise (as in the reference code): a real database is asynchronous,
 * so the in-memory version can later be replaced by a DB version without changing any caller.
 */
import type { EntityId, Identifiable } from './basic-contracts.ts';

/** Condition used by `findWhere`: returns true for the items to keep. */
export type Predicate<T> = (item: T) => boolean;

/** Read part of the contract. */
export interface IReadRepository<T extends Identifiable<ID>, ID extends EntityId = string> {
  /** The entity, or `null` if there is none with this id. */
  findById(id: ID): Promise<T | null>;
  /** All entities in insertion order. */
  findAll(): Promise<T[]>;
  /** Extension 4: all entities for which `predicate` returns true. */
  findWhere(predicate: Predicate<T>): Promise<T[]>;
}

/** Write part of the contract. */
export interface IWriteRepository<T extends Identifiable<ID>, ID extends EntityId = string> {
  /** Insert or update ("upsert"): an entity with the same id is replaced. */
  save(entity: T): Promise<void>;
  /** `true` if something was deleted, `false` if there was no such id. */
  delete(id: ID): Promise<boolean>;
}

/**
 * Full generic repository contract: `IRepository<T extends Identifiable, ID>`.
 * `T extends Identifiable<ID>` is a CONSTRAINT: only objects with an `id` can be stored.
 * `ID` defaults to `string`, so `IRepository<Student>` is enough in most cases.
 */
export interface IRepository<T extends Identifiable<ID>, ID extends EntityId = string>
  extends IReadRepository<T, ID>,
    IWriteRepository<T, ID> {}

/** Generic in-memory storage that works for ANY identifiable type: students, teachers, courses... */
export class InMemoryRepository<T extends Identifiable<ID>, ID extends EntityId = string>
  implements IRepository<T, ID>
{
  private readonly _items = new Map<ID, T>();

  async save(entity: T): Promise<void> {
    this._items.set(entity.id, entity);
  }

  async findById(id: ID): Promise<T | null> {
    return this._items.get(id) ?? null;
  }

  async findAll(): Promise<T[]> {
    return [...this._items.values()];
  }

  async findWhere(predicate: Predicate<T>): Promise<T[]> {
    return [...this._items.values()].filter(predicate);
  }

  async delete(id: ID): Promise<boolean> {
    return this._items.delete(id);
  }
}
