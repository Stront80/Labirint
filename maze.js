/* Чистая игровая логика: одинакова в браузере и в безопасных тестах Node.js. */
(function (root) {
  'use strict';
  const DIRECTIONS = { up: [0, -1, 1, 4], right: [1, 0, 2, 8], down: [0, 1, 4, 1], left: [-1, 0, 8, 2] };
  // Параметры баланса собраны вместе для настройки после живых пробных игр.
  // Лимит и скорость сохранены; vision теперь ограничивает число проходов,
  // а не геометрический радиус, чтобы обзор не проникал сквозь стены.
  const RULES = Object.freeze({ size: 15, pathMin: 100, pathMax: 130, vision: 2.5, durationMs: 180000, stepMs: 145 });
  function generate(random = Math.random, size = RULES.size, range = RULES) {
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
    const candidates = distance.map((d, i) => ({ d, i })).filter(({ d }) => d >= range.pathMin && d <= range.pathMax);
    const exit = candidates.length ? candidates[Math.floor(random() * candidates.length)].i : distance.indexOf(Math.max(...distance));
    return { size, cells, exit, shortest: distance[exit] };
  }
  function seededMaze(seed) {
    const value = seed >>> 0;
    let state = value;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    // Формат L1 закрепляет алгоритм, размер и выбор выхода. Будущая настройка
    // RULES не должна менять уже разосланные карты: для неё нужен новый формат.
    const maze = generate(random, 15, { pathMin: 100, pathMax: 130 });
    maze.code = `L1-${value.toString(16).padStart(8, '0').toUpperCase()}`;
    return maze;
  }
  function fromCode(code) {
    if (typeof code !== 'string' || code.length > 40) return null;
    const match = /^L1-([0-9A-F]{8})$/.exec(code.trim().toUpperCase());
    return match ? seededMaze(parseInt(match[1], 16)) : null;
  }
  function visibleRooms(maze, position, range) {
    const visible = new Set([position]);
    const queue = [[position, 0]], reach = Math.max(0, Math.floor(range));
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const [current, depth] = queue[cursor];
      if (depth >= reach) continue;
      for (const [dx, dy, wall] of Object.values(DIRECTIONS)) {
        if (maze.cells[current] & wall) continue;
        const next = current + dy * maze.size + dx;
        if (next < 0 || next >= maze.cells.length || visible.has(next)) continue;
        visible.add(next); queue.push([next, depth + 1]);
      }
    }
    return visible;
  }
  class Game {
    constructor(maze = generate(), now = () => performance.now(), rules = RULES) {
      this.maze = { ...maze, cells: [...maze.cells] }; this.now = now;
      this.rules = Object.freeze({ ...RULES, ...rules }); this.position = 0; this.steps = 0;
      this.status = 'ready'; this.elapsed = 0; this.startedAt = 0;
      this.seen = new Set(); this.trail = new Set([0]); this.route = [0]; this.reveal();
    }
    get finished() { return this.status === 'won' || this.status === 'lost'; }
    retry() { return new Game(this.maze, this.now, this.rules); }
    reveal() {
      this.lit = visibleRooms(this.maze, this.position, this.rules.vision);
      this.lit.forEach(index => this.seen.add(index));
    }
    remaining() { return Math.max(0, this.rules.durationMs - this.elapsed - (this.status === 'playing' ? this.now() - this.startedAt : 0)); }
    tick() {
      if (this.status === 'playing' && this.remaining() <= 0) { this.elapsed = this.rules.durationMs; this.status = 'lost'; }
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
      this.trail.add(this.position); this.route.push(this.position); this.reveal();
      if (this.position === this.maze.exit) {
        this.elapsed += this.now() - this.startedAt; this.status = 'won';
      }
      return true;
    }
  }
  const word = (n, forms) => forms[n % 100 >= 11 && n % 100 <= 14 ? 2 : n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2];
  function compareAttempts(previous, current) {
    if (!previous) return 'Первая попытка на этой карте.';
    if (current.status === 'won' && previous.status !== 'won') return 'Теперь выход найден!';
    if (current.status !== 'won' && previous.status === 'won') return 'В прошлой попытке выход был найден.';
    if (current.status !== 'won') {
      const delta = current.seen - previous.seen, n = Math.abs(delta);
      return delta ? `Открыто на ${n} ${word(n, ['комнату', 'комнаты', 'комнат'])} ${delta > 0 ? 'больше' : 'меньше'}.` : 'Открыто столько же комнат, сколько в прошлый раз.';
    }
    const steps = current.steps - previous.steps, seconds = Math.round((current.elapsed - previous.elapsed) / 1000);
    const n = Math.abs(steps);
    return [steps ? `На ${n} ${word(n, ['шаг', 'шага', 'шагов'])} ${steps < 0 ? 'меньше' : 'больше'}` : 'Столько же шагов',
      seconds ? `на ${Math.abs(seconds)} с ${seconds < 0 ? 'быстрее' : 'дольше'}` : 'время примерно то же'].join(', ') + '.';
  }
  class AttemptHistory {
    constructor() { this.maps = new Map(); this.recorded = new WeakMap(); }
    record(game) {
      if (!game.finished) return '';
      if (this.recorded.has(game)) return this.recorded.get(game);
      // Сравнимы только одинаковая геометрия и одинаковые условия игры.
      const key = [game.maze.size, game.maze.exit, game.maze.cells.join(','), game.rules.vision, game.rules.durationMs, game.rules.stepMs].join('|');
      const result = Object.freeze({ status: game.status, elapsed: game.elapsed, steps: game.steps, seen: game.seen.size });
      const text = compareAttempts(this.maps.get(key), result);
      this.maps.delete(key); this.maps.set(key, result);
      if (this.maps.size > 24) this.maps.delete(this.maps.keys().next().value);
      this.recorded.set(game, text);
      return text;
    }
  }
  function sharePayload(game, href) {
    if (!game.finished) throw new Error('Результат доступен после завершения партии');
    const seconds = Math.floor(game.elapsed / 1000);
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const payload = { title: 'Лабиринт', text: `Лабиринт: ${game.status === 'won' ? 'выход найден' : 'время вышло'}. Время ${time}, шагов ${game.steps}, исследовано ${Math.round(game.seen.size / game.maze.cells.length * 100)}%. Карта ${game.maze.code || 'без кода'}.` };
    // В сообщение не попадают локальный путь, произвольные параметры запроса
    // или чужие фрагменты URL. Публичный адрес не придумывается для file://.
    try {
      const url = new URL(href);
      if (/^https?:$/.test(url.protocol) && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && game.maze.code) {
        payload.url = `${url.origin}${url.pathname}#maze=${game.maze.code}`;
      }
    } catch { /* При работе из файла достаточно результата и кода карты. */ }
    return payload;
  }
  const api = { generate, Game, DIRECTIONS, RULES, seededMaze, fromCode, visibleRooms, AttemptHistory, compareAttempts, sharePayload };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MazeCore = api;
})(globalThis);
