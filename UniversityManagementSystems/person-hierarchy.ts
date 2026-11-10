/**
 * Step 2. People hierarchy: abstract classes, inheritance (IS-A), encapsulation, polymorphism.
 *
 *                  Person (abstract)
 *          ┌───────────┼──────────────┐
 *       Student   Teacher (abstract)  Staff          ← extension 1
 *                 ┌────┴──────────────┐
 *            Professor        AssociateProfessor
 */
import type { AcademicTitle, Grade, Identifiable } from './basic-contracts.ts';
import { ValidationError, formatDate, requireNonEmpty, requirePositive, roundTo2 } from './validation.ts';

/* ========================================================================== */
/*  Person                                                                    */
/* ========================================================================== */

/**
 * Base class for every person at the university.
 * `abstract`: `new Person(...)` is a compile error, only concrete subclasses can be created.
 */
export abstract class Person implements Identifiable {
  /** Simple, practical email check: `something@domain.zone` with no spaces. */
  static readonly EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /** The real value lives in a private field; outside code goes through the getter/setter below. */
  private _email = '';

  constructor(
    // Parameter properties: `public readonly id: string` declares the field AND assigns it.
    // Names are readonly on purpose: a change of name is a separate business process
    // (documents, history), not a silent field assignment.
    public readonly id: string,
    public readonly firstName: string,
    public readonly lastName: string,
    email: string,
  ) {
    requireNonEmpty(id, 'Id');
    requireNonEmpty(firstName, 'First name');
    requireNonEmpty(lastName, 'Last name');
    this.email = email; // goes through the setter → validated even when the object is created
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  get email(): string {
    return this._email;
  }

  /** Validates and normalises the email: `' Ivan.M@Univ.EDU '` → `'ivan.m@univ.edu'`. */
  set email(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!Person.EMAIL_PATTERN.test(normalized)) {
      throw new ValidationError(`Invalid email: "${value}"`);
    }
    this._email = normalized;
  }

  /** Every subclass MUST describe its role in its own way (polymorphism). */
  abstract getRoleDescription(): string;

  /**
   * Concrete method of the abstract class: shared by all subclasses.
   * It calls the abstract method, and JavaScript picks the right implementation at runtime.
   */
  describe(): string {
    return `${this.fullName} <${this.email}> — ${this.getRoleDescription()}`;
  }
}

/* ========================================================================== */
/*  Student                                                                   */
/* ========================================================================== */

export class Student extends Person {
  static readonly MIN_SCORE = 0;
  static readonly MAX_SCORE = 100;
  /** Minimal score that counts as "course passed" (Ukrainian 100-point scale, E/"satisfactory"). */
  static readonly PASSING_SCORE = 60;

  /** Private grade book: only Student's own methods can change it. */
  private readonly _grades: Grade[] = [];

  constructor(
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    public readonly studentCardNumber: string,
  ) {
    super(id, firstName, lastName, email); // the parent part of the object is built first
    requireNonEmpty(studentCardNumber, 'Student card number');
  }

  /**
   * Adds a grade after validating it.
   * A defensive copy is stored, so changing the original object later cannot change the grade book.
   */
  addGrade(grade: Grade): void {
    requireNonEmpty(grade.courseId, 'Course id');

    if (!Number.isFinite(grade.score) || grade.score < Student.MIN_SCORE || grade.score > Student.MAX_SCORE) {
      throw new ValidationError(
        `Score must be in the range ${Student.MIN_SCORE}–${Student.MAX_SCORE}, got ${grade.score}`,
      );
    }
    if (!(grade.date instanceof Date) || Number.isNaN(grade.date.getTime())) {
      throw new ValidationError('Grade date must be a valid Date');
    }

    this._grades.push(
      Object.freeze({ courseId: grade.courseId, score: grade.score, date: new Date(grade.date) }),
    );
  }

  /**
   * Returns the grades as `readonly Grade[]`:
   * - the compiler forbids `push`, `splice`, index assignment on the result;
   * - it is a copy, so even a forced cast cannot damage the private array.
   */
  getGrades(): readonly Grade[] {
    return [...this._grades];
  }

  /** GPA = average of all scores on the 100-point scale, rounded to 2 decimals. 0 if there are no grades. */
  calculateGPA(): number {
    if (this._grades.length === 0) return 0;
    const total = this._grades.reduce((sum, grade) => sum + grade.score, 0);
    return roundTo2(total / this._grades.length);
  }

  /** Best score for the course, or `undefined` if the student has no grade for it. */
  getBestScore(courseId: string): number | undefined {
    const scores = this._grades.filter((g) => g.courseId === courseId).map((g) => g.score);
    return scores.length === 0 ? undefined : Math.max(...scores);
  }

