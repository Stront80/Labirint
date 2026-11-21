/* Интерфейс не требует сервера, сети, хранилища или внешних библиотек. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('board'), ctx = canvas.getContext('2d');
  const buttons = [...document.querySelectorAll('[data-dir]')];
  const keys = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' };
  const footprints = new Map();
  const angles = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
  const mobileLayout = window.matchMedia('(max-width: 760px), (max-height: 500px) and (max-width: 1000px)');
  // Path2D создаётся один раз из тех же контуров, что показаны в легенде.
  // Это исключает различия эмодзи на Android, iOS и компьютере.
  const icons = Object.fromEntries(['person', 'door', 'footprints'].map(name => [name,
    [...document.querySelectorAll(`#icon-${name} path`)].map(path => ({
      path: new Path2D(path.getAttribute('d')),
      fill: path.getAttribute('fill'), opacity: Number(path.getAttribute('fill-opacity') || 1)
    }))
  ]));
  let game = new MazeCore.Game(), shownStatus, holding = null, heldKey = null, pointerId = null, lastMove = 0;
  function drawIcon(name, x, y, size, color, angle = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(size / 24, size / 24); ctx.translate(-12, -12);
    for (const shape of icons[name]) {
      ctx.fillStyle = shape.fill || color; ctx.globalAlpha = shape.opacity; ctx.fill(shape.path);
    }
    ctx.restore();
  }
  function placeDialog() {
    const focused = document.activeElement;
    document.body.classList.toggle('mobile-ui', mobileLayout.matches);
    const destination = mobileLayout.matches ? $('mobile-dialog-slot') : document.querySelector('.board-wrap');
    if ($('overlay').parentElement !== destination) destination.append($('overlay'));
    // На телефоне это встроенная панель: карта и управление остаются видны.
    const dialog = document.querySelector('.dialog');
    dialog.setAttribute('role', mobileLayout.matches ? 'region' : 'dialog');
    if (mobileLayout.matches) dialog.removeAttribute('aria-modal');
    else dialog.setAttribute('aria-modal', 'true');
    if (focused === $('primary')) focused.focus({ preventScroll: true });
    if (game.status === 'ready') $('primary').textContent = mobileLayout.matches ? 'Начать' : 'Начать исследование';
    requestAnimationFrame(draw);
  }
  function release() {
    holding = null; heldKey = null; pointerId = null;
    buttons.forEach(button => button.classList.remove('held'));
  }
  function draw() {
    const { size, cells, exit } = game.maze;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.getBoundingClientRect().width * scale);
    if (canvas.width !== width) canvas.width = canvas.height = width;
    const w = canvas.width, pad = w * .035, unit = (w - pad * 2) / size;
    ctx.fillStyle = '#142020'; ctx.fillRect(0, 0, w, w);
    const point = index => [pad + (index % size + .5) * unit, pad + (Math.floor(index / size) + .5) * unit];
    // Неисследованные комнаты обозначены едва заметными точками, а не стенами:
    // готовый маршрут не раскрывается. Посещённые места сохраняют след.
    for (let i = 0; i < cells.length; i++) {
      const [cx, cy] = point(i);
      if (!game.seen.has(i)) { ctx.fillStyle = '#2c3935'; ctx.fillRect(cx - 1, cy - 1, 2, 2); continue; }
      const nearby = Math.hypot(i % size - game.position % size, Math.floor(i / size) - Math.floor(game.position / size)) <= 2.5;
      const x = cx - unit / 2, y = cy - unit / 2;
      ctx.fillStyle = nearby ? '#233c32' : '#1c2c27'; ctx.fillRect(x, y, unit, unit);
      ctx.strokeStyle = nearby ? '#8fae97' : '#4e6857'; ctx.lineWidth = Math.max(1.5, unit * .065); ctx.lineCap = 'round';
      ctx.beginPath();
      if (cells[i] & 1) { ctx.moveTo(x, y); ctx.lineTo(x + unit, y); }
      if (cells[i] & 2) { ctx.moveTo(x + unit, y); ctx.lineTo(x + unit, y + unit); }
      if (cells[i] & 4) { ctx.moveTo(x, y + unit); ctx.lineTo(x + unit, y + unit); }
      if (cells[i] & 8) { ctx.moveTo(x, y); ctx.lineTo(x, y + unit); }
      ctx.stroke();
      if (footprints.has(i) && i !== game.position && i !== exit) {
        drawIcon('footprints', cx, cy, unit * .61, '#789e87', angles[footprints.get(i)]);
      }
    }
    // Дверь видна сквозь туман; свечение не перекрывает её узнаваемый контур.
    const [ex, ey] = point(exit);
    ctx.shadowColor = '#f0ce83'; ctx.shadowBlur = unit * .3;
    drawIcon('door', ex, ey, unit * .85, '#f0ce83');
    ctx.shadowBlur = 0;
    const [px, py] = point(game.position);
    ctx.shadowColor = '#a8e6c5'; ctx.shadowBlur = unit * .2;
    drawIcon('person', px, py, unit * .86, '#bcf6d7');
    ctx.shadowBlur = 0;
  }
  function sync() {
    const seconds = Math.ceil(game.remaining() / 1000);
    $('time').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    $('time-bar').style.width = `${game.remaining() / 1800}%`;
    document.querySelector('.time-block').classList.toggle('urgent', seconds <= 30);
    $('steps').textContent = game.steps;
    $('explored').textContent = `${Math.round(game.seen.size / game.maze.cells.length * 100)}%`;
    if (shownStatus === game.status) return;
    shownStatus = game.status; release();
    document.querySelector('.game').dataset.state = game.status;
    const active = game.status === 'playing';
    buttons.forEach(button => button.disabled = !active);
    $('pause').disabled = !active;
    $('overlay').hidden = active;
    // Карта исключена из Tab-порядка, пока поверх неё открыто окно.
    canvas.tabIndex = active ? 0 : -1;
    if (active) { canvas.focus({ preventScroll: true }); return; }
    const messages = {
      ready: ['✦', 'НЕБОЛЬШОЕ ПУТЕШЕСТВИЕ', 'Найди выход.', 'Исследуй лабиринт и доберись до золотой двери. Карта открывается по мере движения. У тебя 3 минуты.', 'Начать исследование'],
      paused: ['Ⅱ', 'МОЖНО ПЕРЕВЕСТИ ДУХ', 'На паузе.', 'Игра на паузе. Время остановлено, исследованная карта сохранена.', 'Продолжить'],
      won: ['✦', 'ЭКСПЕДИЦИЯ ЗАВЕРШЕНА', 'Ты нашёл выход!', `Лабиринт пройден за ${Math.floor(game.elapsed / 60000)} мин ${Math.floor(game.elapsed / 1000) % 60} сек. Сделано шагов: ${game.steps}. Отправимся в новое путешествие?`, 'Новый лабиринт'],
      lost: ['◷', 'ПУТЕШЕСТВИЕ НЕ ЗАКОНЧЕНО', 'Время вышло.', `Ты исследовал ${Math.round(game.seen.size / game.maze.cells.length * 100)}% карты. Ещё один лабиринт — ещё один шанс найти путь.`, 'Попробовать снова']
    };
    const [icon, label, title, copy, action] = messages[game.status];
    $('dialog-icon').textContent = icon; $('dialog-label').textContent = label;
    $('dialog-title').textContent = title; $('dialog-copy').textContent = copy; $('primary').textContent = action;
    if (mobileLayout.matches && game.status === 'ready') $('primary').textContent = 'Начать';
    $('mobile-copy').textContent = {
      ready: 'Найди дверь за 3 минуты.', paused: 'Время остановлено.',
      won: `${game.steps} шагов. Отличный путь!`, lost: 'Новая карта — новый шанс.'
    }[game.status];
    $('announcement').textContent = `${title} ${copy}`;
    $('primary').focus({ preventScroll: true });
  }
  function move(direction) {
    const previous = game.position;
    if (game.move(direction)) { footprints.set(previous, direction); draw(); }
    sync();
  }
  function beginHold(direction) { holding = direction; lastMove = performance.now(); move(direction); }
  $('primary').addEventListener('click', () => {
    if (game.status === 'won' || game.status === 'lost') { game = new MazeCore.Game(); footprints.clear(); }
    game.start(); sync(); draw();
  });
  $('pause').addEventListener('click', () => { game.pause(); sync(); });
  document.addEventListener('keydown', event => {
    if (!keys[event.key] || event.altKey || event.ctrlKey || event.metaKey) {
      if (event.key === 'Escape' && game.status === 'playing') { game.pause(); sync(); }
      // В модальном окне одно действие: Tab остаётся на нём.
      if (event.key === 'Tab' && game.status !== 'playing' && !mobileLayout.matches) { event.preventDefault(); $('primary').focus(); }
      return;
    }
    if (game.status !== 'playing') return;
    event.preventDefault();
    if (event.repeat) return;
    heldKey = event.key; beginHold(keys[event.key]);
  });
  document.addEventListener('keyup', event => { if (event.key === heldKey) release(); });
  buttons.forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (game.status !== 'playing' || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault(); release(); button.setPointerCapture(event.pointerId);
      beginHold(button.dataset.dir); pointerId = event.pointerId; button.classList.add('held');
    });
    // Клавиатурная активация и синтетический click ассистивных технологий.
    button.addEventListener('click', event => { if (event.detail === 0) move(button.dataset.dir); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, event => { if (event.pointerId === pointerId) release(); });
    button.addEventListener('contextmenu', event => event.preventDefault());
  });
  window.addEventListener('blur', () => { release(); game.pause(); sync(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { release(); game.pause(); sync(); } });
  window.addEventListener('resize', draw);
  // Размер квадратного поля меняется не только при повороте, но и при
  // появлении панелей браузера. Наблюдаем реальный CSS-размер Canvas.
  new ResizeObserver(draw).observe(canvas);
  mobileLayout.addEventListener('change', placeDialog);
  // Один цикл для таймера и удержания. После потери фокуса накопленные ходы
  // не догоняются: игра приостановлена, скорость не зависит от частоты экрана.
  function frame(now) {
    game.tick();
    if (holding && game.status === 'playing' && now - lastMove >= 145) { lastMove = now; move(holding); }
    sync(); requestAnimationFrame(frame);
  }
  placeDialog(); sync(); draw(); requestAnimationFrame(frame);
})();
