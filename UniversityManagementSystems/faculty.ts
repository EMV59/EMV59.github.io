/**
 * Step 4. Faculty: COMPOSITION (strong "owns-a").
 *
 * The faculty itself CREATES its groups (`createGroup` calls `new AcademicGroup` inside)
 * and controls their whole life cycle: a group exists only as a part of its faculty.
 * Outside code never receives the internal Map, only copies or single group references.
 */
import type { Identifiable } from './basic-contracts.ts';
import { AcademicGroup } from './learning-units.ts';
import type { Teacher } from './person-hierarchy.ts';
import { ValidationError, requireNonEmpty } from './validation.ts';

export class Faculty implements Identifiable {
  /** COMPOSITION: the faculty is the only owner of these AcademicGroup objects. */
  private readonly _groups = new Map<string, AcademicGroup>();

  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {
    requireNonEmpty(id, 'Faculty id');
    requireNonEmpty(name, 'Faculty name');
  }

  /** Factory method of the composition: the group is born inside the faculty. */
  createGroup(id: string, name: string, curator?: Teacher): AcademicGroup {
    if (this._groups.has(id)) {
      throw new ValidationError(`Group with id "${id}" already exists in faculty "${this.name}"`);
    }
    // Names are compared trimmed and case-insensitively: 'KN-21 ' and 'kn-21' are the same group.
    if (this.findGroupByName(name) !== undefined) {
      throw new ValidationError(`Group named "${name}" already exists in faculty "${this.name}"`);
    }
    const group = new AcademicGroup(id, name, curator);
    this._groups.set(id, group);
    return group;
  }

  /**
   * Deletes the group: the part ends its life together with the link to its owner.
   * The group is disposed: it drops its links to students and curator and refuses further changes.
   * Those students and teachers keep living — they were only aggregated.
   */
  deleteGroup(groupId: string): boolean {
    const group = this._groups.get(groupId);
    if (group === undefined) return false;
    group.dispose();
    return this._groups.delete(groupId);
  }

  /**
   * The task text names this method `removeGroup(...)`, the reference code `deleteGroup(...)`.
   * Both names are supported; `removeGroup` simply delegates, so there is one implementation.
   */
  removeGroup(groupId: string): boolean {
    return this.deleteGroup(groupId);
  }

  findGroupById(groupId: string): AcademicGroup | undefined {
    return this._groups.get(groupId);
  }

  /** Search by the human-readable name, e.g. `'KN-21'` (case-insensitive). */
  findGroupByName(name: string): AcademicGroup | undefined {
    const wanted = name.trim().toLowerCase();
    return this.getAllGroups().find((group) => group.name.trim().toLowerCase() === wanted);
  }

  getAllGroups(): AcademicGroup[] {
    return [...this._groups.values()];
  }

  get groupCount(): number {
    return this._groups.size;
  }
}
