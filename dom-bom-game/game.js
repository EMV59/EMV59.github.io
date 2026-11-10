'use strict';

/* ==========================================================================
   HomeTask #4: {Objects, Events, Exceptions}
   "DomBomGame" — built with the DOM only (div elements), no canvas.
   ========================================================================== */

/* ---------- 1. CONSTANTS (all game settings in one place) ---------- */

const CELL_SIZE = 40;              // px — size of one square (cell)
const FIELD_COLS = 8;              // field width in cells
const FIELD_ROWS = 11;             // field height in cells
const PLAYER_ROW = FIELD_ROWS - 1; // the player is always in the bottom row

const POINTS_PER_ALIEN = 100;      // points for one destroyed alien ship
const SPEED_UP_EVERY = 10000;      // every 10000 points the speed goes up by 1

const MIN_SPEED = 1;
const MAX_SPEED = 10;
const DEFAULT_SPEED = 5;
// Time constant (found experimentally):
// delay between steps = TIME_UNIT_MS * (MAX_SPEED + 1 - speed)
// speed 1 -> 2500 ms, speed 5 -> 1500 ms, speed 10 -> 250 ms
const TIME_UNIT_MS = 250;

const BEAM_DURATION_MS = 150;      // how long the beam is visible
const EXPLOSION_MS = 300;          // length of the explosion animation

const PLAYER_COLOR = '#3b0a6e';
// Alien colours: even rows — yellow/red, odd rows — blue/lavender
const ALIEN_COLORS = [
    ['#ffee00', '#ee4400'],
    ['#0088dd', '#bbaad6'],
];
// Formation shape (as in the mockup): '#' — ship, '.' — empty cell
const FORMATION = [
    '########',
    '########',
    '.######.',
    '..####..',
    '...##...',
];

/* ---------- 2. EXCEPTIONS (custom error classes) ---------- */

class GameError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GameError';
    }
}

// The player tries to leave the field
class OutOfFieldError extends GameError {
    constructor(col) {
        super(`Cell ${col} is outside the field (0..${FIELD_COLS - 1})`);
        this.name = 'OutOfFieldError';
    }
}

// An invalid speed was selected
class InvalidSpeedError extends GameError {
    constructor(value) {
        super(`Invalid speed "${value}". Expected an integer from ${MIN_SPEED} to ${MAX_SPEED}`);
        this.name = 'InvalidSpeedError';
    }
}

/* ---------- 3. OBJECTS: ship, player, alien, fleet ---------- */

/*
   OOP techniques used here:
   - INHERITANCE:    Ship -> PlayerShip, Ship -> AlienShip
   - ABSTRACTION:    Ship cannot be created directly; validateMove() is an "abstract" method
   - ENCAPSULATION:  private #fields, only getters outside (= read-only);
                     the color setter validates the value and throws an exception
   - POLYMORPHISM:   moveBy() is shared, but validateMove() differs for the player and an alien
   - COMPOSITION:    Game creates its own Fleet and PlayerShip, Fleet creates its own
                     AlienShips — they do not exist without their owner
*/

let nextShipId = 1; // counter for unique ship ids

// ABSTRACT base "ship": properties (id, size, colour, coordinates)
// + methods (render, move, destroy)
class Ship {
    // Private fields: not accessible outside the class (ship.#col is a SyntaxError)
    #id;
    #col;          // coordinates are in cells, not in pixels
    #row;
    #size;
    #color;
    #isAlive = true;
    #element;      // every ship is a div in the DOM

    constructor({ col, row, color, size = CELL_SIZE }) {
        // JS has no "abstract" keyword, so we forbid new Ship(...) by hand
        if (new.target === Ship) {
            throw new TypeError('Ship is an abstract class. Create a PlayerShip or an AlienShip');
        }
        this.#id = nextShipId++;
        this.#col = col;
        this.#row = row;
        this.#size = size;

        this.#element = document.createElement('div');
        this.#element.className = 'ship';
        this.#element.style.width = `${size}px`;
        this.#element.style.height = `${size}px`;

        this.color = color;   // goes through the setter, so it is validated
        this.render();
    }

