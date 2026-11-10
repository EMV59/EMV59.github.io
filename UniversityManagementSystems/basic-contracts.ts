/**
 * Step 1. Basic contracts.
 *
 * This file contains ONLY types (interfaces and type aliases): no classes and no runtime code.
 * After compilation it is empty: TypeScript erases types ("type erasure").
 * Every other file depends on these contracts, never the other way round.
 */

/** Allowed id types. Most entities use string ids (`'s-101'`), but a numeric id is also possible. */
export type EntityId = string | number;

/**
 * Anything that can be stored in a repository has a unique, unchangeable id.
 *
 * The type parameter has a DEFAULT value, so `Identifiable` means `Identifiable<string>`.
 */
export interface Identifiable<ID extends EntityId = string> {
  readonly id: ID;
}

/**
 * Academic positions of the teaching staff (union of string literals).
 * The compiler rejects any other string, e.g. `'Profesor'` with a typo.
 */
export type AcademicTitle = 'Assistant' | 'AssociateProfessor' | 'Professor';

/**
 * One grade of a student (association Student → Grade, Grade → Course by id).
 * All fields are `readonly`: a grade that has been given cannot be edited, only a new one can be added.
 */
export interface Grade {
  /** Id of the course the grade belongs to, e.g. `'c-ts'`. */
  readonly courseId: string;
  /** Score on the 100-point scale, from 0 to 100 inclusive. */
  readonly score: number;
  /** When the grade was given. */
  readonly date: Date;
}
