'use strict';
const assert = require('node:assert/strict');
const { generate, Game, DIRECTIONS, RULES, visibleRooms, seededMaze, fromCode, AttemptHistory, compareAttempts, sharePayload } = require('./maze.js');

// Воспроизводимый набор карт; тест не пишет файлы и не использует сеть.
function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function solve(maze) {
  const queue = [0], paths = new Map([[0, []]]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    for (const [name, [dx, dy, wall, opposite]] of Object.entries(DIRECTIONS)) {
      if (maze.cells[index] & wall) continue;
      const x = index % maze.size + dx, y = Math.floor(index / maze.size) + dy;
      assert(x >= 0 && y >= 0 && x < maze.size && y < maze.size, 'Проход не выходит за карту');
      const next = y * maze.size + x;
      assert.equal(maze.cells[next] & opposite, 0, 'Общие стены согласованы');
      if (!paths.has(next)) { paths.set(next, [...paths.get(index), name]); queue.push(next); }
    }
  }
  assert.equal(paths.size, maze.cells.length, 'Все комнаты достижимы');
  return paths.get(maze.exit);
}
let min = Infinity, max = 0;
for (let seed = 1; seed <= 1000; seed++) {
  const maze = generate(seeded(seed));
  const path = solve(maze);
  min = Math.min(min, path.length); max = Math.max(max, path.length);
  let clock = 0;
  const game = new Game(maze, () => clock);
  assert.equal(game.move(path[0]), false, 'До старта движение запрещено');
  game.start();
  assert.equal(game.move('up'), false, 'Внешняя стена не пропускает');
  assert.equal(game.steps, 0);
  for (const direction of path) { clock += 145; assert(game.move(direction)); }
  assert.equal(game.status, 'won');
  assert.equal(game.position, maze.exit);
  assert.equal(game.steps, path.length);
  assert.equal(game.route.length, game.steps + 1, 'Маршрут содержит старт и каждый успешный шаг');
  assert.equal(game.route.at(-1), maze.exit);
  assert(game.seen.has(game.position));
  assert.equal(game.move('left'), false, 'После победы движение запрещено');
}
let clock = 100;
const game = new Game(generate(seeded(42)), () => clock);
game.start(); clock += 120000; game.pause();
assert.equal(game.remaining(), 60000);
clock += 900000;
assert.equal(game.remaining(), 60000, 'Пауза не расходует время');
assert.equal(game.move('right'), false);
game.start(); clock += 59999; game.tick(); assert.equal(game.status, 'playing');
clock++; game.move('right'); assert.equal(game.status, 'lost');
assert.equal(game.remaining(), 0); assert.equal(game.steps, 0);
game.start(); assert.equal(game.status, 'lost', 'Истёкшую игру нельзя продолжить');
// Повтор обязан сбросить результат, но оставить ту же геометрию и выход.
const retry = game.retry();
assert.deepEqual(retry.maze, game.maze);
assert.notEqual(retry.maze.cells, game.maze.cells, 'Повтор не делит изменяемый массив стен');
assert.equal(retry.status, 'ready'); assert.equal(retry.steps, 0);
assert.equal(retry.position, 0); assert.deepEqual(retry.route, [0]);
assert.equal(retry.remaining(), RULES.durationMs);
assert.notEqual(retry.seen, game.seen); assert.notEqual(retry.trail, game.trail);
retry.start();
const route = solve(retry.maze);
assert.equal(retry.move(route[0]), true);
assert.equal(retry.route.length, 2); assert.equal(game.route.length, 1);
// Возврат по коридору сохраняется в полном маршруте, а не теряется в Set.
const reverse = { up: 'down', down: 'up', left: 'right', right: 'left' };
retry.move(reverse[route[0]]);
assert.deepEqual(retry.route, [0, retry.maze.size * DIRECTIONS[route[0]][1] + DIRECTIONS[route[0]][0], 0]);
const beforeWall = retry.route.length;
retry.move('up'); assert.equal(retry.route.length, beforeWall);
assert.equal(retry.finished, false); assert.equal(game.finished, true);
// Проверяем возможность следующей калибровки на изолированных часах,
// не меняя текущие пользовательские значения сложности.
let tunedClock = 0;
const tuned = new Game(generate(seeded(7)), () => tunedClock, { durationMs: 120000, vision: 1.5 });
assert(tuned.seen.size < new Game(tuned.maze).seen.size);
tuned.start(); tunedClock = 120000; tuned.tick(); assert.equal(tuned.status, 'lost');
assert.equal(tuned.retry().remaining(), 120000);
// Контрольная карта: близкая по координатам комната за стеной не видна,
// зато свет проходит по двум открытым сторонам за угол коридора.
const corridor = { size: 3, cells: Array(9).fill(15), exit: 8 };
function connect(a, direction) {
  const [dx, dy, wall, opposite] = DIRECTIONS[direction], b = a + dy * 3 + dx;
  corridor.cells[a] &= ~wall; corridor.cells[b] &= ~opposite;
}
connect(0, 'right'); connect(1, 'down'); connect(4, 'right');
assert.deepEqual([...visibleRooms(corridor, 0, 2)].sort(), [0, 1, 4]);
assert.deepEqual([...visibleRooms(corridor, 0, 1)].sort(), [0, 1]);
assert(!visibleRooms(corridor, 0, 2).has(3), 'Прямая соседняя комната за стеной скрыта');
const explorer = new Game(corridor, () => 0);
explorer.start(); explorer.move('right'); explorer.move('down'); explorer.move('right');
assert(!explorer.lit.has(0)); assert(explorer.seen.has(0), 'Память об исследованных комнатах сохраняется');
const wallSteps = explorer.steps, wallRoute = explorer.route.length, wallSeen = [...explorer.seen];
assert.equal(explorer.move('up'), false);
assert.equal(explorer.steps, wallSteps); assert.equal(explorer.route.length, wallRoute);
assert.deepEqual([...explorer.seen], wallSeen, 'Толчок в стену не исследует новую область');

