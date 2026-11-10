/**
 * To-Do List Manager — console JavaScript application.
 *
 * Homework for SoftServe JS Session 02 (Arrays, Objects, Loops, Functions,
 * Scope, JSON, array methods push / splice / find / filter / map).
 *
 * How to run (Node.js):
 *   node todo.js          -> scripted demo of every feature (used for screenshots)
 *   node todo.js --menu   -> interactive menu (the "Suggested Application Flow")
 *   node --test           -> automated tests from todo.test.js
 */

'use strict';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

// Allowed priorities and their "weight" (used for sorting: high comes first).
const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };
const PRIORITIES = Object.keys(PRIORITY_WEIGHT); // ['high', 'medium', 'low']
const DEFAULT_PRIORITY = 'medium';

// The task list. Every task: { id, title, completed, priority, dueDate }.
// Declared with `let` because importTasks() replaces the whole list.
let tasks = [];

// Next free id. It lives in module scope, so ids keep growing and never repeat,
// even after a task is removed (removing id 3 does NOT make 3 free again).
let nextId = 1;

// ---------------------------------------------------------------------------
// Helpers (validation and lookup)
// ---------------------------------------------------------------------------

/** A title is valid if it is a string with at least one non-space character. */
function isValidTitle(title) {
  return typeof title === 'string' && title.trim() !== '';
}

/** An id is valid if it is a positive whole number (1, 2, 3...). */
function isValidId(id) {
  return Number.isInteger(id) && id > 0;
}

/** Priority must be one of 'high' | 'medium' | 'low'. */
function isValidPriority(priority) {
  return PRIORITIES.includes(priority);
}

/**
 * A due date must look like YYYY-MM-DD and be a real calendar date
 * ('2026-02-30' is rejected). null means "no due date".
 */
function isValidDueDate(dueDate) {
  if (dueDate === null) return true;
  if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return false;
  }
  const date = new Date(dueDate + 'T00:00:00Z');
  // If JS "rolled over" the date (Feb 30 -> Mar 2), the strings won't match.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dueDate;
}

/** Returns the task with this id, or undefined. Uses Array.prototype.find. */
function getTaskById(id) {
  return tasks.find((task) => task.id === id);
}

/** Today's LOCAL date as 'YYYY-MM-DD' (to detect overdue tasks). */
function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // months start at 0
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** One line of output for a task: "[x] 2 - Practice Functions (high, due 2026-10-15)". */
function formatTask(task) {
  const status = task.completed ? '[x]' : '[ ]';
  const details = [task.priority];
  if (task.dueDate) {
    details.push('due ' + task.dueDate);
    if (!task.completed && task.dueDate < today()) details.push('OVERDUE');
  }
  return `${status} ${task.id} - ${task.title} (${details.join(', ')})`;
}

// ---------------------------------------------------------------------------
// 1. Add Task
// ---------------------------------------------------------------------------

/**
 * Creates a task and adds it to the list.
 * @param {string} title
 * @param {string} [priority='medium'] bonus level 1
 * @param {string|null} [dueDate=null] bonus level 2, 'YYYY-MM-DD'
 * @returns {object|null} the new task, or null if the input is invalid
 */
function addTask(title, priority = DEFAULT_PRIORITY, dueDate = null) {
  if (!isValidTitle(title)) {
    console.log('Error: task title cannot be empty.');
    return null;
  }
  if (!isValidPriority(priority)) {
    console.log(`Error: priority must be one of: ${PRIORITIES.join(', ')}.`);
    return null;
  }
  if (!isValidDueDate(dueDate)) {
    console.log('Error: due date must be a real date in the format YYYY-MM-DD.');
    return null;
  }

  const task = {
    id: nextId,
    title: title.trim(),
    completed: false,
    priority,
    dueDate,
  };
  nextId++;
  tasks.push(task);

  console.log(`Task added: ${task.id} - ${task.title}`);
  return task;
}

