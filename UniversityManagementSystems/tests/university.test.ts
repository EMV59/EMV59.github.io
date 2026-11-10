/**
 * Automated checks for every item of the task checklist and every extension.
 * Run:  npm test   (node:test runner through tsx — nothing extra to install)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Grade, Identifiable } from '../basic-contracts.ts';
import { Faculty } from '../faculty.ts';
import { AcademicGroup, Course } from '../learning-units.ts';
import { AssociateProfessor, Person, Professor, Staff, Student, Teacher } from '../person-hierarchy.ts';
import { JsonReportGenerator, XmlReportGenerator, escapeXml } from '../reports.ts';
import { InMemoryRepository, type IRepository } from '../repository.ts';
import { ValidationError } from '../validation.ts';

const day = (iso: string): Date => new Date(`${iso}T10:00:00Z`);
const grade = (score: number, courseId = 'c-ts', date = day('2026-10-01')): Grade => ({ courseId, score, date });

const makeStudent = (id = 's-1', email = `${id}@univ.edu`): Student =>
  new Student(id, 'Ivan', 'Melnyk', email, `KB-${id}`);
const makeProfessor = (): Professor => new Professor('t-1', 'Taras', 'Shevchenko', 't.s@univ.edu', 20_000);
const makeDocent = (): AssociateProfessor => new AssociateProfessor('t-2', 'Olena', 'Koval', 'o.k@univ.edu', 16_000);

/* ------------------------------------------------------------------------ */

describe('Person (abstract) and email validation', () => {
  it('is abstract: subclasses are Person instances, the class itself cannot be instantiated', () => {
    // Compile-time check only (abstract classes exist at run time, so nothing is executed here):
    // `npm run typecheck` fails if `new Person(...)` ever becomes allowed.
    // @ts-expect-error — cannot create an instance of an abstract class
    const forbidden = (): Person => new Person('p', 'A', 'B', 'a@b.cd');
    assert.equal(typeof forbidden, 'function');
    assert.ok(makeStudent() instanceof Person);
    assert.ok(makeProfessor() instanceof Person);
  });

  it('validates and normalises email in the constructor and in the setter', () => {
    const student = makeStudent('s-1', '  Ivan.M@Univ.EDU ');
    assert.equal(student.email, 'ivan.m@univ.edu');

    for (const bad of ['', 'no-at-sign.com', 'a@b', 'two words@univ.edu', '@univ.edu', 'a@.c']) {
      assert.throws(() => makeStudent('s-x', bad), ValidationError, `"${bad}" must be rejected`);
      assert.throws(() => { student.email = bad; }, ValidationError);
    }
    assert.equal(student.email, 'ivan.m@univ.edu', 'a failed setter call does not change the value');

    student.email = 'new.mail@univ.edu';
    assert.equal(student.email, 'new.mail@univ.edu');
  });

  it('rejects empty id and names; fullName joins first and last name', () => {
    assert.throws(() => new Student(' ', 'A', 'B', 'a@b.cd', 'KB'), ValidationError);
    assert.throws(() => new Student('s', '', 'B', 'a@b.cd', 'KB'), ValidationError);
    assert.throws(() => new Student('s', 'A', ' ', 'a@b.cd', 'KB'), ValidationError);
    assert.equal(makeStudent().fullName, 'Ivan Melnyk');
  });

  it('getRoleDescription is polymorphic and used by describe()', () => {
    const people: Person[] = [makeStudent(), makeProfessor(), makeDocent(), new Staff('a', 'I', 'B', 'i@b.cd', 'Admin', 'Clerk')];
    const roles = people.map((p) => p.getRoleDescription());
    assert.equal(new Set(roles).size, 4, 'every class describes itself differently');
    assert.match(people[0]!.describe(), /^Ivan Melnyk <s-1@univ\.edu> — Student/);
  });
});