  /** Course is passed when the best score for it is at least PASSING_SCORE (retakes count). */
  hasPassed(courseId: string): boolean {
    const best = this.getBestScore(courseId);
    return best !== undefined && best >= Student.PASSING_SCORE;
  }

  override getRoleDescription(): string {
    return `Student (card ${this.studentCardNumber}), GPA ${this.calculateGPA().toFixed(2)}`;
  }
}

/* ========================================================================== */
/*  Teachers                                                                  */
/* ========================================================================== */

/**
 * Abstract teacher: holds what all teachers share (title, base salary),
 * but HOW the salary is calculated is decided by each concrete subclass.
 */
export abstract class Teacher extends Person {
  constructor(
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    public readonly academicTitle: AcademicTitle,
    /** `protected`: visible in Professor / AssociateProfessor, hidden from outside code. */
    protected readonly baseSalary: number,
  ) {
    super(id, firstName, lastName, email);
    requirePositive(baseSalary, 'Base salary');
  }

  /** Load coefficient of the position: every concrete teacher class defines its own value. */
  abstract get loadCoefficient(): number;

  /** Polymorphic salary calculation: every subclass decides how its salary is calculated. */
  abstract calculateSalary(): number;
}

/** Professor: base salary × load coefficient 1.5 (+50 %). */
export class Professor extends Teacher {
  static readonly LOAD_COEFFICIENT = 1.5;

  constructor(id: string, firstName: string, lastName: string, email: string, baseSalary: number) {
    super(id, firstName, lastName, email, 'Professor', baseSalary);
  }

  override get loadCoefficient(): number {
    return Professor.LOAD_COEFFICIENT;
  }

  override calculateSalary(): number {
    return roundTo2(this.baseSalary * this.loadCoefficient);
  }

  override getRoleDescription(): string {
    return `Professor of the department (load coefficient ×${this.loadCoefficient})`;
  }
}

/** Associate professor: base salary × load coefficient 1.25 (+25 %). */
export class AssociateProfessor extends Teacher {
  static readonly LOAD_COEFFICIENT = 1.25;

  constructor(id: string, firstName: string, lastName: string, email: string, baseSalary: number) {
    super(id, firstName, lastName, email, 'AssociateProfessor', baseSalary);
  }

  override get loadCoefficient(): number {
    return AssociateProfessor.LOAD_COEFFICIENT;
  }

  override calculateSalary(): number {
    return roundTo2(this.baseSalary * this.loadCoefficient);
  }

  override getRoleDescription(): string {
    return `Associate professor of the department (load coefficient ×${this.loadCoefficient})`;
  }
}

/* ========================================================================== */
/*  Extension 1: Staff (administrator)                                        */
/* ========================================================================== */

/** Administrative employee: not a teacher and not a student, but still a Person. */
export class Staff extends Person {
  /** How long a service ID card is valid. */
  static readonly CARD_VALIDITY_YEARS = 3;

  constructor(
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    public readonly department: string,
    public readonly position: string,
  ) {
    super(id, firstName, lastName, email);
    requireNonEmpty(department, 'Department');
    requireNonEmpty(position, 'Position');
  }

  override getRoleDescription(): string {
    return `${this.position}, ${this.department}`;
  }

  /**
   * Service card number, e.g. `'STAFF-ADM-a-1'`: prefix + first 3 letters of the department + id.
   * `\p{L}` (any Unicode letter) keeps Cyrillic too: 'Адміністрація' → 'АДМ'.
   */
  getServiceCardNumber(): string {
    const departmentCode = this.department.replace(/[^\p{L}]/gu, '').slice(0, 3).toUpperCase() || 'GEN';
    return `STAFF-${departmentCode}-${this.id}`;
  }

  /** Generates the text of a service ID card. `issueDate` is a parameter so the output is reproducible. */
  generateIdCard(issueDate: Date = new Date()): string {
    // UTC everywhere (formatDate prints UTC too), so the printed dates never shift by a day.
    const validUntil = new Date(issueDate);
    validUntil.setUTCFullYear(validUntil.getUTCFullYear() + Staff.CARD_VALIDITY_YEARS);

    const lines = [
      'UNIVERSITY SERVICE ID',
      `No:          ${this.getServiceCardNumber()}`,
      `Name:        ${this.fullName}`,
      `Position:    ${this.position}`,
      `Department:  ${this.department}`,
      `Email:       ${this.email}`,
      `Issued:      ${formatDate(issueDate)}`,
      `Valid until: ${formatDate(validUntil)}`,
    ];
    const width = Math.max(...lines.map((line) => line.length));
    const border = `+${'-'.repeat(width + 2)}+`;
    return [border, ...lines.map((line) => `| ${line.padEnd(width)} |`), border].join('\n');
  }
}
