// Automated tests: node --test   (built into Node.js 18+, nothing to install)
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const todo = require('./todo.js');

// The functions print messages; hide them so test output stays readable.
console.log = () => {};

// Before every test: start from an empty list with ids starting at 1.
test.beforeEach(() => todo.importTasks('[]'));

test('addTask creates a task with a unique id and completed = false', () => {
  const a = todo.addTask('Learn Arrays');
  const b = todo.addTask('  Practice Loops  ', 'high', '2026-10-15');
  assert.deepEqual(a, { id: 1, title: 'Learn Arrays', completed: false, priority: 'medium', dueDate: null });
  assert.deepEqual(b, { id: 2, title: 'Practice Loops', completed: false, priority: 'high', dueDate: '2026-10-15' });
  assert.equal(todo.getTasks().length, 2);
});

test('addTask rejects empty titles, bad priority and bad dates', () => {
  assert.equal(todo.addTask(''), null);
  assert.equal(todo.addTask('   '), null);
  assert.equal(todo.addTask(42), null);
  assert.equal(todo.addTask('x', 'urgent'), null);
  assert.equal(todo.addTask('x', 'low', '2026-02-30'), null);
  assert.equal(todo.addTask('x', 'low', '15.10.2026'), null);
  assert.equal(todo.getTasks().length, 0);
});

test('ids are never reused after removing a task', () => {
  todo.addTask('A');
  todo.addTask('B');
  todo.removeTask(2);
  assert.equal(todo.addTask('C').id, 3);
});

test('markCompleted sets completed = true and rejects unknown ids', () => {
  todo.addTask('A');
  assert.equal(todo.markCompleted(1).completed, true);
  assert.equal(todo.markCompleted(1).completed, true); // already completed: still fine
  assert.equal(todo.markCompleted(999), null);
  assert.equal(todo.markCompleted('1'), null);
});

test('removeTask removes the task and rejects unknown ids', () => {
  todo.addTask('A');
  todo.addTask('B');
  assert.equal(todo.removeTask(999), null);
  assert.equal(todo.removeTask(1).title, 'A');
  assert.deepEqual(todo.getTasks().map((t) => t.id), [2]);
});

test('findTask is case-insensitive and returns all matches', () => {
  todo.addTask('Practice Loops');
  todo.addTask('Learn loop basics');
  todo.addTask('Learn Closures');
  assert.deepEqual(todo.findTask('LOOP').map((t) => t.id), [1, 2]);
  assert.deepEqual(todo.findTask('zzz'), []);
  assert.deepEqual(todo.findTask(' '), []);
});

test('countTasks and countCompletedTasks', () => {
  assert.equal(todo.countTasks(), 0);
  todo.addTask('A');
  todo.addTask('B');
  todo.addTask('C');
  todo.markCompleted(2);
  assert.equal(todo.countTasks(), 3);
  assert.equal(todo.countCompletedTasks(), 1);
});

test('export -> import gives back the same tasks', () => {
  todo.addTask('A', 'high');
  todo.addTask('B', 'low', '2026-12-01');
  todo.markCompleted(2);
  const json = todo.exportTasks();
  assert.equal(json, JSON.stringify(todo.getTasks(), null, 2));
  const before = structuredClone(todo.getTasks());
  todo.importTasks('[]');
  assert.equal(todo.importTasks(json), true);
  assert.deepEqual(todo.getTasks(), before);
  assert.equal(todo.addTask('C').id, 3); // numbering continues after imported ids
});

test('import accepts the basic format from the assignment', () => {
  const json = '[{"id":1,"title":"Learn Closures","completed":false},{"id":2,"title":"Practice Loops","completed":true}]';
  assert.equal(todo.importTasks(json), true);
  assert.equal(todo.getTasks()[0].priority, 'medium');
  assert.equal(todo.getTasks()[1].dueDate, null);
  // null priority / dueDate also mean "default"
  assert.equal(todo.importTasks('[{"id":5,"title":"A","completed":false,"priority":null,"dueDate":null}]'), true);
  assert.equal(todo.getTasks()[0].priority, 'medium');
});

test('getTasks returns copies: changing them does not change the real list', () => {
  todo.addTask('A');
  todo.getTasks()[0].title = 'Hacked';
  assert.equal(todo.getTasks()[0].title, 'A');
});

test('import rejects bad JSON and bad tasks without changing the list', () => {
  todo.addTask('Keep me');
  const bad = [
    '{ broken',
    '{"id":1}',
    '[{"id":1,"title":"","completed":false}]',
    '[{"id":0,"title":"A","completed":false}]',
    '[{"id":1,"title":"A","completed":"no"}]',
    '[{"id":1,"title":"A","completed":false},{"id":1,"title":"B","completed":false}]',
    '[{"id":1,"title":"A","completed":false,"priority":"urgent"}]',
    '[null]',
  ];
  for (const json of bad) {
    assert.equal(todo.importTasks(json), false, json);
  }
  assert.deepEqual(todo.getTasks().map((t) => t.title), ['Keep me']);
});

test('sortByName and sortByPriority return sorted copies', () => {
  todo.addTask('banana', 'low');
  todo.addTask('Apple', 'high');
  todo.addTask('cherry', 'high');
  assert.deepEqual(todo.sortByName().map((t) => t.title), ['Apple', 'banana', 'cherry']);
  assert.deepEqual(todo.sortByPriority().map((t) => t.id), [2, 3, 1]);
  assert.deepEqual(todo.getTasks().map((t) => t.id), [1, 2, 3]); // original order untouched
});

test('showStatistics', () => {
  assert.deepEqual(todo.showStatistics(), { total: 0, completed: 0, open: 0, completionRate: 0 });
  for (let i = 1; i <= 10; i++) todo.addTask('Task ' + i);
  for (let i = 1; i <= 7; i++) todo.markCompleted(i);
  assert.deepEqual(todo.showStatistics(), { total: 10, completed: 7, open: 3, completionRate: 70 });
});
