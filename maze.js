/* Чистая игровая логика: одинакова в браузере и в безопасных тестах Node.js. */
(function (root) {
  'use strict';
  const DIRECTIONS = { up: [0, -1, 1, 4], right: [1, 0, 2, 8], down: [0, 1, 4, 1], left: [-1, 0, 8, 2] };
  function generate(random = Math.random, size = 15) {
    const cells = Array(size * size).fill(15);
    const visited = new Set([0]);
    const stack = [0];
    // Итеративный поиск в глубину строит связное дерево: любой выход достижим,
    // а стены общих сторон снимаются одновременно с обеих сторон.
    while (stack.length) {
      const current = stack[stack.length - 1];
      const x = current % size, y = Math.floor(current / size);
      const options = Object.values(DIRECTIONS).filter(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        return nx >= 0 && nx < size && ny >= 0 && ny < size && !visited.has(ny * size + nx);
      });
      if (!options.length) { stack.pop(); continue; }
      const [dx, dy, wall, opposite] = options[Math.floor(random() * options.length)];
      const next = (y + dy) * size + x + dx;
      cells[current] &= ~wall;
      cells[next] &= ~opposite;
      visited.add(next);
      stack.push(next);
    }
    const distance = Array(cells.length).fill(-1);
    distance[0] = 0;
    const queue = [0];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      for (const [dx, dy, wall] of Object.values(DIRECTIONS)) {
        if (cells[current] & wall) continue;
        const next = current + dy * size + dx;
        if (distance[next] !== -1) continue;
        distance[next] = distance[current] + 1;
        queue.push(next);
      }
    }
    // Выбираем удалённую комнату: путь 100–130 шагов, если такая есть.
    // Длительность исследования зависит от игрока; лимит партии — 180 секунд.
    const candidates = distance.map((d, i) => ({ d, i })).filter(({ d }) => d >= 100 && d <= 130);
    const exit = candidates.length ? candidates[Math.floor(random() * candidates.length)].i : distance.indexOf(Math.max(...distance));
    return { size, cells, exit, shortest: distance[exit] };
  }
  class Game {
    constructor(maze = generate(), now = () => performance.now()) {
      this.maze = maze; this.now = now; this.position = 0; this.steps = 0;
      this.status = 'ready'; this.elapsed = 0; this.startedAt = 0;
      this.seen = new Set(); this.trail = new Set([0]); this.reveal();
    }
    reveal() {
      const { size } = this.maze, x = this.position % size, y = Math.floor(this.position / size);
      for (let ny = Math.max(0, y - 2); ny <= Math.min(size - 1, y + 2); ny++) {
        for (let nx = Math.max(0, x - 2); nx <= Math.min(size - 1, x + 2); nx++) {
          if (Math.hypot(nx - x, ny - y) <= 2.5) this.seen.add(ny * size + nx);
        }
      }
    }
    remaining() { return Math.max(0, 180000 - this.elapsed - (this.status === 'playing' ? this.now() - this.startedAt : 0)); }
    tick() {
      if (this.status === 'playing' && this.remaining() <= 0) { this.elapsed = 180000; this.status = 'lost'; }
      return this.status;
    }
    start() {
      if (this.status !== 'ready' && this.status !== 'paused') return;
      this.startedAt = this.now(); this.status = 'playing';
    }
    pause() {
      this.tick();
      if (this.status !== 'playing') return;
      this.elapsed += this.now() - this.startedAt; this.status = 'paused';
    }
    move(direction) {
      this.tick();
      if (this.status !== 'playing' || !DIRECTIONS[direction]) return false;
      const [dx, dy, wall] = DIRECTIONS[direction];
      if (this.maze.cells[this.position] & wall) return false;
      this.position += dy * this.maze.size + dx; this.steps++;
      this.trail.add(this.position); this.reveal();
      if (this.position === this.maze.exit) {
        this.elapsed += this.now() - this.startedAt; this.status = 'won';
      }
      return true;
    }
  }
  const api = { generate, Game, DIRECTIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MazeCore = api;
})(globalThis);
