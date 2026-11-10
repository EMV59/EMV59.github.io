/**
 * Step 3. Learning units: AGGREGATION (weak "has-a").
 *
 * Course and AcademicGroup only keep REFERENCES to Teacher / Student objects that were created
 * elsewhere. They never create or destroy them: a teacher exists without the course,
 * a student exists without the group (transfer, academic leave, expulsion).
 */
import type { Identifiable } from './basic-contracts.ts';
import type { Student, Teacher } from './person-hierarchy.ts';
import { ValidationError, requireNonEmpty, requirePositive, roundTo2 } from './validation.ts';

/* ========================================================================== */
/*  Course  (aggregates Teacher; extension 2: aggregates prerequisite Courses) */
/* ========================================================================== */

export class Course implements Identifiable {
  /** AGGREGATION: the instructor is passed in from outside and can be replaced. */
  private _instructor: Teacher;
  /** Extension 2. AGGREGATION: references to other, independent courses. */
  private readonly _prerequisites: Course[] = [];
  /** Students enrolled after passing the prerequisite check (references only). */
  private readonly _enrolled = new Map<string, Student>();

  constructor(
    public readonly id: string,
    public readonly title: string,
    /** ECTS credits. */
    public readonly credits: number,
    instructor: Teacher,
    prerequisites: readonly Course[] = [],
  ) {
    requireNonEmpty(id, 'Course id');
    requireNonEmpty(title, 'Course title');
    requirePositive(credits, 'Credits');
    this._instructor = instructor;
    prerequisites.forEach((course) => this.addPrerequisite(course));
  }

  get instructor(): Teacher {
    return this._instructor;
  }

  /**
   * Replaces the instructor. The previous teacher object is not affected and keeps existing.
   * (The reference code also prints a log line here; logging is left to the caller — see main.ts.)
   */
  reassignInstructor(newInstructor: Teacher): void {
    this._instructor = newInstructor;
  }

  /* ---------- Extension 2: prerequisites ---------- */

  /** `prerequisites: Course[]` from the task, exposed read-only (a copy): add through addPrerequisite. */
  get prerequisites(): readonly Course[] {
    return [...this._prerequisites];
  }

  /** Adds a prerequisite. Forbids the course itself, duplicates and cycles (A → B → A). */
  addPrerequisite(course: Course): void {
    if (course === this) {
      throw new ValidationError(`Course "${this.title}" cannot be a prerequisite of itself`);
    }
    if (this._prerequisites.includes(course)) {
      throw new ValidationError(`"${course.title}" is already a prerequisite of "${this.title}"`);
    }
    if (course.dependsOn(this)) {
      throw new ValidationError(
        `Cyclic prerequisite: "${course.title}" already requires "${this.title}"`,
      );
    }
    this._prerequisites.push(course);
  }

  /** True if `course` is a direct or indirect (transitive) prerequisite of this course. */
  dependsOn(course: Course): boolean {
    return this._prerequisites.some((pre) => pre === course || pre.dependsOn(course));
  }

  /** Direct prerequisites the student has NOT passed yet (empty array = may enroll). */
  getMissingPrerequisites(student: Student): Course[] {
    return this._prerequisites.filter((pre) => !student.hasPassed(pre.id));
  }

  /** Check "before enrolment": has the student closed all required courses? */
  canEnroll(student: Student): boolean {
    return this.getMissingPrerequisites(student).length === 0;
  }

  /** Enrols the student or throws an error that lists the missing courses. */
  enroll(student: Student): void {
    const missing = this.getMissingPrerequisites(student);
    if (missing.length > 0) {
      const titles = missing.map((course) => `"${course.title}"`).join(', ');
      throw new ValidationError(`${student.fullName} cannot enroll in "${this.title}": not passed ${titles}`);
    }
    if (this._enrolled.has(student.id)) {
      throw new ValidationError(`${student.fullName} is already enrolled in "${this.title}"`);
    }
    this._enrolled.set(student.id, student);
  }

  getEnrolledStudents(): readonly Student[] {
    return [...this._enrolled.values()];
  }
}

/* ========================================================================== */
/*  AcademicGroup  (aggregates Students and a curator Teacher)                */
/* ========================================================================== */

export class AcademicGroup implements Identifiable {
  /** AGGREGATION: id → reference to a student that exists on its own. Map gives O(1) duplicate check. */
  private readonly _students = new Map<string, Student>();
  /** AGGREGATION: the curator is optional — a new group may not have one yet. */
  private _curator: Teacher | undefined;
  /** Set when the owning Faculty deletes the group: the object must not be used any more. */
  private _disposed = false;

  /** The human-readable name without surrounding spaces, e.g. `'KN-21'`. */
  public readonly name: string;

  constructor(
    public readonly id: string,
    name: string,
    curator?: Teacher,
  ) {
    requireNonEmpty(id, 'Group id');
    this.name = requireNonEmpty(name, 'Group name').trim();
    this._curator = curator;
  }

  get curator(): Teacher | undefined {
    return this._curator;
  }

  /** Appoints (or replaces) the curator of the group. */
  assignCurator(teacher: Teacher): void {
    this.ensureActive();
    this._curator = teacher;
  }

  /** The group stays without a curator (e.g. the curator went on leave). */
  unassignCurator(): void {
    this.ensureActive();
    this._curator = undefined;
  }

  get size(): number {
    return this._students.size;
  }

  /** `true` after the faculty has deleted the group. */
  get isDisposed(): boolean {
    return this._disposed;
  }

  addStudent(student: Student): void {
    this.ensureActive();
    if (this._students.has(student.id)) {
      throw new ValidationError(`Student ${student.fullName} is already in group ${this.name}`);
    }
    this._students.set(student.id, student);
  }

  /** Removes the student FROM THE GROUP only; the Student object itself keeps existing. */
  removeStudent(studentId: string): boolean {
    this.ensureActive();
    return this._students.delete(studentId);
  }

  hasStudent(studentId: string): boolean {
    return this._students.has(studentId);
  }

  /** A new array each time: changing it does not change the group. */
  getStudents(): Student[] {
    return [...this._students.values()];
  }

  /**
   * Average GPA of the group, rounded to 2 decimals.
   * Students WITHOUT grades are skipped: a newcomer with GPA 0 would unfairly lower the average.
   * Returns 0 if no student in the group has grades.
   */
  getGroupAverageScore(): number {
    const graded = this.getStudents().filter((student) => student.getGrades().length > 0);
    if (graded.length === 0) return 0;
    const total = graded.reduce((sum, student) => sum + student.calculateGPA(), 0);
    return roundTo2(total / graded.length);
  }

  /**
   * End of the life cycle in the composition. Called by `Faculty.deleteGroup` — do not call it directly.
   * (TypeScript has no "package-private" modifier, so the method has to be public.)
   * The group drops its links and refuses any further changes; the students and the curator
   * themselves are not touched — they were only aggregated.
   */
  dispose(): void {
    this._students.clear();
    this._curator = undefined;
    this._disposed = true;
  }

  private ensureActive(): void {
    if (this._disposed) {
      throw new ValidationError(`Group ${this.name} was deleted from its faculty and cannot be changed`);
    }
  }
}
