'use strict';

/* Tiny test runner: no libraries, runs in the browser (open tests.html). */

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function assert(condition, message = 'assertion failed') {
    if (!condition) throw new Error(message);
}
function assertEqual(actual, expected, label = '') {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${label} expected ${e}, got ${a}`);
}
function assertThrows(fn, ErrorClass, label = '') {
    try {
        fn();
    } catch (error) {
        if (!(error instanceof ErrorClass)) {
            throw new Error(`${label} expected ${ErrorClass.name}, got ${error.name}: ${error.message}`);
        }
        return error;
    }
    throw new Error(`${label} expected ${ErrorClass.name}, but nothing was thrown`);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A separate game on its own hidden elements, so tests do not touch the page's game
const sandbox = document.body.appendChild(document.createElement('div'));
sandbox.hidden = true;
function makeGame() {
    const el = (tag) => sandbox.appendChild(document.createElement(tag));
    return new Game({ field: el('div'), scoreEl: el('span'), speedEl: el('span'), messageEl: el('p') });
}
function key(code, extra = {}) {
    return new KeyboardEvent('keydown', { code, cancelable: true, ...extra });
}

/* ---------- 1a. Field and constants ---------- */

test('1a: field is 8x11 cells, the square size is a constant', () => {
    assertEqual([FIELD_COLS, FIELD_ROWS], [8, 11]);
    assert(Number.isInteger(CELL_SIZE) && CELL_SIZE > 0, 'CELL_SIZE must be a positive integer');
    const g = makeGame();
    assertEqual([g.field.style.width, g.field.style.height],
        [`${8 * CELL_SIZE}px`, `${11 * CELL_SIZE}px`]);
});

test('1a: positions are stored in cells and converted to pixels with CELL_SIZE', () => {
    const g = makeGame();
    g.start(5); g.stop();
    const div = g.field.querySelector('.ship');   // the player ship is added first
    assertEqual([g.player.col, g.player.row], [3, 10]);
    assertEqual([div.style.left, div.style.top], [`${3 * CELL_SIZE}px`, `${10 * CELL_SIZE}px`]);
});

/* ---------- 1b, 1d. Fleet ---------- */

test('1b: the formation is the mockup pyramid 8-8-6-4-2 (28 ships) with alternating colours', () => {
    const fleet = new Fleet(document.createElement('div'));
    fleet.spawn();
    assertEqual(fleet.ships.length, 28);
    const perRow = [-5, -4, -3, -2, -1].map((r) => fleet.ships.filter((s) => s.row === r).length);
    assertEqual(perRow, [8, 8, 6, 4, 2], 'ships per row');
    const firstInRow = (r) => fleet.ships.find((s) => s.row === r).color;
    assertEqual([firstInRow(-5), firstInRow(-4), firstInRow(-3)],
        [ALIEN_COLORS[0][0], ALIEN_COLORS[1][0], ALIEN_COLORS[0][0]], 'first colour in row');
});

test('1d: the whole fleet moves down one cell at a time', () => {
    const fleet = new Fleet(document.createElement('div'));
    fleet.spawn();
    const before = fleet.ships.map((s) => s.row);
    fleet.moveDown();
    assertEqual(fleet.ships.map((s) => s.row), before.map((r) => r + 1));
});

test('1d: the speed list is 01..10 with 05 selected by default', () => {
    const options = [...document.querySelectorAll('#speed-select option')];
    assertEqual(options.map((o) => o.textContent),
        ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
    assertEqual(document.getElementById('speed-select').value, '5');
});

/* ---------- 1c. Player and keyboard ---------- */

test('1c: arrows and A/D move the player, space shoots', () => {
    const g = makeGame();
    g.start(5);
    g.handleKey(key('ArrowLeft'));
    g.handleKey(key('KeyA'));
    assertEqual(g.player.col, 1);
    g.handleKey(key('ArrowRight'));
    g.handleKey(key('KeyD'));
    assertEqual(g.player.col, 3);
    g.handleKey(key('Space'));
    assert(g.field.querySelector('.beam'), 'space must draw a beam');
    g.stop();
});

test('1c: the player cannot leave the field (OutOfFieldError is caught, border flashes)', () => {
    const g = makeGame();
    g.start(5);
    for (let i = 0; i < 10; i++) g.handleKey(key('ArrowLeft'));
    assertEqual(g.player.col, 0);
    assert(g.field.classList.contains('field--hit-wall'), 'border must flash');
    assertThrows(() => g.player.moveBy(-1, 0), OutOfFieldError);
    for (let i = 0; i < 10; i++) g.handleKey(key('ArrowRight'));
    assertEqual(g.player.col, FIELD_COLS - 1);
    g.stop();
});

test('1c: game keys do not scroll the page; before Start keys are not intercepted', () => {
    const g = makeGame();
    const idle = key('Space');
    g.handleKey(idle);
    assert(!idle.defaultPrevented, 'before Start the space key must work normally');
    g.start(5);
    const running = key('ArrowLeft');
    g.handleKey(running);
    assert(running.defaultPrevented, 'during the game arrows must not scroll');
    const other = key('KeyQ');
    g.handleKey(other);
    assert(!other.defaultPrevented, 'other keys are not touched');
    g.stop();
});

test('1c: holding space does not auto-fire', () => {
    const g = makeGame();
    g.start(5); g.stop(); g.isRunning = true;
    g.fleet.ships.forEach((s) => s.moveBy(0, 6));       // bring the fleet into view
    g.handleKey(key('Space', { repeat: true }));
    assertEqual(g.score, 0);
    g.handleKey(key('Space'));
    assertEqual(g.score, POINTS_PER_ALIEN);
    g.stop();
});

/* ---------- 1e, 2b. Shooting ---------- */

test('1e + 2b: a hit destroys the nearest visible alien in the column and adds POINTS_PER_ALIEN', () => {
    const g = makeGame();
    g.start(5); g.stop(); g.isRunning = true;
    g.fleet.ships.forEach((s) => s.moveBy(0, 6));       // rows -5..-1 -> 1..5
    const target = g.fleet.lowestInColumn(g.player.col);
    assertEqual(target.row, 5, 'nearest alien in column 3 is in row 5');
    g.shoot();
    assert(!target.isAlive, 'target must be destroyed');
    assertEqual(g.score, POINTS_PER_ALIEN);
    const beam = g.field.querySelector('.beam');
    assertEqual([beam.style.top, beam.style.height],
        [`${6 * CELL_SIZE}px`, `${(PLAYER_ROW - 6) * CELL_SIZE}px`], 'beam from player to target');
    g.stop();
});

test('2b: a miss draws the beam to the top edge and gives no points', () => {
    const g = makeGame();
    g.start(5); g.stop(); g.isRunning = true;           // fleet is still above the field
    g.shoot();
    assertEqual(g.score, 0);
    const beam = g.field.querySelector('.beam');
    assertEqual([beam.style.top, beam.style.height], ['0px', `${PLAYER_ROW * CELL_SIZE}px`]);
    g.stop();
});

test('aliens above the field (not yet visible) cannot be hit', () => {
    const fleet = new Fleet(document.createElement('div'));
    fleet.spawn();
    assertEqual(fleet.lowestInColumn(3), null);
});

/* ---------- 1f. Waves and speed up ---------- */

test('1f: after the whole fleet is destroyed a new one is generated', () => {
    const g = makeGame();
    g.start(5); g.stop(); g.isRunning = true;
    g.fleet.ships.forEach((s) => s.moveBy(0, 6));
    for (let c = 0; c < FIELD_COLS; c++) {
        g.player.moveBy(c - g.player.col, 0);
        while (g.fleet.lowestInColumn(c)) g.shoot();
    }
    assertEqual([g.wave, g.fleet.alive().length, g.score], [2, 28, 28 * POINTS_PER_ALIEN]);
    g.stop();
});

test('1f: every SPEED_UP_EVERY points the speed goes up by 1, but not above MAX_SPEED', () => {
    const g = makeGame();
    g.start(5);
    g.addScore(SPEED_UP_EVERY - 100);
    assertEqual(g.speed, 5);
    g.addScore(100);
    assertEqual([g.speed, g.getDelay(), g.speedEl.textContent], [6, TIME_UNIT_MS * 5, '06']);
    g.addScore(SPEED_UP_EVERY * 100);
    assertEqual(g.speed, MAX_SPEED);
    g.stop();
});

/* ---------- 2a. Ship object ---------- */

test('2a: a ship has properties (id, size, colour, coordinates) and methods (move, destroy)', () => {
    const alien = new AlienShip({ col: 2, row: 0, color: 'red' });
    assertEqual([alien.col, alien.row, alien.size, alien.color, alien.isAlive], [2, 0, CELL_SIZE, 'red', true]);
    assert(Number.isInteger(alien.id), 'id must be a number');
    alien.moveDown();
    assertEqual(alien.row, 1);
    alien.destroy();
    assertEqual(alien.isAlive, false);
});

test('2a: Ship is abstract — new Ship() throws TypeError', () => {
    assertThrows(() => new Ship({ col: 0, row: 0, color: 'red' }), TypeError);
});

test('2a: coordinates and score are read-only from outside', () => {
    const alien = new AlienShip({ col: 2, row: 0, color: 'red' });
    assertThrows(() => { alien.col = 7; }, TypeError, 'col');   // this file is in strict mode
    assertEqual(alien.col, 2);
    const g = makeGame();
    assertThrows(() => { g.score = 99999; }, TypeError, 'score');
    assertEqual(g.score, 0);
});

test('2a: the colour setter validates the value', () => {
    const alien = new AlienShip({ col: 0, row: 0, color: 'red' });
    assertThrows(() => { alien.color = 'not-a-colour'; }, GameError);
    alien.color = '#00ff00';
    assertEqual(alien.color, '#00ff00');
});

test('2a: polymorphism — the player moves only sideways, an alien only down', () => {
    const g = makeGame();
    g.start(5); g.stop();
    assertThrows(() => g.player.moveBy(0, -1), GameError, 'player up');
    const alien = new AlienShip({ col: 0, row: 0, color: 'red' });
    assertThrows(() => alien.moveBy(0, -1), GameError, 'alien up');
    assertThrows(() => alien.moveBy(1, 0), GameError, 'alien sideways');
});

test('2a: destroying a ship twice throws; the div is removed after the explosion', async () => {
    const parent = document.createElement('div');
    const alien = new AlienShip({ col: 0, row: 0, color: 'red' });
    alien.appendTo(parent);
    alien.destroy();
    assertThrows(() => alien.destroy(), GameError);
    await sleep(EXPLOSION_MS + 50);
    assertEqual(parent.children.length, 0);
});

test('2a: fleet.ships is a frozen copy — it cannot be changed from outside', () => {
    const fleet = new Fleet(document.createElement('div'));
    fleet.spawn();
    assertThrows(() => fleet.ships.push(1), TypeError);
    assertEqual(fleet.ships.length, 28);
});

/* ---------- 2c. Speed ---------- */

test('2c: speed is discrete (1..10) and multiplied by the time constant', () => {
    const g = makeGame();
    const delays = [];
    for (let s = MIN_SPEED; s <= MAX_SPEED; s++) {
        g.start(s);
        delays.push(g.getDelay());
    }
    g.stop();
    assertEqual(delays, [2500, 2250, 2000, 1750, 1500, 1250, 1000, 750, 500, 250]);
});

test('2c: parseSpeed accepts 1..10 and throws InvalidSpeedError otherwise', () => {
    assertEqual(parseSpeed('7'), 7);
    for (const bad of ['0', '11', '5.5', 'abc', '']) {
        assertThrows(() => parseSpeed(bad), InvalidSpeedError, `"${bad}"`);
    }
});

test('2c: an invalid speed in the form shows an error message', () => {
    const select = document.getElementById('speed-select');
    const option = document.createElement('option');
    option.value = '99';
    select.append(option);
    select.value = '99';
    document.getElementById('start-form').requestSubmit();
    assert(document.getElementById('message').textContent.startsWith('Invalid speed'), 'message expected');
    option.remove();
    select.value = '5';
});

/* ---------- Game flow ---------- */

test('the descent timer really moves the fleet (speed 10 = one step every 250 ms)', async () => {
    const g = makeGame();
    g.start(10);
    const before = g.fleet.ships[0].row;
    await sleep(TIME_UNIT_MS * 2 + 100);
    assertEqual(g.fleet.ships[0].row, before + 2);
    g.stop();
});

test('game over when an alien reaches the player row', () => {
    const g = makeGame();
    g.start(5); g.stop(); g.isRunning = true;
    g.fleet.ships.forEach((s) => s.moveBy(0, PLAYER_ROW));   // bottom row -1 -> 9
    g.tick();                                                 // -> 10 = player row
    assertEqual(g.isRunning, false);
    assert(g.messageEl.textContent.startsWith('GAME OVER'), 'GAME OVER message expected');
    assertEqual(g.player.isAlive, false);
});

test('P pauses and resumes; nothing moves during a pause', async () => {
    const g = makeGame();
    g.start(10);
    g.handleKey(key('KeyP'));
    assertEqual(g.isPaused, true);
    const row = g.fleet.ships[0].row;
    g.handleKey(key('ArrowLeft'));
    assertEqual(g.player.col, 3, 'player must not move during a pause');
    await sleep(TIME_UNIT_MS * 2);
    assertEqual(g.fleet.ships[0].row, row, 'fleet must not move during a pause');
    g.handleKey(key('KeyP'));
    assertEqual(g.isPaused, false);
    g.stop();
});

test('switching to another tab pauses the game automatically', () => {
    game.start(5);                                   // the page's own game
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    try {
        document.dispatchEvent(new Event('visibilitychange'));
        assertEqual(game.isPaused, true);
    } finally {
        delete document.hidden;                      // back to the real property
        game.stop();
    }
});

test('an unexpected error inside a tick stops the game and shows the message', () => {
    const g = makeGame();
    g.start(5); g.stop(); g.isRunning = true;
    g.fleet.moveDown = () => { throw new Error('boom'); };
    const originalConsoleError = console.error;
    console.error = () => {};                 // keep the test output clean
    try {
        g.tick();
    } finally {
        console.error = originalConsoleError;
    }
    assertEqual([g.isRunning, g.messageEl.textContent], [false, 'Error: boom']);
});

test('a wrong FORMATION row length throws GameError', () => {
    const saved = FORMATION[0];
    FORMATION[0] = '###';
    try {
        assertThrows(() => new Fleet(document.createElement('div')).spawn(), GameError);
    } finally {
        FORMATION[0] = saved;
    }
});

test('Start restarts the game: score 0, wave 1, a fresh fleet', () => {
    const g = makeGame();
    g.start(5);
    g.addScore(500);
    g.start(3);
    assertEqual([g.score, g.wave, g.speed, g.fleet.alive().length], [0, 1, 3, 28]);
    assertEqual(g.field.querySelectorAll('.ship').length, 29, '28 aliens + player');
    g.stop();
});

test('the game field is built only from DOM div elements', () => {
    const g = makeGame();
    g.start(5); g.stop(); g.isRunning = true;
    g.fleet.ships.forEach((s) => s.moveBy(0, 6));
    g.shoot();                                       // adds a beam too
    const tags = new Set([...g.field.children].map((el) => el.tagName));
    assertEqual([...tags], ['DIV']);
    g.stop();
});

/* ---------- Runner ---------- */

(async () => {
    const list = document.getElementById('results');
    let failed = 0;
    for (const { name, fn } of tests) {
        const li = document.createElement('li');
        li.textContent = name;
        try {
            await fn();
            li.className = 'pass';
        } catch (error) {
            failed++;
            li.className = 'fail';
            const why = document.createElement('small');
            why.textContent = error.message;
            li.append(why);
        }
        list.append(li);
    }
    const summary = document.getElementById('summary');
    summary.textContent = failed === 0
        ? `All ${tests.length} tests passed`
        : `${failed} of ${tests.length} tests failed`;
    summary.className = failed === 0 ? 'ok' : 'fail';
    document.title = summary.textContent;     // lets a headless browser read the result
})();
