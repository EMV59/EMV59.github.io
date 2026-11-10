# To-Do List Manager

A console JavaScript application for managing a list of tasks.
Homework project for **SoftServe JS Session 02**: arrays, objects, loops, functions, scope, JSON and the array methods `push`, `splice`, `find`, `filter`, `map`.

## Application purpose

Keep a list of tasks in memory and work with it from the console: add tasks, mark them as done, remove them, search them, count them, and save or load the whole list as JSON.

## How to run

You need [Node.js](https://nodejs.org/) 18 or newer. No packages to install.

```bash
node todo.js          # scripted demo of every feature (6 tasks, valid and invalid input)
node todo.js --menu   # interactive menu
node --test           # run the 13 automated tests (todo.test.js)
```

## Files

| File | Contents |
|------|----------|
| `todo.js` | the application: all functions, the demo and the interactive menu |
| `todo.test.js` | automated tests (built-in `node:test`, nothing to install) |
| `screenshots/` | output of the program and the tests |

## Implemented features

### Data structure

Tasks are objects stored in an array:

```js
{ id: 1, title: 'Learn Arrays', completed: false, priority: 'high', dueDate: '2026-11-15' }
```

| Property | Type | Description |
|----------|------|-------------|
| `id` | number | Unique identifier. Generated automatically and never reused after a removal |
| `title` | string | Task description (surrounding spaces are trimmed) |
| `completed` | boolean | Completion status |
| `priority` | string | Bonus: `'high'`, `'medium'` (default) or `'low'` |
| `dueDate` | string or null | Bonus: `'YYYY-MM-DD'` or `null` |

### Core functions

| Function | What it does | Returns |
|----------|--------------|---------|
| `addTask(title, priority?, dueDate?)` | creates a task with a new id, `completed: false`, and adds it with `push` | the new task, or `null` |
| `showTasks()` | prints `[ ] 1 - Learn Arrays` / `[x] 2 - ...` using a `for...of` loop | — |
| `markCompleted(id)` | finds the task with `find` and sets `completed = true` | the task, or `null` |
| `removeTask(id)` | finds the index with `findIndex`, removes the task with `splice` and prints a confirmation | the removed task, or `null` |
| `findTask(keyword)` | case-insensitive title search with `filter` (`'loop'` finds `'Practice Loops'`) | array of matching tasks |
| `countTasks()` | prints `Total tasks: N` | number |
| `countCompletedTasks()` | counts with a classic `for` loop and prints `Completed tasks: N` | number |
| `exportTasks()` | `JSON.stringify(tasks, null, 2)` | JSON string |
| `importTasks(jsonString)` | `JSON.parse`, checks every task, then replaces the list (clean copies made with `map`) | `true` / `false` |

### Validation

- Empty or whitespace-only titles (`''`, `'   '`) and titles that are not strings are rejected.
- Unknown ids (`removeTask(999)`) and ids that are not positive whole numbers (`'abc'`, `0`, `-1`) are rejected for both `markCompleted` and `removeTask`.
- Marking an already completed task prints a message instead of doing it again.
- Empty search keywords are rejected.
- Priorities other than high / medium / low are rejected.
- Due dates must be in `YYYY-MM-DD` format and must be real dates: `2026-02-30` is rejected.
- Import rejects broken JSON, JSON that is not an array, duplicate ids and tasks with wrong fields. If anything is wrong, **the current list is not changed**. JSON in the basic format from the assignment (without `priority` / `dueDate`) also imports; missing or `null` fields get default values.
- In the menu, unknown options are reported and the program keeps running. Priority input is case-insensitive (`High` is accepted as `high`).

### Bonus challenges (all 4 levels)

1. **Priorities**: `addTask('Learn Closures', 'high')`.
2. **Due dates**: `addTask('Learn Arrays', 'high', '2026-11-15')`. Unfinished tasks whose due date has passed (compared with today's **local** date) are marked `OVERDUE`.
3. **Sorting**: `sortByName()` (A→Z, ignoring case) and `sortByPriority()` (high → medium → low; tasks with equal priority keep id order). Both return a sorted **copy**, so the original list keeps its order.
4. **Statistics**: `showStatistics()` prints Total Tasks, Completed, Open and Completion Rate in %. An empty list gives 0%, not a division by zero.

### Interactive menu

`node todo.js --menu` follows the suggested application flow (1 Add, 2 Show, 3 Complete, 4 Remove, 5 Search, 6 Count, 7 Export JSON, 8 Exit) and adds the bonus options 9 Import JSON, 10 Sort by Name, 11 Sort by Priority and 12 Statistics.

## Screenshots

| | |
|---|---|
| Demo: add, show, complete, remove, search, count | ![](screenshots/01-demo-core-features.png) |
| Demo: invalid input and JSON export | ![](screenshots/02-demo-validation-export.png) |
| Demo: JSON import, sorting, statistics | ![](screenshots/03-demo-import-bonus.png) |
| Interactive menu, part 1 | ![](screenshots/04-menu-session-part1.png) |
| Interactive menu, part 2 | ![](screenshots/05-menu-session-part2.png) |
| Automated tests: 13 of 13 pass | ![](screenshots/06-tests.png) |

## Challenges encountered

- **Unique ids.** Using `tasks.length + 1` breaks after a removal: with tasks 1, 2, 3, removing task 2 and adding a new task gives id 3 twice. I solved it with a `nextId` counter in module scope that only grows. After an import it continues from the biggest imported id.
- **Removing from an array.** `splice` needs an index, not an id. `findIndex` returns `-1` when nothing matches, and that case must be checked first: `splice(-1, 1)` would silently remove the **last** task.
- **Safe import.** `JSON.parse` throws an error on broken text, so it is wrapped in `try...catch`. Every item is checked **before** the list is replaced, so one bad task cannot leave the list half-imported.
- **Date validation.** `new Date('2026-02-30')` does not fail; JavaScript rolls it over to March 2. To catch this, the date is converted back to a string and compared with the input.
- **Sorting without changing the list.** `sort()` changes the array it is called on, so I sort a copy (`[...tasks].sort(...)`).
- **Reading console input.** `readline.question()` lost lines when input was piped in. Reading lines through the async iterator of `readline` keeps them in a queue.

## Lessons learned

- How an array of objects works as a small in-memory database, and which array method fits which job: `push` to add, `find` / `findIndex` to locate, `splice` to remove, `filter` to search and count, `map` to transform, `reduce` to compute a single value (the biggest id).
- Scope: `tasks` and `nextId` live at module level and are shared by all functions, while each function keeps its own local variables.
- `JSON.stringify` and `JSON.parse` turn data into text and back, which is the basis for saving data or sending it over the network.
- Validate input at the start of every function and return early. This keeps the main logic simple.
- Returning values (`task`, `null`, `true` / `false`) instead of only printing makes functions reusable and testable. The 13 automated tests caught mistakes faster than checking the output by hand.