// ---------------------------------------------------------------------------
// 2. Display All Tasks
// ---------------------------------------------------------------------------

/**
 * Prints tasks one per line using a loop.
 * @param {object[]} [list=tasks] which tasks to print (sorted / found lists reuse it)
 */
function showTasks(list = tasks) {
  if (list.length === 0) {
    console.log('No tasks.');
    return;
  }
  for (const task of list) {
    console.log(formatTask(task));
  }
}

// ---------------------------------------------------------------------------
// 3. Mark Task as Completed
// ---------------------------------------------------------------------------

/**
 * @param {number} id
 * @returns {object|null} the updated task, or null if not found
 */
function markCompleted(id) {
  if (!isValidId(id)) {
    console.log('Error: id must be a positive whole number.');
    return null;
  }
  const task = getTaskById(id);
  if (!task) {
    console.log(`Error: task with id ${id} not found.`);
    return null;
  }
  if (task.completed) {
    console.log(`Task ${id} is already completed.`);
    return task;
  }
  task.completed = true;
  console.log(`Task completed: ${task.id} - ${task.title}`);
  return task;
}

// ---------------------------------------------------------------------------
// 4. Remove Task
// ---------------------------------------------------------------------------

/**
 * Finds the task, removes it with splice and prints a confirmation.
 * @param {number} id
 * @returns {object|null} the removed task, or null if not found
 */
function removeTask(id) {
  if (!isValidId(id)) {
    console.log('Error: id must be a positive whole number.');
    return null;
  }
  const index = tasks.findIndex((task) => task.id === id);
  if (index === -1) {
    console.log(`Error: task with id ${id} not found.`);
    return null;
  }
  const [removed] = tasks.splice(index, 1);
  console.log(`Task removed: ${removed.id} - ${removed.title}`);
  return removed;
}

// ---------------------------------------------------------------------------
// 5. Search Tasks
// ---------------------------------------------------------------------------

/**
 * Case-insensitive search in titles ('loop' finds 'Practice Loops').
 * @param {string} keyword
 * @returns {object[]} all matching tasks (empty array if none or invalid keyword)
 */
function findTask(keyword) {
  if (!isValidTitle(keyword)) {
    console.log('Error: search keyword cannot be empty.');
    return [];
  }
  const needle = keyword.trim().toLowerCase();
  const found = tasks.filter((task) => task.title.toLowerCase().includes(needle));
  console.log(`Found ${found.length} task(s) for "${keyword.trim()}":`);
  showTasks(found);
  return found;
}

// ---------------------------------------------------------------------------
// 6. Count Tasks / 7. Count Completed Tasks
// ---------------------------------------------------------------------------

/** @returns {number} total number of tasks */
function countTasks() {
  const total = tasks.length;
  console.log(`Total tasks: ${total}`);
  return total;
}

/** Counts completed tasks with a classic for loop. @returns {number} */
function countCompletedTasks() {
  let completed = 0;
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].completed) completed++;
  }
  console.log(`Completed tasks: ${completed}`);
  return completed;
}

// ---------------------------------------------------------------------------
// JSON: export / import
// ---------------------------------------------------------------------------

/** @returns {string} the list as formatted JSON (2-space indent) */
function exportTasks() {
  const json = JSON.stringify(tasks, null, 2);
  console.log(json);
  return json;
}

/**
 * Replaces the current list with tasks from a JSON string.
 * Every item is checked; if anything is wrong, nothing is changed.
 * priority and dueDate are optional in the input (defaults: 'medium', null),
 * so JSON in the basic format from the assignment also imports.
 * @param {string} jsonString
 * @returns {boolean} true if imported
 */
