// =======================
// Configuración de API
// =======================
const API = "http://185.252.215.234:3000/api";
let token = null;

// =======================
// Funciones de autenticación
// =======================
async function register() {
    await fetch(API + "/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: email.value,
            password: password.value
        })
    });
    alert("Registered");
}

async function login() {
    const res = await fetch(API + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: email.value,
            password: password.value
        })
    });

    const data = await res.json();
    token = data.token;
    localStorage.setItem("token", token);
    alert("Login OK");
}

async function play() {
    token = localStorage.getItem("token");

    if (!token) {
        alert("Login first");
        return;
    }

    const res = await fetch(API + "/game/play", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ game: "tetris" })
    });

    const data = await res.json();

    if (data.error) {
        alert(data.error);
        return;
    }

    startGame();
}

// =======================
// Configuración de canvas
// =======================
const canvas = document.getElementById("tetris");
const ctx = canvas.getContext("2d");
ctx.scale(20, 20);

const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
nextCtx.scale(20, 20);

const holdCanvas = document.getElementById("hold");
const holdCtx = holdCanvas.getContext("2d");
holdCtx.scale(20, 20);

// =======================
// Variables de estado del juego
// =======================
const arena = createMatrix(12, 20);
const player = { pos: { x: 0, y: 0 }, matrix: null };

let nextPiece = createPiece("T");
let hold = null;
let canHold = true;

let score = 0;
let lines = 0;
let level = 1;

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

// Estado de pausa
let isPaused = false;

// =======================
// Colores de piezas
// =======================
const colors = [
    null,
    "#ff0d72",
    "#0dc2ff",
    "#0dff72",
    "#f538ff",
    "#ff8e0d",
    "#ffe138",
    "#3877ff"
];

// =======================
// Funciones de creación de matrices y piezas
// =======================
function createMatrix(w, h) {
    const m = [];
    while (h--) m.push(new Array(w).fill(0));
    return m;
}

function createPiece(type) {
    if (type === "T") return [[0,1,0],[1,1,1],[0,0,0]];
    if (type === "O") return [[2,2],[2,2]];
    if (type === "L") return [[0,0,3],[3,3,3],[0,0,0]];
    if (type === "J") return [[4,0,0],[4,4,4],[0,0,0]];
    if (type === "I") return [[0,5,0,0],[0,5,0,0],[0,5,0,0],[0,5,0,0]];
    if (type === "S") return [[0,6,6],[6,6,0],[0,0,0]];
    if (type === "Z") return [[7,7,0],[0,7,7],[0,0,0]];
}

// =======================
// Funciones de dibujo
// =======================
function drawMatrix(matrix, offset, context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = colors[value];
                context.fillRect(x + offset.x, y + offset.y, 1, 1);

                context.strokeStyle = "#000";
                context.lineWidth = 0.05;
                context.strokeRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawMatrix(arena, { x: 0, y: 0 }, ctx);
    drawMatrix(player.matrix, player.pos, ctx);

    // Mostrar overlay de pausa si el juego está pausado
    if (isPaused) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#fff";
        ctx.font = "1px Arial";
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", canvas.width / 2 / 20, canvas.height / 2 / 20);
    }
}

// =======================
// Lógica del juego
// =======================
function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function collide(arena, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m[y].length; x++) {
            if (m[y][x] !== 0 &&
                (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function rotate(matrix) {
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < y; x++) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    matrix.forEach(row => row.reverse());
}

function playerRotate() {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix);
            rotate(player.matrix);
            rotate(player.matrix);
            player.pos.x = pos;
            return;
        }
    }
}

function arenaSweep() {
    let rowCount = 1;
    outer: for (let y = arena.length - 1; y >= 0; y--) {
        for (let x = 0; x < arena[y].length; x++) {
            if (arena[y][x] === 0) continue outer;
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        y++;

        score += rowCount * 10;
        lines++;
        rowCount *= 2;
    }
    updateScore();
}

// =======================
// Movimiento de piezas
// =======================
function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        arenaSweep();
        playerReset();
    }
    dropCounter = 0;
}

function hardDrop() {
    while (!collide(arena, player)) player.pos.y++;
    player.pos.y--;
    merge(arena, player);
    arenaSweep();
    playerReset();
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) player.pos.x -= dir;
}

function playerReset() {
    player.matrix = nextPiece;

    const pieces = "TJLOSZI";
    nextPiece = createPiece(pieces[Math.random() * pieces.length | 0]);

    drawNext();

    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);

    if (collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        score = 0;
        lines = 0;
        level = 1;
        updateScore();
    }

    canHold = true;
}

// =======================
// Piezas siguientes y hold
// =======================
function drawNext() {
    nextCtx.fillStyle = "#000";
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    drawMatrix(nextPiece, { x: 1, y: 1 }, nextCtx);
}

function holdPiece() {
    if (!canHold) return;

    if (!hold) {
        hold = player.matrix;
        playerReset();
    } else {
        [player.matrix, hold] = [hold, player.matrix];
        player.pos.y = 0;
        player.pos.x = 5;
    }

    drawHold();
    canHold = false;
}

function drawHold() {
    holdCtx.fillStyle = "#000";
    holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
    if (hold) drawMatrix(hold, { x: 1, y: 1 }, holdCtx);
}

// =======================
// Puntuación y niveles
// =======================
function updateScore() {
    document.getElementById("score").innerText = score;
    document.getElementById("lines").innerText = lines;
    level = Math.floor(lines / 10) + 1;
    document.getElementById("level").innerText = level;
    dropInterval = 1000 - (level * 70);
}

// =======================
// Loop principal
// =======================
function update(time = 0) {
    if (!isPaused) {
        const delta = time - lastTime;
        lastTime = time;

        dropCounter += delta;
        if (dropCounter > dropInterval) playerDrop();

        draw();
    }

    requestAnimationFrame(update);
}

// =======================
// Función de pausa
// =======================
function togglePause() {
    isPaused = !isPaused;
}

// =======================
// Controles del teclado
// =======================
document.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") playerMove(-1);
    if (event.key === "ArrowRight") playerMove(1);
    if (event.key === "ArrowDown") playerDrop();
    if (event.key === "ArrowUp") playerRotate();
    if (event.key === " ") hardDrop();
    if (event.key === "c") holdPiece();
    if (event.key === "p") togglePause(); // Pausar / reanudar
});

// =======================
// Iniciar juego
// =======================
function startGame() {
    playerReset();
    drawNext();
    update();
}