// Коды воспроизводимы, ограничены по формату и закреплены контрольной суммой.
for (let seed = 0; seed < 200; seed++) {
  const map = seededMaze(seed);
  assert.deepEqual(fromCode(map.code.toLowerCase()), map);
  solve(map);
}
for (const invalid of ['', null, 'L2-00000001', 'L1-123', 'L1-XXXXXXXX', 'L1-00000000<script>', 'x'.repeat(10000)]) assert.equal(fromCode(invalid), null);
const { createHash } = require('node:crypto');
const stable = seededMaze(42);
assert.equal(createHash('sha256').update(JSON.stringify({ cells: stable.cells, exit: stable.exit })).digest('hex'), 'cd434320b4469b9ed8cfed041f5d5c9036e3e4d1ef0d029d5ee3686bfca36666');
assert.equal(seededMaze(0xffffffff).code, 'L1-FFFFFFFF');

const previous = { status: 'won', elapsed: 90000, steps: 200, seen: 100 };
assert.equal(compareAttempts(previous, { status: 'won', elapsed: 70000, steps: 188 }), 'На 12 шагов меньше, на 20 с быстрее.');
assert.match(compareAttempts(previous, { status: 'lost', elapsed: 180000, steps: 1 }), /В прошлой попытке выход был найден/);
assert.match(compareAttempts({ status: 'lost', seen: 10 }, { status: 'lost', seen: 20 }), /10 комнат больше/);
assert.equal(compareAttempts(null, previous), 'Первая попытка на этой карте.');
const history = new AttemptHistory(), first = new Game(stable, () => 0);
assert.equal(history.record(first), '', 'Незавершённая попытка не становится результатом');
first.start(); first.now = () => 180000; first.tick();
const firstText = history.record(first);
assert.equal(history.record(first), firstText, 'Повторная отрисовка не сравнивает результат с самим собой');
const second = first.retry(); second.start(); second.now = () => 360000; second.tick();
assert.match(history.record(second), /столько же комнат/);
const other = new Game(seededMaze(43), () => 0); other.start(); other.now = () => 180000; other.tick();
assert.equal(history.record(other), 'Первая попытка на этой карте.');
const differentRules = new Game(stable, () => 0, { vision: 1 });
differentRules.start(); differentRules.now = () => 180000; differentRules.tick();
assert.equal(history.record(differentRules), 'Первая попытка на этой карте.', 'Попытки с разными условиями не сравниваются');

const publicShare = sharePayload(first, 'https://example.test/play?private=omitted#unrelated');
assert.equal(publicShare.url, 'https://example.test/play#maze=L1-0000002A');
assert(!JSON.stringify(publicShare).includes('omitted'));
assert.equal(sharePayload(first, 'file:///tmp/local-game/index.html').url, undefined);
assert.equal(sharePayload(first, 'http://127.0.0.1:8080/').url, undefined);
assert.match(publicShare.text, /L1-0000002A/);
assert.throws(() => sharePayload(new Game(stable), 'https://example.test/'));
console.log(`Успешно: 1000 карт + 200 кодов, видимость через проходы, столкновения, повтор, сравнение и данные для отправки. Пути: ${min}–${max} шагов.`);