function importTasks(jsonString) {
  let data;
  try {
    data = JSON.parse(jsonString);
  } catch (error) {
    console.log(`Error: invalid JSON (${error.message}).`);
    return false;
  }
  if (!Array.isArray(data)) {
    console.log('Error: JSON must contain an array of tasks.');
    return false;
  }

  const seenIds = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const problem = getImportProblem(item, seenIds);
    if (problem) {
      console.log(`Error: task #${i + 1} in JSON is invalid: ${problem}.`);
      return false;
    }
    seenIds.push(item.id);
  }

  // map() builds clean copies: only known fields, trimmed titles, defaults filled in.
  tasks = data.map((item) => ({
    id: item.id,
    title: item.title.trim(),
    completed: item.completed,
    priority: item.priority ?? DEFAULT_PRIORITY,
    dueDate: item.dueDate ?? null,
  }));
  // Continue numbering after the biggest imported id.
  nextId = tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;

  console.log(`Imported ${tasks.length} task(s).`);
  return true;
}

/** Describes what is wrong with one imported item, or returns '' if it is fine. */
function getImportProblem(item, seenIds) {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return 'not an object';
  if (!isValidId(item.id)) return 'id must be a positive whole number';
  if (seenIds.includes(item.id)) return `duplicate id ${item.id}`;
  if (!isValidTitle(item.title)) return 'title cannot be empty';
  if (typeof item.completed !== 'boolean') return 'completed must be true or false';
  // priority and dueDate are optional: missing or null means "use the default".
  if (item.priority != null && !isValidPriority(item.priority)) return 'unknown priority';
  if (item.dueDate != null && !isValidDueDate(item.dueDate)) return 'bad due date';
  return '';
}

// ---------------------------------------------------------------------------
// Bonus level 3: sorting (returns a sorted COPY, the original order stays)
// ---------------------------------------------------------------------------

/** A..Z by title, ignoring case. @returns {object[]} */
function sortByName() {
  const sorted = [...tasks].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  );
  console.log('Tasks sorted by name:');
  showTasks(sorted);
  return sorted;
}

/** high -> medium -> low; equal priority keeps id order. @returns {object[]} */
function sortByPriority() {
  const sorted = [...tasks].sort(
    (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || a.id - b.id
  );
  console.log('Tasks sorted by priority:');
  showTasks(sorted);
  return sorted;
}

// ---------------------------------------------------------------------------
// Bonus level 4: statistics
// ---------------------------------------------------------------------------

/** @returns {{total:number, completed:number, open:number, completionRate:number}} */
function showStatistics() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const open = total - completed;
  const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

  console.log(`Total Tasks: ${total}`);
  console.log(`Completed: ${completed}`);
  console.log(`Open: ${open}`);
  console.log(`Completion Rate: ${completionRate}%`);
  return { total, completed, open, completionRate };
}

// ---------------------------------------------------------------------------
// Demo: shows every feature, including invalid input (node todo.js)
// ---------------------------------------------------------------------------

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function runDemo() {
  section('1. Add tasks');
  addTask('Learn Arrays', 'high', '2026-11-15');
  addTask('Practice Functions', 'medium');
  addTask('Learn Closures', 'high', '2026-11-05');
  addTask('Practice Loops', 'low');
  addTask('Read about JSON', 'medium', '2026-12-01');
  addTask('Write README', 'low');

  section('2. Show tasks');
  showTasks();

  section('3. Mark tasks as completed');
  markCompleted(2);
  markCompleted(4);
  markCompleted(5);
  showTasks();

  section('4. Remove task');
  removeTask(6);

  section('5. Search tasks');
  findTask('loop');
  findTask('LEARN');

  section('6-7. Count tasks');
  countTasks();
  countCompletedTasks();

  section('Validation: invalid input is rejected');
  addTask('');
  addTask('   ');
  addTask('Task with wrong priority', 'urgent');
  addTask('Task with wrong date', 'low', '2026-02-30');
  markCompleted(999);
  markCompleted(2);
  removeTask(999);
  removeTask('abc');
  findTask(' ');

  section('Export JSON');
  const json = exportTasks();

  section('Import JSON');
  importTasks('{ broken json');
  importTasks('[{ "id": 1, "title": "", "completed": false }]');
  removeTask(1);
  console.log('After removing task 1:');
  showTasks();
  importTasks(json);
  console.log('After importing the exported JSON back:');
  showTasks();

  section('Bonus: sort by name');
  sortByName();

  section('Bonus: sort by priority');
  sortByPriority();

  section('Bonus: statistics');
  showStatistics();
}

