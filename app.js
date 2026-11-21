/* Интерфейс не требует сервера, сети, хранилища или внешних библиотек. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('board'), ctx = canvas.getContext('2d');
  const buttons = [...document.querySelectorAll('[data-dir]')];
  const keys = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' };
  let game = new MazeCore.Game(), shownStatus, holding = null, heldKey = null, pointerId = null, lastMove = 0;
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
      if (game.trail.has(i)) { ctx.fillStyle = '#6d9a81'; ctx.beginPath(); ctx.arc(cx, cy, unit * .065, 0, Math.PI * 2); ctx.fill(); }
    }
    // Маяк виден сквозь туман, чтобы направление цели было понятно с начала.
    const [ex, ey] = point(exit);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(Math.PI / 4);
    ctx.shadowColor = '#f0ce83'; ctx.shadowBlur = unit * .7; ctx.fillStyle = '#f0ce83';
    ctx.fillRect(-unit * .17, -unit * .17, unit * .34, unit * .34); ctx.restore();
    const [px, py] = point(game.position);
    ctx.shadowColor = '#a8e6c5'; ctx.shadowBlur = unit * .6;
    ctx.fillStyle = '#bcf6d7'; ctx.beginPath(); ctx.arc(px, py, unit * .23, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#d6fbe7'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py, unit * .34, 0, Math.PI * 2); ctx.stroke();
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
    const active = game.status === 'playing';
    buttons.forEach(button => button.disabled = !active);
    $('pause').disabled = !active;
    $('overlay').hidden = active;
    // Карта исключена из Tab-порядка, пока поверх неё открыто окно.
    canvas.tabIndex = active ? 0 : -1;
    if (active) { canvas.focus({ preventScroll: true }); return; }
    const messages = {
      ready: ['✦', 'НЕБОЛЬШОЕ ПУТЕШЕСТВИЕ', 'Не все пути видны сразу.', 'Исследуй лабиринт и доберись до золотого маяка. Карта открывается по мере движения. У тебя 3 минуты.', 'Начать исследование'],
      paused: ['Ⅱ', 'МОЖНО ПЕРЕВЕСТИ ДУХ', 'Твой путь подождёт.', 'Игра на паузе. Время остановлено, исследованная карта сохранена.', 'Продолжить'],
      won: ['✦', 'ЭКСПЕДИЦИЯ ЗАВЕРШЕНА', 'Ты нашёл выход!', `Лабиринт пройден за ${Math.floor(game.elapsed / 60000)} мин ${Math.floor(game.elapsed / 1000) % 60} сек. Сделано шагов: ${game.steps}. Отправимся в новое путешествие?`, 'Новый лабиринт'],
      lost: ['◷', 'ПУТЕШЕСТВИЕ НЕ ЗАКОНЧЕНО', 'Время вышло.', `Ты исследовал ${Math.round(game.seen.size / game.maze.cells.length * 100)}% карты. Ещё один лабиринт — ещё один шанс найти путь.`, 'Попробовать снова']
    };
    const [icon, label, title, copy, action] = messages[game.status];
    $('dialog-icon').textContent = icon; $('dialog-label').textContent = label;
    $('dialog-title').textContent = title; $('dialog-copy').textContent = copy; $('primary').textContent = action;
    $('announcement').textContent = `${title} ${copy}`;
    $('primary').focus({ preventScroll: true });
  }
  function move(direction) { if (game.move(direction)) draw(); sync(); }
  function beginHold(direction) { holding = direction; lastMove = performance.now(); move(direction); }
  $('primary').addEventListener('click', () => {
    if (game.status === 'won' || game.status === 'lost') game = new MazeCore.Game();
    game.start(); sync(); draw();
  });
  $('pause').addEventListener('click', () => { game.pause(); sync(); });
  document.addEventListener('keydown', event => {
    if (!keys[event.key] || event.altKey || event.ctrlKey || event.metaKey) {
      if (event.key === 'Escape' && game.status === 'playing') { game.pause(); sync(); }
      // В модальном окне одно действие: Tab остаётся на нём.
      if (event.key === 'Tab' && game.status !== 'playing') { event.preventDefault(); $('primary').focus(); }
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
  // Один цикл для таймера и удержания. После потери фокуса накопленные ходы
  // не догоняются: игра приостановлена, скорость не зависит от частоты экрана.
  function frame(now) {
    game.tick();
    if (holding && game.status === 'playing' && now - lastMove >= 145) { lastMove = now; move(holding); }
    sync(); requestAnimationFrame(frame);
  }
  sync(); draw(); requestAnimationFrame(frame);
})();
