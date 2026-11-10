/**
 * Demonstration scenario (section 5 "Run Demo" of the task).  Run:  npx tsx main.ts   (or: npm start)
 *
 * Parts 1–4 are the required demo (teachers, faculty + group, students + grades, repository;
 * extension 4 `findWhere` is shown in part 4).
 * Part 5 contrasts aggregation with composition, parts 6–8 show extensions 1–3,
 * part 9 shows that invalid data is rejected.
 */
import type { Grade } from './basic-contracts.ts';
import { Faculty } from './faculty.ts';
import { AcademicGroup, Course } from './learning-units.ts';
import { AssociateProfessor, Person, Professor, Staff, Student, Teacher } from './person-hierarchy.ts';
import { JsonReportGenerator, ReportGenerator, XmlReportGenerator } from './reports.ts';
import { InMemoryRepository, type IReadRepository } from './repository.ts';

/* ---------- small output helpers ---------- */

function section(title: string): void {
  console.log(`\n${'='.repeat(78)}\n  ${title}\n${'='.repeat(78)}`);
}

function money(amount: number): string {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} UAH`;
}

/** Runs code that MUST fail and prints the error message instead of crashing the program. */
function expectError(label: string, action: () => unknown): void {
  try {
    action();
    console.log(`  ✗ ${label}: NO ERROR (unexpected!)`);
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.log(`  ✓ ${label} → ${message}`);
  }
}

/** Fixed dates make the output identical on every run. */
const day = (isoDate: string): Date => new Date(`${isoDate}T10:00:00Z`);

/** Dependency inversion: the function depends on the READ contract, not on InMemoryRepository. */
async function printStudentsFrom(repo: IReadRepository<Student>, title: string): Promise<void> {
  const students = await repo.findAll();
  console.log(`  ${title} (${students.length}):`);
  for (const student of students) {
    console.log(`    - ${student.id.padEnd(6)} ${student.fullName.padEnd(20)} GPA ${student.calculateGPA().toFixed(2)}`);
  }
}

function printGroup(group: AcademicGroup): void {
  const curator = group.curator ? group.curator.fullName : '— none —';
  console.log(`  Group ${group.name} [${group.id}], curator: ${curator}, students: ${group.size}`);
  for (const student of group.getStudents()) {
    console.log(`    - ${student.fullName.padEnd(20)} ${student.email}`);
  }
}

/* ========================================================================== */

async function runDemonstration(): Promise<void> {
  /* ------------------------------------------------------------------ */
  section('1. Teachers: abstract class, inheritance, polymorphism');

  const profShevchenko = new Professor('t-1', 'Taras', 'Shevchenko', 't.shevchenko@univ.edu', 20_000);
  const docentKoval = new AssociateProfessor('t-2', 'Olena', 'Koval', 'O.Koval@Univ.EDU', 16_000);
  const docentHrytsenko = new AssociateProfessor('t-3', 'Petro', 'Hrytsenko', 'p.hrytsenko@univ.edu', 17_000);

  // One array of the ABSTRACT type — each element calculates salary in its own way.
  const teachers: Teacher[] = [profShevchenko, docentKoval, docentHrytsenko];
  for (const teacher of teachers) {
    console.log(`  ${teacher.fullName.padEnd(17)} ${teacher.academicTitle.padEnd(19)} salary ${money(teacher.calculateSalary())}`);
    console.log(`    getRoleDescription(): ${teacher.getRoleDescription()}`);
  }
  console.log(`  Email normalised by the setter: "O.Koval@Univ.EDU" → "${docentKoval.email}"`);

  /* ------------------------------------------------------------------ */
  section('2. Faculty and groups: COMPOSITION');

  const csFaculty = new Faculty('f-1', 'Faculty of Computer Science');
  const groupKN21 = csFaculty.createGroup('g-kn21', 'KN-21', docentKoval);
  const groupKN22 = csFaculty.createGroup('g-kn22', 'KN-22'); // no curator yet
  groupKN22.assignCurator(docentHrytsenko);

  console.log(`  Faculty "${csFaculty.name}" created ${csFaculty.groupCount} groups itself (createGroup):`);
  for (const group of csFaculty.getAllGroups()) {
    console.log(`    - ${group.name} [${group.id}], curator: ${group.curator?.fullName ?? '— none —'}`);
  }
  console.log(`  findGroupById('g-kn21') → ${csFaculty.findGroupById('g-kn21')?.name}`);
  console.log(`  findGroupByName('kn-22') → ${csFaculty.findGroupByName('kn-22')?.name}`);
  console.log(`  findGroupById('g-xx')   → ${csFaculty.findGroupById('g-xx')}`);

  /* ------------------------------------------------------------------ */
  section('3. Students, course and grades: AGGREGATION + ENCAPSULATION');

  const studentIvan = new Student('s-101', 'Ivan', 'Melnyk', 'ivan.m@univ.edu', 'KB123456');
  const studentAnna = new Student('s-102', 'Anna', 'Boiko', 'anna.b@univ.edu', 'KB123457');
  const studentMaksym = new Student('s-103', 'Maksym', 'Lysenko', 'maksym.l@univ.edu', 'KB123458');
  const studentSofiia = new Student('s-104', 'Sofiia', 'Tkachenko', 'sofiia.t@univ.edu', 'KB123459');

  // Aggregation: the students were created OUTSIDE the group, the group only links to them.
  [studentIvan, studentAnna, studentMaksym].forEach((s) => groupKN21.addStudent(s));
  groupKN22.addStudent(studentSofiia);
  printGroup(groupKN21);

  // Aggregation: the course gets an existing teacher.
  const tsCourse = new Course('c-ts', 'TypeScript Enterprise Patterns', 5, profShevchenko);
  console.log(`\n  Course "${tsCourse.title}" (${tsCourse.credits} ECTS), instructor: ${tsCourse.instructor.fullName}`);

  const grades: Array<[Student, number, string]> = [
    [studentIvan, 95, '2026-10-01'],
    [studentIvan, 87, '2026-10-15'],
    [studentAnna, 98, '2026-10-01'],
    [studentAnna, 92, '2026-10-15'],
    [studentMaksym, 55, '2026-10-01'],
    [studentMaksym, 71, '2026-10-15'],
  ];
  for (const [student, score, date] of grades) {
    student.addGrade({ courseId: tsCourse.id, score, date: day(date) });
  }
  // Sofiia has no grades yet → GPA 0, and she is in another group.

  console.log('\n  Grades and GPA:');
  for (const student of [studentIvan, studentAnna, studentMaksym, studentSofiia]) {
    const scores = student.getGrades().map((g) => g.score).join(', ') || '—';
    console.log(`    ${student.fullName.padEnd(18)} scores [${scores}]`.padEnd(46) + `GPA ${student.calculateGPA().toFixed(2)}`);
  }
  console.log(`\n  Average score of group ${groupKN21.name}: ${groupKN21.getGroupAverageScore().toFixed(2)}`);
  console.log(`  Average score of group ${groupKN22.name}: ${groupKN22.getGroupAverageScore().toFixed(2)} (nobody has grades yet)`);

  console.log('\n  Polymorphism: describe() of the abstract Person calls each getRoleDescription():');
  const people: Person[] = [studentIvan, profShevchenko];
  people.forEach((person) => console.log(`    ${person.describe()}`));

  console.log('\n  Encapsulation of the grade book:');
  const copy = studentIvan.getGrades() as Grade[]; // force away `readonly`...
  copy.length = 0; // ...and "erase" the returned array
  console.log(`    after erasing the returned array Ivan still has ${studentIvan.getGrades().length} grades, GPA ${studentIvan.calculateGPA().toFixed(2)}`);

  console.log('\n  Course aggregation — the instructor is replaced, both objects keep living:');
  tsCourse.reassignInstructor(docentHrytsenko);
  console.log(`    [Course Info] instructor of "${tsCourse.title}" changed: ${tsCourse.instructor.fullName}`);
  console.log(`    new instructor: ${tsCourse.instructor.fullName}; previous one still exists: ${profShevchenko.fullName}, ${money(profShevchenko.calculateSalary())}`);

  /* ------------------------------------------------------------------ */
  section('4. Generic repository: IRepository<T, ID> / InMemoryRepository<T>');

  const studentRepo = new InMemoryRepository<Student>();
  for (const student of [studentIvan, studentAnna, studentMaksym, studentSofiia]) {
    await studentRepo.save(student);
  }
  const teacherRepo = new InMemoryRepository<Teacher>(); // the SAME class for another type
  for (const teacher of teachers) await teacherRepo.save(teacher);

  const found = await studentRepo.findById('s-101');
  console.log(`  findById('s-101') → ${found?.fullName} (${found?.email})`);
  console.log(`  findById('s-999') → ${await studentRepo.findById('s-999')}`);
  await printStudentsFrom(studentRepo, 'findAll()');
  console.log(`  teacherRepo.findAll() → ${(await teacherRepo.findAll()).map((t) => t.fullName).join(', ')}`);

  await studentRepo.save(studentIvan); // same id → replaced, not duplicated
  console.log(`  save(Ivan) again → still ${(await studentRepo.findAll()).length} students (upsert)`);

  // Extension 4: findWhere(predicate)
  const excellent = await studentRepo.findWhere((s) => s.calculateGPA() >= 90);
  console.log(`  findWhere(GPA >= 90) → ${excellent.map((s) => s.fullName).join(', ')}`);
  const professors = await teacherRepo.findWhere((t) => t.academicTitle === 'Professor');
  console.log(`  findWhere(title = Professor) → ${professors.map((t) => t.fullName).join(', ')}`);

  console.log(`  delete('s-104') → ${await studentRepo.delete('s-104')}, delete('s-104') again → ${await studentRepo.delete('s-104')}`);
  await printStudentsFrom(studentRepo, 'findAll() after delete');

  /* ------------------------------------------------------------------ */
  section('5. Aggregation vs composition: what survives a removal');

  console.log(`  groupKN21.removeStudent('s-103') → ${groupKN21.removeStudent('s-103')}`);
  console.log(`    ${studentMaksym.fullName} left the group but still exists: in repository → ${(await studentRepo.findById('s-103'))?.fullName}`);

  // groupKN21 is the same object the faculty returned from createGroup in part 2.
  console.log(`  csFaculty.deleteGroup('g-kn21') → ${csFaculty.deleteGroup('g-kn21')}`);
  console.log(`    groups left in faculty: ${csFaculty.getAllGroups().map((g) => g.name).join(', ')}`);
  console.log(`    the deleted group is disposed: isDisposed ${groupKN21.isDisposed}, students ${groupKN21.size}, curator ${groupKN21.curator?.fullName ?? 'none'}`);
  expectError('a deleted group cannot be used', () => groupKN21.addStudent(studentIvan));
  console.log(`    its students live on: ${studentIvan.fullName} GPA ${studentIvan.calculateGPA().toFixed(2)}, ${studentAnna.fullName} GPA ${studentAnna.calculateGPA().toFixed(2)}`);
  console.log(`    its curator lives on: ${docentKoval.fullName}, ${money(docentKoval.calculateSalary())}`);
  console.log(`  deleteGroup('g-kn21') again → ${csFaculty.deleteGroup('g-kn21')}; removeGroup('g-kn21') (name from the task text) → ${csFaculty.removeGroup('g-kn21')}`);

  /* ------------------------------------------------------------------ */
  section('6. Extension 1: Staff (administrator) and service ID card');

  const admin = new Staff('a-1', 'Iryna', 'Bondar', 'i.bondar@univ.edu', 'Administration', 'Dean office manager');
  console.log(`  ${admin.describe()}`);
  console.log(admin.generateIdCard(day('2026-11-10')).replace(/^/gm, '  '));

  /* ------------------------------------------------------------------ */
  section('7. Extension 2: course prerequisites');

  const oopCourse = new Course('c-oop', 'Object-Oriented Design', 4, docentKoval, [tsCourse]);
  console.log(`  "${oopCourse.title}" requires: ${oopCourse.prerequisites.map((c) => c.title).join(', ')}`);
  for (const student of [studentAnna, studentMaksym, studentSofiia]) {
    const missing = oopCourse.getMissingPrerequisites(student).map((c) => c.title);
    console.log(`    ${student.fullName.padEnd(17)} best TS score ${String(student.getBestScore(tsCourse.id) ?? '—').padEnd(3)} canEnroll → ${oopCourse.canEnroll(student)}${missing.length ? `  (missing: ${missing.join(', ')})` : ''}`);
  }
  oopCourse.enroll(studentAnna);
  oopCourse.enroll(studentMaksym);
  console.log(`  enrolled: ${oopCourse.getEnrolledStudents().map((s) => s.fullName).join(', ')}`);
  expectError('enroll(Sofiia)', () => oopCourse.enroll(studentSofiia));
  expectError('cycle: TS requires OOP', () => tsCourse.addPrerequisite(oopCourse));
  expectError('course requires itself', () => oopCourse.addPrerequisite(oopCourse));

  /* ------------------------------------------------------------------ */
  section('8. Extension 3: reports via the Template Method pattern');

  // A new group (its name contains <, > to show XML escaping) with the students that left KN-21.
  const groupKN23 = csFaculty.createGroup('g-kn23', 'KN-23 <honours>', profShevchenko);
  [studentAnna, studentIvan, studentMaksym].forEach((s) => groupKN23.addStudent(s));
  const generators: ReportGenerator[] = [new XmlReportGenerator(), new JsonReportGenerator()];
  for (const generator of generators) {
    console.log(`\n  --- ${generator.constructor.name}.generate(${groupKN23.name}) ---`);
    console.log(generator.generate(groupKN23, day('2026-11-10')).replace(/^/gm, '  '));
  }

  /* ------------------------------------------------------------------ */
  section('9. Validation: invalid data is rejected');

  expectError('email without @', () => new Student('s-1', 'Bad', 'Email', 'bad.email.com', 'KB1'));
  expectError('email setter', () => { studentIvan.email = 'ivan@localhost'; });
  console.log(`    Ivan's email did not change: ${studentIvan.email}`);
  expectError('score 101', () => studentIvan.addGrade({ courseId: 'c-ts', score: 101, date: new Date() }));
  expectError('score -5', () => studentIvan.addGrade({ courseId: 'c-ts', score: -5, date: new Date() }));
  expectError('score NaN', () => studentIvan.addGrade({ courseId: 'c-ts', score: Number.NaN, date: new Date() }));
  expectError('invalid date', () => studentIvan.addGrade({ courseId: 'c-ts', score: 80, date: new Date('oops') }));
  expectError('student twice in group', () => groupKN22.addStudent(studentSofiia));
  expectError('duplicate group id', () => csFaculty.createGroup('g-kn22', 'KN-99'));
  expectError('negative salary', () => new Professor('t-9', 'No', 'Money', 'no.money@univ.edu', -1));
  expectError('empty first name', () => new Student('s-2', '  ', 'X', 'x@univ.edu', 'KB2'));
  console.log(`    Ivan still has ${studentIvan.getGrades().length} grades, GPA ${studentIvan.calculateGPA().toFixed(2)}`);

  console.log('\nDemonstration finished successfully.');
}

runDemonstration().catch((error: unknown) => {
  console.error('Demonstration failed:', error);
  process.exitCode = 1;
});
