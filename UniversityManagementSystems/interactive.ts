/**
 * Interactive playground (not required by the task).  Run:  npm run play
 *
 * Starts with the same data as main.ts and lets you try every class from a text menu.
 * Errors (invalid email, score 150, ...) are shown instead of stopping the program.
 */
import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';

import { Faculty } from './faculty.ts';
import { Course } from './learning-units.ts';
import { AssociateProfessor, Professor, Student, type Teacher } from './person-hierarchy.ts';
import { JsonReportGenerator, XmlReportGenerator } from './reports.ts';
import { InMemoryRepository } from './repository.ts';

/* ---------- initial data ---------- */

const teachers: Teacher[] = [
  new Professor('t-1', 'Taras', 'Shevchenko', 't.shevchenko@univ.edu', 20_000),
  new AssociateProfessor('t-2', 'Olena', 'Koval', 'o.koval@univ.edu', 16_000),
];
const faculty = new Faculty('f-1', 'Faculty of Computer Science');
const group = faculty.createGroup('g-kn21', 'KN-21', teachers[1]);
const courses = new Map<string, Course>();
const tsCourse = new Course('c-ts', 'TypeScript Enterprise Patterns', 5, teachers[0]!);
courses.set(tsCourse.id, tsCourse);
courses.set('c-oop', new Course('c-oop', 'Object-Oriented Design', 4, teachers[1]!, [tsCourse]));

const students = new InMemoryRepository<Student>();
for (const s of [
  new Student('s-101', 'Ivan', 'Melnyk', 'ivan.m@univ.edu', 'KB123456'),
  new Student('s-102', 'Anna', 'Boiko', 'anna.b@univ.edu', 'KB123457'),
]) {
  await students.save(s);
  group.addStudent(s);
}

/* ---------- menu ---------- */

const rl = createInterface({ input, output, terminal: false });
const lines = rl[Symbol.asyncIterator](); // reading line by line also works when input is piped

async function ask(question: string): Promise<string> {
  output.write(`  ${question}: `);
  const next = await lines.next();
  if (next.done) throw new EndOfInput();
  if (!input.isTTY) output.write(`${next.value}\n`); // echo piped input so the log is readable
  return next.value.trim();
}

class EndOfInput extends Error {}

async function pickStudent(): Promise<Student> {
  const id = await ask('student id (e.g. s-101)');
  const student = await students.findById(id);
  if (student === null) throw new Error(`No student with id "${id}"`);
  return student;
}

async function pickCourse(): Promise<Course> {
  const id = await ask(`course id (${[...courses.keys()].join(' / ')})`);
  const course = courses.get(id);
  if (course === undefined) throw new Error(`No course with id "${id}"`);
  return course;
}

const actions: Record<string, [string, () => Promise<void>]> = {
  '1': ['List students (repository.findAll)', async () => {
    for (const s of await students.findAll()) {
      console.log(`  ${s.id.padEnd(7)} ${s.fullName.padEnd(20)} ${s.email.padEnd(24)} GPA ${s.calculateGPA().toFixed(2)}  in group: ${group.hasStudent(s.id) ? 'yes' : 'no'}`);
    }
  }],
  '2': ['Add a new student (+ to group KN-21)', async () => {
    const student = new Student(
      await ask('id'), await ask('first name'), await ask('last name'), await ask('email'), await ask('student card number'),
    );
    if ((await students.findById(student.id)) !== null) throw new Error(`Id "${student.id}" is already taken`);
    group.addStudent(student);
    await students.save(student);
    console.log(`  ✓ added: ${student.describe()}`);
  }],
  '3': ['Give a grade', async () => {
    const student = await pickStudent();
    const course = await pickCourse();
    const score = Number(await ask('score 0–100'));
    student.addGrade({ courseId: course.id, score, date: new Date() });
    console.log(`  ✓ ${student.fullName}: grades [${student.getGrades().map((g) => g.score).join(', ')}], GPA ${student.calculateGPA().toFixed(2)}`);
  }],
  '4': ['Change a student\'s email (setter validation)', async () => {
    const student = await pickStudent();
    student.email = await ask('new email');
    console.log(`  ✓ saved as: ${student.email}`);
  }],
  '5': ['Group KN-21: students and average score', async () => {
    console.log(`  curator: ${group.curator?.fullName ?? '—'}, students: ${group.size}, average score: ${group.getGroupAverageScore().toFixed(2)}`);
    group.getStudents().forEach((s) => console.log(`    - ${s.fullName} (GPA ${s.calculateGPA().toFixed(2)})`));
  }],
  '6': ['Remove a student from the group (aggregation)', async () => {
    const student = await pickStudent();
    console.log(`  removeStudent → ${group.removeStudent(student.id)}; the student still exists in the repository: ${(await students.findById(student.id))?.fullName}`);
  }],
  '7': ['Teachers and salaries (polymorphism)', async () => {
    teachers.forEach((t) => console.log(`  ${t.fullName.padEnd(18)} ${t.getRoleDescription()} → ${t.calculateSalary()} UAH`));
  }],
  '8': ['Enroll in a course (prerequisite check)', async () => {
    const student = await pickStudent();
    const course = await pickCourse();
    course.enroll(student);
    console.log(`  ✓ enrolled in "${course.title}"`);
  }],
  '9': ['Find students by minimal GPA (findWhere)', async () => {
    const min = Number(await ask('minimal GPA'));
    const found = await students.findWhere((s) => s.calculateGPA() >= min);
    console.log(`  ${found.length} found: ${found.map((s) => `${s.fullName} (${s.calculateGPA().toFixed(2)})`).join(', ') || '—'}`);
  }],
  '10': ['Group report as XML', async () => console.log(new XmlReportGenerator().generate(group))],
  '11': ['Group report as JSON', async () => console.log(new JsonReportGenerator().generate(group))],
};

console.log('University playground — the same classes as main.ts. Errors are shown, not fatal.');
try {
  for (;;) {
    console.log('\n' + Object.entries(actions).map(([key, [label]]) => `  ${key.padStart(2)}. ${label}`).join('\n') + '\n   0. Exit');
    const choice = await ask('choose');
    if (choice === '0') break;
    const action = actions[choice];
    if (action === undefined) {
      console.log('  unknown option');
      continue;
    }
    try {
      await action[1]();
    } catch (error) {
      if (error instanceof EndOfInput) throw error;
      console.log(`  ✗ ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
    }
  }
} catch (error) {
  if (!(error instanceof EndOfInput)) throw error;
} finally {
  rl.close();
  console.log('\nBye!');
}