describe('Student: private grades, readonly view, GPA', () => {
  it('calculates GPA as the average score rounded to 2 decimals (0 without grades)', () => {
    const student = makeStudent();
    assert.equal(student.calculateGPA(), 0);
    [90, 85, 86].forEach((s) => student.addGrade(grade(s)));
    assert.equal(student.calculateGPA(), 87); // 261 / 3
    student.addGrade(grade(100));
    assert.equal(student.calculateGPA(), 90.25);
    student.addGrade(grade(0));
    assert.equal(student.calculateGPA(), 72.2);
  });

  it('accepts the boundaries 0 and 100 and rejects everything outside', () => {
    const student = makeStudent();
    student.addGrade(grade(0));
    student.addGrade(grade(100));
    student.addGrade(grade(59.5));
    for (const bad of [-1, -0.01, 100.01, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => student.addGrade(grade(bad)), ValidationError, `score ${bad}`);
    }
    assert.throws(() => student.addGrade(grade(80, '  ')), ValidationError, 'empty course id');
    assert.throws(() => student.addGrade(grade(80, 'c', new Date('invalid'))), ValidationError, 'invalid date');
    assert.equal(student.getGrades().length, 3, 'rejected grades are not stored');
  });

  it('exposes grades as readonly Grade[]: mutating methods are compile errors', () => {
    const student = makeStudent();
    student.addGrade(grade(70));

    const view = student.getGrades();
    // @ts-expect-error — compile-time check: push does not exist on readonly Grade[]
    view.push(grade(1));
    // @ts-expect-error — compile-time check: index signature of readonly Grade[] only permits reading
    view[0] = grade(1);
    assert.equal(student.getGrades().length, 1, 'even if forced at runtime, only the copy changed');
    assert.equal(student.getGrades()[0]?.score, 70);
  });

  it('a forced cast of the returned array does not affect the private array', () => {
    const student = makeStudent();
    const original = { courseId: 'c-ts', score: 70, date: day('2026-10-01') };
    student.addGrade(original);

    (student.getGrades() as Grade[]).length = 0;
    (original as { score: number }).score = 0;
    original.date.setFullYear(2000);

    const [stored] = student.getGrades();
    assert.equal(student.getGrades().length, 1);
    assert.equal(stored?.score, 70);
    assert.equal(stored?.date.getUTCFullYear(), 2026);
    assert.ok(Object.isFrozen(stored), 'stored grade objects are frozen');
  });

  it('hasPassed uses the best score (retakes count), threshold 60', () => {
    const student = makeStudent();
    assert.equal(student.hasPassed('c-ts'), false);
    student.addGrade(grade(59));
    assert.equal(student.hasPassed('c-ts'), false);
    student.addGrade(grade(60));
    assert.equal(student.hasPassed('c-ts'), true);
    assert.equal(student.getBestScore('c-ts'), 60);
    assert.equal(student.hasPassed('other'), false);
  });
});

describe('Teachers: abstract Teacher, different salary coefficients', () => {
  it('Professor ×1.5, AssociateProfessor ×1.25', () => {
    assert.equal(makeProfessor().calculateSalary(), 30_000);
    assert.equal(makeDocent().calculateSalary(), 20_000);
    assert.notEqual(Professor.LOAD_COEFFICIENT, AssociateProfessor.LOAD_COEFFICIENT);
  });

  it('sets the academic title automatically and validates the salary', () => {
    assert.equal(makeProfessor().academicTitle, 'Professor');
    assert.equal(makeDocent().academicTitle, 'AssociateProfessor');
    assert.ok(makeProfessor() instanceof Teacher);
    for (const bad of [0, -1, Number.NaN]) {
      assert.throws(() => new Professor('t', 'A', 'B', 'a@b.cd', bad), ValidationError);
    }
  });

  it('works polymorphically through the abstract type, including the load coefficient', () => {
    const teachers: Teacher[] = [makeProfessor(), makeDocent()];
    const payroll = teachers.reduce((sum, t) => sum + t.calculateSalary(), 0);
    assert.equal(payroll, 50_000);
    assert.deepEqual(teachers.map((t) => t.loadCoefficient), [1.5, 1.25]);
  });

  it('keeps baseSalary protected (compile-time)', () => {
    const prof = makeProfessor();
    // @ts-expect-error — baseSalary is protected: visible only inside Teacher and its subclasses
    const hidden = (): number => prof.baseSalary;
    assert.equal(typeof hidden, 'function');
  });
});

