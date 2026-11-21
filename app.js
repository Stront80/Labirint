/* Игра не требует сервера и библиотек. Локально сохраняются только настройки,
   результаты попыток остаются в памяти страницы. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const preferencesKey = 'labyrinth.preferences.v1';
  let preferences = MazeI18n.normalizePreferences(null), preferencesPersistent = true;
  try {
    const stored = localStorage.getItem(preferencesKey);
    if (stored && stored.length <= 256) preferences = MazeI18n.normalizePreferences(JSON.parse(stored));
  } catch { preferencesPersistent = false; }
  const t = (key, values) => MazeI18n.t(preferences.language, key, values);
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
    if (game.status === 'ready') $('primary').textContent = t(mobileLayout.matches ? 'startShort' : 'start');
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
  function renderStatusText(announce = false) {
    $('map-label').textContent = t(game.finished ? 'mapOpen' : 'expedition');
    $('time-label').textContent = t(game.finished ? 'timeSpent' : 'timeLeft');
    $('time').setAttribute('aria-label', t(game.finished ? 'timerSpent' : 'timerLeft'));
    canvas.setAttribute('aria-label', t('board') + (game.finished ? ` ${t('boardFinished')}` : ''));
    $('comparison').textContent = game.finished ? MazeI18n.comparison(preferences.language, attempts.recordPair(game)) : '';
    const state = game.status === 'playing' ? 'ready' : game.status;
    $('dialog-icon').textContent = { ready: '✦', paused: 'Ⅱ', won: '✦', lost: '◷' }[state];
    $('dialog-label').textContent = t(`${state}Label`);
    $('dialog-title').textContent = t(`${state}Title`);
    $('dialog-copy').textContent = t(`${state}Copy`);
    $('mobile-copy').textContent = t(`${state}Short`);
    $('primary').textContent = t(game.finished ? 'retry' : state === 'paused' ? 'resume' : mobileLayout.matches ? 'startShort' : 'start');
    if (announce || $('announcement').textContent) {
      $('announcement').textContent = game.status === 'playing' ? '' : `${t(`${state}Title`)} ${t(`${state}Copy`)}` +
        (game.finished ? ` ${t('resultAnnouncement', { time: $('time').textContent, steps: game.steps, explored: Math.round(game.seen.size / game.maze.cells.length * 100) })} ${$('comparison').textContent}` : '');
    }
  }
  function applyPreferences() {
    document.documentElement.lang = preferences.language;
    document.body.dataset.hand = preferences.hand;
    document.title = t('title');
    document.querySelector('meta[name="description"]').content = t('description');
    document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
    for (const attribute of ['aria-label', 'alt']) {
      document.querySelectorAll(`[data-i18n-${attribute}]`).forEach(node => { node.setAttribute(attribute, t(node.getAttribute(`data-i18n-${attribute}`))); });
    }
    for (const name of ['language', 'hand']) {
      document.querySelectorAll(`input[name="${name}"]`).forEach(input => { input.checked = input.value === preferences[name]; });
    }
    $('preferences-note').textContent = t(preferencesPersistent ? 'prefsSaved' : 'prefsSession');
    const paragraphs = MazeI18n.stories[preferences.language].map(text => {
      const p = document.createElement('p'); p.textContent = text; return p;
    });
    $('story-paragraphs').replaceChildren(...paragraphs);
    if ($('code-error').textContent) $('code-error').textContent = t('codeError');
    renderStatusText();
    requestAnimationFrame(draw);
  }
  function savePreferences() {
    try { localStorage.setItem(preferencesKey, JSON.stringify(preferences)); preferencesPersistent = true; }
    catch { preferencesPersistent = false; }
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
    const active = game.status === 'playing';
    buttons.forEach(button => button.disabled = !active);
    $('pause').disabled = !active;
    $('overlay').hidden = active;
    $('new-maze').hidden = !game.finished;
    $('share').hidden = !game.finished;
    $('comparison').hidden = !game.finished;
    renderStatusText(true);
    placeDialog();
    // Карта исключена из Tab-порядка, пока поверх неё открыто окно.
    canvas.tabIndex = active || game.finished ? 0 : -1;
    if (active) { canvas.focus({ preventScroll: true }); return; }
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
    if ($('menu-dialog').open) $('menu-dialog').close();
    $('map-code').value = game.maze.code;
    $('code-error').textContent = '';
    $('code-dialog').showModal(); $('map-code').select();
  });
  $('close-code').addEventListener('click', () => $('code-dialog').close());
  $('code-form').addEventListener('submit', event => {
    event.preventDefault();
    const maze = MazeCore.fromCode($('map-code').value);
    if (!maze) { $('code-error').textContent = t('codeError'); $('map-code').focus(); return; }
    $('code-dialog').close(); game = new MazeCore.Game(maze); resetView(); game.start(); sync(); draw();
  });
  let sharing = false;
  $('share').addEventListener('click', async () => {
    if (!game.finished || sharing) return;
    const payload = MazeCore.sharePayload(game, location.href);
    payload.title = t('brandTitle'); payload.text = MazeI18n.shareText(preferences.language, game);
    sharing = true; $('share').disabled = true;
    try {
      if (typeof navigator.share === 'function') {
        try { await navigator.share(payload); return; }
        catch (error) { if (error?.name === 'AbortError') return; }
      }
      // Без системного меню показываем текст, не копируем и не отправляем
      // ничего автоматически. Пользователь сам выбирает действие и получателя.
      $('share-text').value = payload.text + (payload.url ? `\n${payload.url}` : `\n${t('shareLocalHelp')}`);
      $('share-status').textContent = t(payload.url ? 'shareLinkNote' : 'shareLocalNote');
      $('share-dialog').showModal();
    } finally { sharing = false; $('share').disabled = false; }
  });
  $('copy-share').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText($('share-text').value);
      $('share-status').textContent = t('copied');
    } catch {
      $('share-text').focus(); $('share-text').select();
      $('share-status').textContent = t('manualCopy');
    }
  });
  $('close-share').addEventListener('click', () => $('share-dialog').close());
  $('open-menu').addEventListener('click', () => {
    release(); game.pause(); sync(); $('menu-dialog').showModal();
  });
  $('close-menu').addEventListener('click', () => $('menu-dialog').close());
  for (const name of ['language', 'hand']) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(input => input.addEventListener('change', () => {
      if (!input.checked) return;
      preferences = MazeI18n.normalizePreferences({ ...preferences, [name]: input.value });
      savePreferences(); applyPreferences();
    }));
  }
  $('open-story').addEventListener('click', () => {
    $('menu-dialog').close();
    // Иллюстрация загружается при первом открытии истории, а не перед игрой.
    if (!$('story-art').getAttribute('src')) $('story-art').src = 'assets/story.webp';
    $('story-dialog').showModal(); $('story-dialog').scrollTop = 0;
  });
  $('close-story').addEventListener('click', () => { $('story-dialog').close(); $('menu-dialog').showModal(); });
  $('story-play').addEventListener('click', () => $('story-dialog').close());
  $('story-art').addEventListener('error', () => { $('story-art').hidden = true; $('story-image-error').hidden = false; });
  for (const id of ['menu-dialog', 'story-dialog', 'code-dialog']) {
    $(id).addEventListener('close', () => {
      if (!document.querySelector('dialog[open]') && game.status !== 'playing') $('open-menu').focus({ preventScroll: true });
    });
  }
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
  rememberCode(); applyPreferences(); placeDialog(); sync(); draw(); requestAnimationFrame(frame);
})();