    // Getters without setters = read-only properties
    get id() { return this.#id; }
    get col() { return this.#col; }
    get row() { return this.#row; }
    get size() { return this.#size; }
    get isAlive() { return this.#isAlive; }

    // Getter/setter pair: the setter validates the value
    get color() { return this.#color; }
    set color(value) {
        if (typeof value !== 'string' || !CSS.supports('color', value)) {
            throw new GameError(`Invalid colour: ${value}`);
        }
        this.#color = value;
        this.#element.style.backgroundColor = value;
    }

    // "Abstract" method: every subclass must provide its own version
    validateMove(newCol, newRow) {
        throw new Error(`${this.constructor.name} must implement validateMove()`);
    }

    // Convert cells to pixels and put the div in place
    render() {
        this.#element.style.left = `${this.#col * CELL_SIZE}px`;
        this.#element.style.top = `${this.#row * CELL_SIZE}px`;
    }

    // Put the ship on the field
    appendTo(parent) {
        parent.append(this.#element);
    }

    // Shared movement algorithm; the rules live in the subclass's validateMove()
    moveBy(dCol, dRow) {
        const newCol = this.#col + dCol;
        const newRow = this.#row + dRow;
        this.validateMove(newCol, newRow);   // throws if the move is not allowed
        this.#col = newCol;
        this.#row = newRow;
        this.render();
    }

    destroy() {
        if (!this.#isAlive) {
            throw new GameError('The ship is already destroyed');
        }
        this.#isAlive = false;
        this.#element.classList.add('ship--destroyed');           // explosion animation
        setTimeout(() => this.#element.remove(), EXPLOSION_MS);   // then remove from the DOM
    }
}

// Player ship: moves only left/right and only inside the field
class PlayerShip extends Ship {
    constructor() {
        super({
            col: Math.floor((FIELD_COLS - 1) / 2),
            row: PLAYER_ROW,
            color: PLAYER_COLOR,
        });
    }

    validateMove(newCol, newRow) {
        if (newRow !== PLAYER_ROW) {
            throw new GameError('The player can only move horizontally');
        }
        if (newCol < 0 || newCol >= FIELD_COLS) {
            throw new OutOfFieldError(newCol);   // caught in the keyboard handler
        }
    }
}

// Alien ship: moves only down (it may start above the field, row < 0)
class AlienShip extends Ship {
    validateMove(newCol, newRow) {
        if (newCol !== this.col || newRow < this.row) {
            throw new GameError('Alien ships can only move down');
        }
    }

    moveDown() {
        this.moveBy(0, 1);
    }
}

// Alien fleet — an array of ships + operations on the whole formation
class Fleet {
    #field;
    #ships = [];

    constructor(fieldElement) {
        this.#field = fieldElement;
    }

    // A frozen COPY goes outside: nobody can add/remove ships from outside
    get ships() {
        return Object.freeze([...this.#ships]);
    }

    // Create a new formation. It appears ABOVE the field and "descends" into it.
    spawn() {
        this.#ships = [];
        FORMATION.forEach((line, r) => {
            if (line.length !== FIELD_COLS) {
                throw new GameError(`Formation row #${r} must be ${FIELD_COLS} characters long`);
            }
            let k = 0; // index of the ship in its row — used to alternate colours
            [...line].forEach((symbol, c) => {
                if (symbol !== '#') return;
                const alien = new AlienShip({
                    col: c,
                    row: r - FORMATION.length,   // negative row = above the field
                    color: ALIEN_COLORS[r % 2][k % 2],
                });
                k++;
                alien.appendTo(this.#field);
                this.#ships.push(alien);
            });
        });
    }

    alive() {
        return this.#ships.filter((ship) => ship.isAlive);
    }

    isEmpty() {
        return this.alive().length === 0;
    }

    // All rows move down one cell at the same time
    moveDown() {
        this.alive().forEach((ship) => ship.moveDown());
    }

    // The lowest row that still has a living alien
    lowestRow() {
        return Math.max(...this.alive().map((ship) => ship.row));
    }

    // The visible alien in this column closest to the player (the beam hits it), or null
    lowestInColumn(col) {
        let target = null;
        for (const ship of this.alive()) {
            if (ship.col === col && ship.row >= 0 && (!target || ship.row > target.row)) {
                target = ship;
            }
        }
        return target;
    }
}

/* ---------- 4. GAME: state, timer, events ---------- */

class Game {
    // Score and speed change only from inside (addScore); outside they are read-only
    #score = 0;
    #speed = DEFAULT_SPEED;

    get score() { return this.#score; }
    get speed() { return this.#speed; }

    constructor({ field, scoreEl, speedEl, messageEl }) {
        this.field = field;
        this.scoreEl = scoreEl;
        this.speedEl = speedEl;
        this.messageEl = messageEl;

        this.fleet = new Fleet(field);
        this.player = null;
        this.timerId = null;
        this.isRunning = false;
        this.isPaused = false;
        this.startSpeed = DEFAULT_SPEED;
        this.wave = 1;

        // The field size is calculated from the constants
        field.style.width = `${FIELD_COLS * CELL_SIZE}px`;
        field.style.height = `${FIELD_ROWS * CELL_SIZE}px`;
        field.style.setProperty('--cell', `${CELL_SIZE}px`);
    }

    start(speed) {
        this.stop();
        this.field.innerHTML = '';     // clear the field after the previous game
        this.#score = 0;
        this.startSpeed = speed;
        this.#speed = speed;
        this.wave = 1;

        this.player = new PlayerShip();
        this.player.appendTo(this.field);
        this.fleet.spawn();

        this.isRunning = true;
        this.scheduleDescent();
        this.updateHud();
        this.showMessage('Wave 1. Good luck!');
    }

    stop() {
        clearInterval(this.timerId);
        this.isRunning = false;
        this.isPaused = false;
    }

    // Pause / resume (P key, or automatically when the tab is hidden)
    togglePause() {
        if (!this.isRunning) return;
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            clearInterval(this.timerId);
            this.showMessage('Paused. Press P to continue');
        } else {
            this.scheduleDescent();
            this.showMessage(`Wave ${this.wave}`);
        }
    }

    // Discrete speed * time constant = step interval
    getDelay() {
        return TIME_UNIT_MS * (MAX_SPEED + 1 - this.#speed);
    }

    // (Re)start the descent timer — on start, on resume and when the speed goes up
    scheduleDescent() {
        clearInterval(this.timerId);
        this.timerId = setInterval(() => this.tick(), this.getDelay());
    }

    // One game step: the fleet moves down one cell
    tick() {
        try {
            this.fleet.moveDown();
            if (this.fleet.lowestRow() >= PLAYER_ROW) {
                this.gameOver();
            }
        } catch (error) {
            // An unexpected error must not keep firing on every timer tick
            this.stop();
            this.showMessage(`Error: ${error.message}`, true);
            console.error(error);
        }
    }

    // Keyboard handler
    handleKey(event) {
        const controls = ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'KeyP'];
        // While the game is not running the keys work as usual (choose speed, press Start)
        if (!this.isRunning || !controls.includes(event.code)) return;
        event.preventDefault();          // arrows/space must not scroll the page

        if (event.code === 'KeyP') {
            if (!event.repeat) this.togglePause();
            return;
        }
        if (this.isPaused) return;       // no moving or shooting during a pause

        try {
            switch (event.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    this.player.moveBy(-1, 0);
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.player.moveBy(1, 0);
                    break;
                case 'Space':
                    if (!event.repeat) this.shoot();   // holding space does not auto-fire
                    break;
            }
        } catch (error) {
            if (error instanceof OutOfFieldError) {
                this.flashWall();      // hit the edge — just flash the border
            } else {
                throw error;           // any other error is re-thrown
            }
        }
    }

    shoot() {
        const target = this.fleet.lowestInColumn(this.player.col);
        // The beam goes to the target, or to the top edge on a miss
        this.drawBeam(target ? target.row + 1 : 0);

        if (!target) return;
        target.destroy();
        this.addScore(POINTS_PER_ALIEN);

        if (this.fleet.isEmpty()) {
            this.wave++;
            this.fleet.spawn();          // fleet destroyed — the game goes on
            this.showMessage(`Wave ${this.wave}!`);
        }
    }

    // The beam is a div too: from the top of the player ship to the bottom of the target
    drawBeam(topRow) {
        const beam = document.createElement('div');
        beam.className = 'beam';
        beam.style.left = `${this.player.col * CELL_SIZE + CELL_SIZE / 2 - 2}px`;
        beam.style.top = `${topRow * CELL_SIZE}px`;
        beam.style.height = `${(PLAYER_ROW - topRow) * CELL_SIZE}px`;
        this.field.append(beam);
        setTimeout(() => beam.remove(), BEAM_DURATION_MS);
    }

    addScore(points) {
        if (!Number.isInteger(points) || points <= 0) {
            throw new GameError(`Points must be an integer > 0, got: ${points}`);
        }
        this.#score += points;
        // Every SPEED_UP_EVERY points the speed goes up by 1 (but not above MAX_SPEED)
        const newSpeed = Math.min(
            MAX_SPEED,
            this.startSpeed + Math.floor(this.#score / SPEED_UP_EVERY),
        );
        if (newSpeed !== this.#speed) {
            this.#speed = newSpeed;
            this.scheduleDescent();
            this.showMessage(`Speed up: ${formatSpeed(newSpeed)}!`);
        }
        this.updateHud();
    }

    gameOver() {
        this.stop();
        this.player.destroy();
        this.showMessage(`GAME OVER. Score: ${this.#score}. Press Start`, true);
    }

    updateHud() {
        this.scoreEl.textContent = this.#score;
        this.speedEl.textContent = formatSpeed(this.#speed);
    }

    showMessage(text, isError = false) {
        this.messageEl.textContent = text;
        this.messageEl.classList.toggle('message--error', isError);
    }

    flashWall() {
        this.field.classList.remove('field--hit-wall');
        void this.field.offsetWidth;      // forces a reflow so the CSS animation restarts
        this.field.classList.add('field--hit-wall');
    }
}

/* ---------- 5. HELPERS ---------- */

// 5 -> "05"
function formatSpeed(speed) {
    return String(speed).padStart(2, '0');
}

// Form value -> number; anything invalid throws an exception
function parseSpeed(value) {
    const speed = Number(value);
    if (!Number.isInteger(speed) || speed < MIN_SPEED || speed > MAX_SPEED) {
        throw new InvalidSpeedError(value);
    }
    return speed;
}

/* ---------- 6. STARTUP: find the elements and attach the events ---------- */

const form = document.getElementById('start-form');
const select = document.getElementById('speed-select');
const startBtn = document.getElementById('start-btn');

// Fill the <select> with 01..10
for (let s = MIN_SPEED; s <= MAX_SPEED; s++) {
    const option = document.createElement('option');
    option.value = s;
    option.textContent = formatSpeed(s);
    option.selected = s === DEFAULT_SPEED;
    select.append(option);
}

const game = new Game({
    field: document.getElementById('field'),
    scoreEl: document.getElementById('score'),
    speedEl: document.getElementById('speed'),
    messageEl: document.getElementById('message'),
});

// The form's submit event = pressing Start (click or Enter)
form.addEventListener('submit', (event) => {
    event.preventDefault();               // do not reload the page
    try {
        game.start(parseSpeed(select.value));
    } catch (error) {
        if (error instanceof GameError) {
            game.showMessage(error.message, true);
        } else {
            throw error;
        }
    } finally {
        // Remove focus from the button and the list, otherwise space/arrows would
        // press Start or change the speed instead of controlling the ship
        startBtn.blur();
        select.blur();
    }
});

// Keyboard events
document.addEventListener('keydown', (event) => game.handleKey(event));

// Switching to another tab pauses the game, so the aliens do not land while you are away
document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.isRunning && !game.isPaused) {
        game.togglePause();
    }
});