describe('Course: aggregation of Teacher', () => {
  it('keeps a reference to an existing teacher and can reassign it', () => {
    const prof = makeProfessor();
    const docent = makeDocent();
    const course = new Course('c-ts', 'TypeScript', 5, prof);
    assert.equal(course.instructor, prof, 'the same object, not a copy');
    course.reassignInstructor(docent);
    assert.equal(course.instructor, docent);
    assert.equal(prof.calculateSalary(), 30_000, 'the previous teacher still exists');
  });

  it('validates id, title and credits', () => {
    const prof = makeProfessor();
    assert.throws(() => new Course('', 'T', 5, prof), ValidationError);
    assert.throws(() => new Course('c', ' ', 5, prof), ValidationError);
    assert.throws(() => new Course('c', 'T', 0, prof), ValidationError);
  });
});

describe('AcademicGroup: aggregation of Students and curator', () => {
  it('adds, lists and removes students without destroying them', () => {
    const group = new AcademicGroup('g', 'KN-21', makeDocent());
    const a = makeStudent('s-1');
    const b = makeStudent('s-2');
    group.addStudent(a);
    group.addStudent(b);
    assert.deepEqual(group.getStudents(), [a, b]);
    assert.equal(group.getStudents()[0], a, 'stores references to the same objects');
    assert.throws(() => group.addStudent(a), ValidationError, 'duplicates are rejected');

    assert.equal(group.removeStudent('s-1'), true);
    assert.equal(group.removeStudent('s-1'), false);
    assert.equal(group.hasStudent('s-1'), false);
    assert.equal(a.fullName, 'Ivan Melnyk', 'the student object is still alive');
  });

  it('getStudents returns a copy', () => {
    const group = new AcademicGroup('g', 'KN-21');
    group.addStudent(makeStudent());
    group.getStudents().length = 0;
    assert.equal(group.size, 1);
  });

  it('curator is optional, can be assigned later and unassigned', () => {
    const group = new AcademicGroup('g', 'KN-21');
    assert.equal(group.curator, undefined);
    const docent = makeDocent();
    group.assignCurator(docent);
    assert.equal(group.curator, docent);
    group.unassignCurator();
    assert.equal(group.curator, undefined);
    assert.equal(docent.fullName, 'Olena Koval', 'the teacher keeps existing');
  });

  it('stores the name without surrounding spaces and rejects an empty one', () => {
    assert.equal(new AcademicGroup('g', '  KN-21 ').name, 'KN-21');
    assert.throws(() => new AcademicGroup('g', '   '), ValidationError);
  });

  it('average score: mean of GPAs of students that have grades', () => {
    const group = new AcademicGroup('g', 'KN-21');
    assert.equal(group.getGroupAverageScore(), 0, 'empty group');
    const a = makeStudent('s-1');
    const b = makeStudent('s-2');
    const newcomer = makeStudent('s-3');
    [a, b, newcomer].forEach((s) => group.addStudent(s));
    assert.equal(group.getGroupAverageScore(), 0, 'nobody has grades');
    a.addGrade(grade(95));
    a.addGrade(grade(87)); // GPA 91
    b.addGrade(grade(98));
    b.addGrade(grade(92)); // GPA 95
    assert.equal(group.getGroupAverageScore(), 93, 'the newcomer without grades is skipped');
    b.addGrade(grade(60)); // GPA 83.33
    assert.equal(group.getGroupAverageScore(), 87.17);
  });
});

