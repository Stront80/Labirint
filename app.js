/* Интерфейс не требует сервера, сети, хранилища или внешних библиотек. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('board'), ctx = canvas.getContext('2d');
  const buttons = [...document.querySelectorAll('[data-dir]')];
  const keys = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' };
  const footprints = new Map();
  const attempts = new MazeCore.AttemptHistory();
  const angles = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
  const mobileLayout = window.matchMedia('(max-width: 760px), (max-height: 500px) and (max-width: 1000px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motion = { from: 0, startedAt: -Infinity, facing: 1, winAt: null, repaint: false };
  const bump = { position: 0, direction: 'up', startedAt: -Infinity };
  const boardDescription = canvas.getAttribute('aria-label');
  // Path2D создаётся один раз из тех же контуров, что показаны в легенде.
  // Это исключает различия эмодзи на Android, iOS и компьютере.
  const icons = Object.fromEntries(['person', 'door', 'footprints'].map(name => [name,
    [...document.querySelectorAll(`#icon-${name} path`)].map(path => ({
      path: new Path2D(path.getAttribute('d')),
      fill: path.getAttribute('fill'), opacity: Number(path.getAttribute('fill-opacity') || 1),
      swing: Number(path.dataset.swing || 0), pivot: (path.dataset.pivot || '0,0').split(',').map(Number)
    }))
  ]));
  function freshMaze() {
    const seed = new Uint32Array(1);
    window.crypto.getRandomValues(seed);
    return MazeCore.seededMaze(seed[0]);
  }
  const linkedCode = location.hash.length <= 80 ? new URLSearchParams(location.hash.slice(1)).get('maze') : null;
  let game = new MazeCore.Game(MazeCore.fromCode(linkedCode) || freshMaze()), shownStatus, holding = null, heldKey = null, pointerId = null, lastMove = 0;
  function rememberCode() {
    // replaceState не добавляет запись на каждый повтор и не отправляет запрос.
    try { window.history.replaceState(null, '', `#maze=${game.maze.code}`); } catch { /* file:// может ограничивать History API. */ }
  }
  function drawIcon(name, x, y, size, color, angle = 0, stride = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(size / 24, size / 24); ctx.translate(-12, -12);
    const opacity = ctx.globalAlpha;
    for (const shape of icons[name]) {
      ctx.save();
      if (shape.swing && stride) {
        const [px, py] = shape.pivot;
        ctx.translate(px, py); ctx.rotate(stride * shape.swing); ctx.translate(-px, -py);
      }
      ctx.fillStyle = shape.fill || color; ctx.globalAlpha = opacity * shape.opacity; ctx.fill(shape.path);
      ctx.restore();
    }
    ctx.restore();
  }
  function placeDialog() {
    const focused = document.activeElement;
    document.body.classList.toggle('mobile-ui', mobileLayout.matches);
    const inline = mobileLayout.matches || game.finished;
    const destination = inline ? $('mobile-dialog-slot') : document.querySelector('.board-wrap');
    if ($('overlay').parentElement !== destination) destination.append($('overlay'));
    // На телефоне это встроенная панель: карта и управление остаются видны.
    const dialog = document.querySelector('.dialog');
    dialog.setAttribute('role', inline ? 'region' : 'dialog');
    if (inline) dialog.removeAttribute('aria-modal');
    else dialog.setAttribute('aria-modal', 'true');
    if (focused === $('primary')) focused.focus({ preventScroll: true });
    if (game.status === 'ready') $('primary').textContent = mobileLayout.matches ? 'Начать' : 'Начать исследование';
    requestAnimationFrame(draw);
  }
  function release() {
    holding = null; heldKey = null; pointerId = null;
    buttons.forEach(button => button.classList.remove('held'));
  }
  function drawPerson(x, y, unit, progress, entering) {
    ctx.save(); ctx.translate(x, y);
    const stride = reducedMotion.matches ? 0 : Math.sin(progress * Math.PI) * .12;
    // Силуэт пешеходного светофора всегда стоит вертикально. При движении
    // влево он отражается, а вверх/вниз сохраняет предыдущую сторону взгляда.
    // Легенда и Canvas используют один контур; слегка качаются только конечности.
    const disappear = reducedMotion.matches ? 0 : Math.max(0, Math.min(1, (entering - .3) / .7));
    ctx.globalAlpha = 1 - disappear;
    ctx.scale(motion.facing * (1 - disappear * .4), 1 - disappear * .4);
    drawIcon('person', 0, 0, unit * .94, '#bcf6d7', 0, stride);
    ctx.restore();
  }
  function drawDoor(x, y, unit, opening) {
    ctx.save(); ctx.translate(x, y); ctx.scale(unit * .85 / 24, unit * .85 / 24); ctx.translate(-12, -12);
    ctx.fillStyle = '#08120f'; ctx.fillRect(7, 8, 10, 14);
    ctx.fillStyle = '#f0ce83'; ctx.fill(icons.door[0].path);
    const edge = 16 - opening * 7;
    ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(edge, 8 - opening * 2);
    ctx.lineTo(edge, 22); ctx.lineTo(8, 21); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#142020'; ctx.fillRect(edge - 2, 14, 1.2, 2);
    ctx.restore();
  }
  function draw(now = performance.now()) {
    const { size, cells, exit } = game.maze;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.getBoundingClientRect().width * scale);
    if (!width) return;
    if (canvas.width !== width) canvas.width = canvas.height = width;
    const w = canvas.width, pad = w * .035, unit = (w - pad * 2) / size;
    ctx.fillStyle = '#142020'; ctx.fillRect(0, 0, w, w);
    const point = index => [pad + (index % size + .5) * unit, pad + (Math.floor(index / size) + .5) * unit];
    // Неисследованные комнаты обозначены едва заметными точками, а не стенами:
    // готовый маршрут не раскрывается. Посещённые места сохраняют след.
    for (let i = 0; i < cells.length; i++) {
      const [cx, cy] = point(i);
      if (!game.finished && !game.seen.has(i)) { ctx.fillStyle = '#2c3935'; ctx.fillRect(cx - 1, cy - 1, 2, 2); continue; }
      const nearby = !game.finished && game.lit.has(i);
      const x = cx - unit / 2, y = cy - unit / 2;
      ctx.fillStyle = nearby ? '#233c32' : '#1c2c27'; ctx.fillRect(x, y, unit, unit);
      ctx.strokeStyle = nearby ? '#8fae97' : '#4e6857'; ctx.lineWidth = Math.max(1.5, unit * .065); ctx.lineCap = 'round';
      ctx.beginPath();
      if (cells[i] & 1) { ctx.moveTo(x, y); ctx.lineTo(x + unit, y); }
      if (cells[i] & 2) { ctx.moveTo(x + unit, y); ctx.lineTo(x + unit, y + unit); }
      if (cells[i] & 4) { ctx.moveTo(x, y + unit); ctx.lineTo(x + unit, y + unit); }
      if (cells[i] & 8) { ctx.moveTo(x, y); ctx.lineTo(x, y + unit); }
      ctx.stroke();
    }
    // Подсвечиваем именно стену, которая остановила ход, а не всю клетку.
    // Подсветка остаётся при reduced-motion; смещение игрока отключается ниже.
    const bumpAge = now - bump.startedAt;
    if (game.status === 'playing' && bumpAge >= 0 && bumpAge < 180) {
      const [bx, by] = point(bump.position), x = bx - unit / 2, y = by - unit / 2;
      ctx.strokeStyle = '#f2aa8c'; ctx.lineWidth = Math.max(2, unit * .11); ctx.beginPath();
      if (bump.direction === 'up') { ctx.moveTo(x, y); ctx.lineTo(x + unit, y); }
      if (bump.direction === 'down') { ctx.moveTo(x, y + unit); ctx.lineTo(x + unit, y + unit); }
      if (bump.direction === 'left') { ctx.moveTo(x, y); ctx.lineTo(x, y + unit); }
      if (bump.direction === 'right') { ctx.moveTo(x + unit, y); ctx.lineTo(x + unit, y + unit); }
      ctx.stroke();
    }
    // Полный маршрут включает возвраты. Открытие карты не меняет seen:
    // итоговый процент остаётся фактически исследованным игроком.
    if (game.finished && game.route.length > 1) {
      ctx.strokeStyle = '#7bb99a'; ctx.lineWidth = Math.max(1, unit * .08); ctx.lineJoin = 'round';
      ctx.beginPath();
      game.route.forEach((index, i) => { const [x, y] = point(index); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
    }
    for (const [index, direction] of footprints) {
      if (index !== game.position && index !== exit) {
        const [x, y] = point(index); drawIcon('footprints', x, y, unit * .61, '#789e87', angles[direction]);
      }
    }
    // Дверь видна сквозь туман; свечение не перекрывает её узнаваемый контур.
    const [ex, ey] = point(exit);
    ctx.shadowColor = '#f0ce83'; ctx.shadowBlur = unit * .3;
    const opening = game.status === 'won' ? (reducedMotion.matches ? 1 : Math.min(1, Math.max(0, (now - motion.winAt) / 650))) : 0;
    drawDoor(ex, ey, unit, opening);
    ctx.shadowBlur = 0;
    const [targetX, targetY] = point(game.position), [fromX, fromY] = point(motion.from);
    const progress = reducedMotion.matches || game.status === 'paused' ? 1 : Math.min(1, Math.max(0, (now - motion.startedAt) / 115));
    const ease = progress * (2 - progress);
    let px = fromX + (targetX - fromX) * ease, py = fromY + (targetY - fromY) * ease;
    if (!reducedMotion.matches && game.status === 'playing' && bumpAge >= 0 && bumpAge < 160) {
      const [dx, dy] = MazeCore.DIRECTIONS[bump.direction];
      const offset = Math.sin(bumpAge / 160 * Math.PI) * unit * .075;
      px += dx * offset; py += dy * offset;
    }
    ctx.shadowColor = '#a8e6c5'; ctx.shadowBlur = unit * .2;
    drawPerson(px, py, unit, progress, opening);
    ctx.shadowBlur = 0;
  }
  function sync() {
    const seconds = game.finished ? Math.floor(game.elapsed / 1000) : Math.ceil(game.remaining() / 1000);
    $('time').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    $('time-bar').style.width = `${game.remaining() / game.rules.durationMs * 100}%`;
    document.querySelector('.time-block').classList.toggle('urgent', !game.finished && seconds <= 30);
    $('steps').textContent = game.steps;
    $('explored').textContent = `${Math.round(game.seen.size / game.maze.cells.length * 100)}%`;
    if (shownStatus === game.status) return;
    shownStatus = game.status; release();
    if (game.status === 'won') { motion.winAt = performance.now(); motion.repaint = true; }
    document.querySelector('.game').dataset.state = game.status;
    document.querySelector('.game').classList.toggle('finished', game.finished);
    $('map-label').textContent = game.finished ? 'КАРТА ОТКРЫТА' : 'ЭКСПЕДИЦИЯ';
    $('time-label').textContent = game.finished ? 'ВРЕМЯ ПАРТИИ' : 'ОСТАЛОСЬ ВРЕМЕНИ';
    $('time').setAttribute('aria-label', game.finished ? 'Время партии' : 'Осталось времени');
    canvas.setAttribute('aria-label', boardDescription + (game.finished ? ' Партия завершена: вся карта открыта, ваш маршрут отмечен линией.' : ''));
    const active = game.status === 'playing';
    buttons.forEach(button => button.disabled = !active);
    $('pause').disabled = !active;
    $('overlay').hidden = active;
    $('new-maze').hidden = !game.finished;
    $('share').hidden = !game.finished;
    $('comparison').hidden = !game.finished;
    $('comparison').textContent = game.finished ? attempts.record(game) : '';
    placeDialog();
    // Карта исключена из Tab-порядка, пока поверх неё открыто окно.
    canvas.tabIndex = active || game.finished ? 0 : -1;
    if (active) { canvas.focus({ preventScroll: true }); return; }
    const messages = {
      ready: ['✦', 'НЕБОЛЬШОЕ ПУТЕШЕСТВИЕ', 'Найди выход.', 'Исследуй лабиринт и доберись до золотой двери. Карта открывается по мере движения. У тебя 3 минуты.', 'Начать исследование'],
      paused: ['Ⅱ', 'МОЖНО ПЕРЕВЕСТИ ДУХ', 'На паузе.', 'Игра на паузе. Время остановлено, исследованная карта сохранена.', 'Продолжить'],
      won: ['✦', 'ЭКСПЕДИЦИЯ ЗАВЕРШЕНА', 'Выход найден!', 'Вся карта открыта. Посмотри свой маршрут и попробуй пройти эту карту ещё раз или исследуй новую.', 'Повторить карту'],
      lost: ['◷', 'ПУТЕШЕСТВИЕ НЕ ЗАКОНЧЕНО', 'Время вышло.', 'Вся карта открыта. Посмотри, где находился выход. Можно повторить эту карту с самого начала или выбрать новую.', 'Повторить карту']
    };
    const [icon, label, title, copy, action] = messages[game.status];
    $('dialog-icon').textContent = icon; $('dialog-label').textContent = label;
    $('dialog-title').textContent = title; $('dialog-copy').textContent = copy; $('primary').textContent = action;
    if (mobileLayout.matches && game.status === 'ready') $('primary').textContent = 'Начать';
    $('mobile-copy').textContent = {
      ready: 'Найди дверь за 3 минуты.', paused: 'Время остановлено.',
      won: 'Маршрут на карте.', lost: 'Выход теперь виден.'
    }[game.status];
    $('announcement').textContent = `${title} ${copy}` + (game.finished ? ` Время ${$('time').textContent}, шагов ${game.steps}, исследовано ${$('explored').textContent}. ${$('comparison').textContent}` : '');
    $('primary').focus({ preventScroll: true });
    draw();
  }
  function move(direction) {
    const previous = game.position;
    if (direction === 'left') motion.facing = -1;
    if (direction === 'right') motion.facing = 1;
    if (game.move(direction)) {
      bump.startedAt = -Infinity;
      motion.from = previous; motion.startedAt = performance.now(); motion.repaint = true;
      footprints.set(previous, direction); draw();
    } else {
      if (game.status === 'playing' && MazeCore.DIRECTIONS[direction] && game.maze.cells[previous] & MazeCore.DIRECTIONS[direction][2]) {
        bump.position = previous; bump.direction = direction; bump.startedAt = performance.now();
      }
      draw();
    }
    sync();
  }
  function beginHold(direction) { holding = direction; lastMove = performance.now(); move(direction); }
  function resetView() {
    footprints.clear(); motion.from = 0; motion.startedAt = -Infinity; motion.facing = 1; motion.winAt = null;
    motion.repaint = false;
    bump.startedAt = -Infinity; rememberCode();
  }
  $('primary').addEventListener('click', () => {
    if (game.finished) { game = game.retry(); resetView(); }
    game.start(); sync(); draw();
  });
  $('new-maze').addEventListener('click', () => {
    if (!game.finished) return;
    game = new MazeCore.Game(freshMaze()); resetView(); game.start(); sync(); draw();
  });
  $('open-code').addEventListener('click', () => {
    release(); game.pause(); sync();
    $('map-code').value = game.maze.code;
    $('code-error').textContent = '';
    $('code-dialog').showModal(); $('map-code').select();
  });
  $('close-code').addEventListener('click', () => $('code-dialog').close());
  $('code-form').addEventListener('submit', event => {
    event.preventDefault();
    const maze = MazeCore.fromCode($('map-code').value);
    if (!maze) { $('code-error').textContent = 'Проверьте код: например, L1-00000001.'; $('map-code').focus(); return; }
    $('code-dialog').close(); game = new MazeCore.Game(maze); resetView(); game.start(); sync(); draw();
  });
  let sharing = false;
  $('share').addEventListener('click', async () => {
    if (!game.finished || sharing) return;
    const payload = MazeCore.sharePayload(game, location.href);
    sharing = true; $('share').disabled = true;
    try {
      if (typeof navigator.share === 'function') {
        try { await navigator.share(payload); return; }
        catch (error) { if (error?.name === 'AbortError') return; }
      }
      // Без системного меню показываем текст, не копируем и не отправляем
      // ничего автоматически. Пользователь сам выбирает действие и получателя.
      $('share-text').value = payload.text + (payload.url ? `\n${payload.url}` : '\nОткройте игру и введите этот код кнопкой «Код карты».');
      $('share-status').textContent = payload.url ? 'Можно скопировать текст вместе со ссылкой.' : 'Локальная версия: делимся кодом карты без пути к файлу.';
      $('share-dialog').showModal();
    } finally { sharing = false; $('share').disabled = false; }
  });
  $('copy-share').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText($('share-text').value);
      $('share-status').textContent = 'Скопировано. Теперь можно отправить другу.';
    } catch {
      $('share-text').focus(); $('share-text').select();
      $('share-status').textContent = 'Скопируйте выделенный текст вручную.';
    }
  });
  $('close-share').addEventListener('click', () => $('share-dialog').close());
  window.addEventListener('hashchange', () => {
    if (location.hash.length > 80) return;
    const maze = MazeCore.fromCode(new URLSearchParams(location.hash.slice(1)).get('maze'));
    if (!maze || maze.code === game.maze.code) return;
    release(); game = new MazeCore.Game(maze); resetView(); sync(); draw();
  });
  $('pause').addEventListener('click', () => { game.pause(); sync(); });
  document.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]')) return;
    if (!keys[event.key] || event.altKey || event.ctrlKey || event.metaKey) {
      if (event.key === 'Escape' && game.status === 'playing') { game.pause(); sync(); }
      // В модальном окне одно действие: Tab остаётся на нём.
      if (event.key === 'Tab' && game.status !== 'playing' && !game.finished && !mobileLayout.matches) { event.preventDefault(); $('primary').focus(); }
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
  window.addEventListener('resize', () => draw());
  // Размер квадратного поля меняется не только при повороте, но и при
  // появлении панелей браузера. Наблюдаем реальный CSS-размер Canvas.
  new ResizeObserver(() => draw()).observe(canvas);
  mobileLayout.addEventListener('change', placeDialog);
  reducedMotion.addEventListener('change', () => draw());
  // Один цикл для таймера и удержания. После потери фокуса накопленные ходы
  // не догоняются: игра приостановлена, скорость не зависит от частоты экрана.
  function frame(now) {
    game.tick();
    if (holding && game.status === 'playing' && now - lastMove >= game.rules.stepMs) { lastMove = now; move(holding); }
    sync();
    let repaint = motion.repaint;
    if (Number.isFinite(bump.startedAt)) {
      repaint = true;
      if (game.status !== 'playing' || now - bump.startedAt >= 180) bump.startedAt = -Infinity;
    }
    // Обязательно рисуем конечное состояние даже если браузер пропустил кадр
    // и сразу перескочил за длительность эффекта. Иначе подсветка или шаг
    // могли бы остаться на экране до следующего нажатия.
    if (motion.repaint && (reducedMotion.matches || (now - motion.startedAt >= 115 && (game.status !== 'won' || now - motion.winAt >= 700)))) motion.repaint = false;
    if (repaint) draw(now);
    requestAnimationFrame(frame);
  }
  rememberCode(); placeDialog(); sync(); draw(); requestAnimationFrame(frame);
})();
