'use strict';
const assert = require('node:assert/strict');
const { generate, Game, DIRECTIONS } = require('./maze.js');

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
console.log(`Успешно: 1000 карт, связность, стены, победа, пауза, тайм-аут. Кратчайшие пути: ${min}–${max} шагов.`);