describe('Faculty: composition of groups', () => {
  it('creates groups itself and finds them by id and name', () => {
    const faculty = new Faculty('f', 'CS');
    const group = faculty.createGroup('g-1', 'KN-21', makeDocent());
    assert.ok(group instanceof AcademicGroup);
    assert.equal(faculty.findGroupById('g-1'), group);
    assert.equal(faculty.findGroupByName(' kn-21 '), group);
    assert.equal(faculty.findGroupById('nope'), undefined);
    assert.equal(faculty.groupCount, 1);
  });

  it('rejects duplicate ids and names (names compared trimmed, case-insensitive)', () => {
    const faculty = new Faculty('f', 'CS');
    faculty.createGroup('g-1', 'KN-21 ');
    assert.throws(() => faculty.createGroup('g-1', 'KN-99'), ValidationError);
    assert.throws(() => faculty.createGroup('g-2', 'KN-21'), ValidationError);
    assert.throws(() => faculty.createGroup('g-3', ' kn-21'), ValidationError);
  });

  it('removeGroup (name from the task text) does the same as deleteGroup', () => {
    const faculty = new Faculty('f', 'CS');
    const group = faculty.createGroup('g-1', 'KN-21');
    assert.equal(faculty.removeGroup('g-1'), true);
    assert.equal(faculty.removeGroup('g-1'), false);
    assert.equal(group.isDisposed, true);
  });

  it('a deleted group cannot be changed any more ("no zombie groups")', () => {
    const faculty = new Faculty('f', 'CS');
    const group = faculty.createGroup('g-1', 'KN-21');
    faculty.deleteGroup('g-1');
    assert.throws(() => group.addStudent(makeStudent()), /was deleted/);
    assert.throws(() => group.assignCurator(makeDocent()), /was deleted/);
    assert.throws(() => group.removeStudent('s-1'), /was deleted/);
    assert.equal(group.size, 0);
    // the id is free again: the faculty may create a new group with it
    assert.equal(faculty.createGroup('g-1', 'KN-21').isDisposed, false);
  });

  it('deleteGroup ends the group life cycle, but aggregated students survive', () => {
    const faculty = new Faculty('f', 'CS');
    const group = faculty.createGroup('g-1', 'KN-21', makeDocent());
    const student = makeStudent();
    student.addGrade(grade(90));
    group.addStudent(student);

    assert.equal(faculty.deleteGroup('g-1'), true);
    assert.equal(faculty.deleteGroup('g-1'), false);
    assert.equal(faculty.findGroupById('g-1'), undefined);
    assert.deepEqual(faculty.getAllGroups(), []);
    assert.equal(group.size, 0, 'the deleted group dropped its links');
    assert.equal(group.curator, undefined);
    assert.equal(student.calculateGPA(), 90, 'the student still exists with all grades');
  });

  it('getAllGroups returns a copy', () => {
    const faculty = new Faculty('f', 'CS');
    faculty.createGroup('g-1', 'KN-21');
    faculty.getAllGroups().length = 0;
    assert.equal(faculty.groupCount, 1);
  });
});