// ---------------------------------------------------------------------------
// Interactive menu (node todo.js --menu)
// ---------------------------------------------------------------------------

const MENU = `
1. Add Task
2. Show Tasks
3. Complete Task
4. Remove Task
5. Search Task
6. Count Tasks
7. Export JSON
8. Exit
--- bonus ---
9. Import JSON
10. Sort by Name
11. Sort by Priority
12. Statistics`;

// Short version printed before every next choice, so the screen stays readable.
const SHORT_MENU =
  '\nMenu: 1 Add | 2 Show | 3 Complete | 4 Remove | 5 Search | 6 Count | 7 Export | 8 Exit' +
  '\nBonus: 9 Import | 10 Sort name | 11 Sort priority | 12 Stats';

async function runMenu() {
  const readline = require('node:readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // Reading lines through an iterator keeps every typed/piped line in a queue,
  // so nothing is lost even when input arrives faster than we ask for it.
  const lines = rl[Symbol.asyncIterator]();

  // Prints a question and waits for one line. Returns null when input ends (Ctrl+D / end of file).
  async function ask(question) {
    process.stdout.write(question);
    const { value, done } = await lines.next();
    if (done) return null;
    if (!process.stdin.isTTY) console.log(value); // echo piped input so the log reads like a session
    return value;
  }
  // Number('') is 0 and Number('abc') is NaN — both are rejected by isValidId.
  const askId = async () => Number(((await ask('Task id: ')) ?? '').trim());

  console.log('To-Do List Manager');
  console.log(MENU);
  let running = true;
  let firstRound = true;
  while (running) {
    if (!firstRound) console.log(SHORT_MENU);
    firstRound = false;
    const answer = await ask('Choose an option: ');
    if (answer === null) break; // input ended
    switch (answer.trim()) {
      case '1': {
        const title = (await ask('Title: ')) ?? '';
        if (!isValidTitle(title)) {
          addTask(title); // prints the "cannot be empty" error right away
          break;
        }
        // 'High' or ' HIGH ' typed by a person is accepted as 'high'.
        const priority = ((await ask('Priority (high/medium/low, Enter = medium): ')) ?? '').trim().toLowerCase();
        const dueDate = ((await ask('Due date YYYY-MM-DD (Enter = none): ')) ?? '').trim();
        addTask(title, priority || DEFAULT_PRIORITY, dueDate || null);
        break;
      }
      case '2': showTasks(); break;
      case '3': markCompleted(await askId()); break;
      case '4': removeTask(await askId()); break;
      case '5': findTask((await ask('Keyword: ')) ?? ''); break;
      case '6': countTasks(); countCompletedTasks(); break;
      case '7': exportTasks(); break;
      case '8': running = false; break;
      case '9': importTasks((await ask('Paste JSON (one line): ')) ?? ''); break;
      case '10': sortByName(); break;
      case '11': sortByPriority(); break;
      case '12': showStatistics(); break;
      default: console.log('Unknown option, enter a number from 1 to 12.');
    }
  }
  console.log('Bye!');
  rl.close();
}

// ---------------------------------------------------------------------------
// Start + exports for tests
// ---------------------------------------------------------------------------

module.exports = {
  addTask, showTasks, markCompleted, removeTask, findTask,
  countTasks, countCompletedTasks, exportTasks, importTasks,
  sortByName, sortByPriority, showStatistics,
  // Returns copies, so code outside this file cannot change the real tasks by accident.
  getTasks: () => tasks.map((task) => ({ ...task })),
};

// Runs only when started directly (node todo.js), not when required by tests.
if (require.main === module) {
  if (process.argv.includes('--menu')) {
    runMenu();
  } else {
    runDemo();
  }
}