describe('InMemoryRepository<T>: generic CRUD + findWhere', () => {
  it('implements every method of IRepository<T>', async () => {
    const repo: IRepository<Student> = new InMemoryRepository<Student>();
    const a = makeStudent('s-1');
    const b = makeStudent('s-2');

    await repo.save(a);
    await repo.save(b);
    assert.equal(await repo.findById('s-1'), a);
    assert.equal(await repo.findById('missing'), null);
    assert.deepEqual(await repo.findAll(), [a, b]);

    await repo.save(a); // upsert, no duplicates
    assert.equal((await repo.findAll()).length, 2);

    assert.equal(await repo.delete('s-1'), true);
    assert.equal(await repo.delete('s-1'), false);
    assert.deepEqual(await repo.findAll(), [b]);
  });

  it('findWhere filters with a predicate', async () => {
    const repo = new InMemoryRepository<Student>();
    const good = makeStudent('s-1');
    good.addGrade(grade(95));
    const weak = makeStudent('s-2');
    weak.addGrade(grade(40));
    await repo.save(good);
    await repo.save(weak);
    assert.deepEqual(await repo.findWhere((s) => s.calculateGPA() >= 90), [good]);
    assert.deepEqual(await repo.findWhere(() => false), []);
  });

  it('findAll returns a copy', async () => {
    const repo = new InMemoryRepository<Student>();
    await repo.save(makeStudent());
    (await repo.findAll()).length = 0;
    assert.equal((await repo.findAll()).length, 1);
  });

  it('is generic: works for other types and for numeric ids', async () => {
    const teachers = new InMemoryRepository<Teacher>();
    await teachers.save(makeProfessor());
    assert.equal((await teachers.findById('t-1'))?.academicTitle, 'Professor');

    interface Room extends Identifiable<number> { readonly seats: number }
    const rooms = new InMemoryRepository<Room, number>();
    await rooms.save({ id: 101, seats: 30 });
    assert.equal((await rooms.findById(101))?.seats, 30);
  });

  it('accepts only Identifiable types (compile-time constraint)', () => {
    // @ts-expect-error — { name } has no `id`, so it does not satisfy T extends Identifiable
    const repo = new InMemoryRepository<{ name: string }>();
    assert.ok(repo);
  });
});

/* ------------------------------------------------------------------------ */

describe('Extension 1: Staff', () => {
  it('is a Person with a department and generates a service ID card', () => {
    const admin = new Staff('a-1', 'Iryna', 'Bondar', 'i.bondar@univ.edu', 'Administration', 'Manager');
    assert.ok(admin instanceof Person);
    assert.equal(admin.getServiceCardNumber(), 'STAFF-ADM-a-1');
    const card = admin.generateIdCard(day('2026-11-10'));
    for (const text of ['STAFF-ADM-a-1', 'Iryna Bondar', 'Administration', 'Issued:      2026-11-10', 'Valid until: 2029-11-10']) {
      assert.ok(card.includes(text), `card contains "${text}"`);
    }
    const widths = new Set(card.split('\n').map((line) => line.length));
    assert.equal(widths.size, 1, 'all card lines have equal width');
    assert.throws(() => new Staff('a', 'I', 'B', 'i@b.cd', ' ', 'Manager'), ValidationError);
  });

  it('builds the department code from any letters (Cyrillic too) and handles 29 February', () => {
    const clerk = new Staff('a-2', 'Iryna', 'Bondar', 'i.b@univ.edu', 'Адміністрація', 'Clerk');
    assert.equal(clerk.getServiceCardNumber(), 'STAFF-АДМ-a-2');
    assert.equal(new Staff('a-3', 'I', 'B', 'i@b.cd', '123', 'Clerk').getServiceCardNumber(), 'STAFF-GEN-a-3');
    const card = clerk.generateIdCard(new Date('2028-02-29T23:30:00Z'));
    assert.ok(card.includes('Issued:      2028-02-29'));
    assert.ok(card.includes('Valid until: 2031-03-01'), '2031 has no 29 February → 1 March');
  });
});

describe('Extension 2: course prerequisites', () => {
  const prof = makeProfessor();

  it('checks passed prerequisites before enrolment', () => {
    const basics = new Course('c-1', 'Basics', 5, prof);
    const advanced = new Course('c-2', 'Advanced', 5, prof, [basics]);
    const student = makeStudent();

    assert.equal(advanced.canEnroll(student), false);
    assert.deepEqual(advanced.getMissingPrerequisites(student), [basics]);
    assert.throws(() => advanced.enroll(student), /not passed "Basics"/);

    student.addGrade(grade(75, 'c-1'));
    assert.equal(advanced.canEnroll(student), true);
    advanced.enroll(student);
    assert.deepEqual(advanced.getEnrolledStudents(), [student]);
    assert.throws(() => advanced.enroll(student), ValidationError, 'no double enrolment');
  });

  it('a course without prerequisites is open to everybody', () => {
    assert.equal(new Course('c-0', 'Intro', 3, prof).canEnroll(makeStudent()), true);
  });

  it('rejects self-reference, duplicates and cycles (also indirect ones)', () => {
    const a = new Course('a', 'A', 1, prof);
    const b = new Course('b', 'B', 1, prof, [a]);
    const c = new Course('c', 'C', 1, prof, [b]);
    assert.throws(() => a.addPrerequisite(a), /itself/);
    assert.throws(() => b.addPrerequisite(a), /already/);
    assert.throws(() => a.addPrerequisite(c), /Cyclic/, 'A → C → B → A');
    assert.equal(c.dependsOn(a), true);
    assert.equal(a.dependsOn(c), false);
    assert.equal(a.prerequisites.length, 0);
    assert.deepEqual(c.prerequisites, [b]);
    (c.prerequisites as Course[]).length = 0;
    assert.equal(c.prerequisites.length, 1, 'prerequisites is a read-only copy');
  });
});

describe('Extension 3: reports (Template Method)', () => {
  function makeGroup(): AcademicGroup {
    const group = new AcademicGroup('g-1', 'KN-21 <A&B>', makeDocent());
    const weak = makeStudent('s-1');
    weak.addGrade(grade(70));
    const strong = new Student('s-2', 'Anna', 'Boiko', 'anna@univ.edu', 'KB2');
    strong.addGrade(grade(95));
    group.addStudent(weak);
    group.addStudent(strong);
    return group;
  }

  it('JSON report is one valid JSON document, ranked by GPA', () => {
    const json = new JsonReportGenerator().generate(makeGroup(), day('2026-11-10'));
    const parsed = JSON.parse(json);
    assert.equal(parsed.report.groupName, 'KN-21 <A&B>');
    assert.equal(parsed.report.curator, 'Olena Koval');
    assert.equal(parsed.report.generatedAt, '2026-11-10');
    assert.deepEqual(parsed.students.map((s: { fullName: string }) => s.fullName), ['Anna Boiko', 'Ivan Melnyk']);
    assert.equal(parsed.students[0].rank, 1);
    assert.deepEqual(parsed.summary, { studentCount: 2, gradedStudentCount: 2, averageScore: 82.5 });
  });

  it('equal GPA gives equal rank; the summary says how many students the average is based on', () => {
    const group = new AcademicGroup('g', 'G');
    const [a, b, c, d] = ['s-1', 's-2', 's-3', 's-4'].map((id) => makeStudent(id));
    a!.addGrade(grade(90));
    b!.addGrade(grade(90));
    c!.addGrade(grade(80));
    [a!, b!, c!, d!].forEach((s) => group.addStudent(s)); // d has no grades
    const parsed = JSON.parse(new JsonReportGenerator().generate(group));
    assert.deepEqual(parsed.students.map((s: { rank: number }) => s.rank), [1, 1, 3, 4]);
    assert.deepEqual(parsed.summary, { studentCount: 4, gradedStudentCount: 3, averageScore: 86.67 });
  });

  it('JSON report of an empty group is still valid', () => {
    const parsed = JSON.parse(new JsonReportGenerator().generate(new AcademicGroup('g', 'Empty')));
    assert.deepEqual(parsed.students, []);
    assert.equal(parsed.report.curator, null);
  });

  it('XML report escapes special characters and keeps header → body → footer order', () => {
    const xml = new XmlReportGenerator().generate(makeGroup(), day('2026-11-10'));
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.ok(xml.includes('name="KN-21 &lt;A&amp;B&gt;"'));
    assert.ok(xml.indexOf('Anna Boiko') < xml.indexOf('Ivan Melnyk'), 'ranked by GPA');
    assert.ok(xml.trimEnd().endsWith('</groupReport>'));
    assert.ok(xml.includes('averageScore="82.50"'));
    assert.equal(escapeXml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;');
  });
});
