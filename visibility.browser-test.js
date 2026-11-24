/* Проверка настоящего Canvas в Chromium через Playwright.
   Запуск: browser_run_code_unsafe с filename этого файла на открытой странице игры.
   Используется отдельный контекст: настройки и партия пользователя не меняются. */
async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 } });
  const results = [];
  const errors = [];
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  try {
    await context.addInitScript(() => {
      localStorage.setItem('labyrinth.preferences.v1', JSON.stringify({
        language: 'ru', difficulty: 'hard', music: false, effects: false
      }));
      // Считаем реальные команды рисования последнего кадра, а не только
      // состояние модели: полутёмный пол и стены не должны попасть на Canvas.
      const proto = CanvasRenderingContext2D.prototype;
      const fillRect = proto.fillRect, stroke = proto.stroke;
      window.dimDrawing = { floors: 0, walls: 0 };
      proto.fillRect = function (x, y, width, height) {
        if (this.canvas.id === 'board') {
          if (width === this.canvas.width && height === this.canvas.height) window.dimDrawing = { floors: 0, walls: 0 };
          if (this.fillStyle === '#1c2c27') window.dimDrawing.floors++;
        }
        return fillRect.call(this, x, y, width, height);
      };
      proto.stroke = function (...args) {
        if (this.canvas.id === 'board' && this.strokeStyle === '#4e6857') window.dimDrawing.walls++;
        return stroke.apply(this, args);
      };
    });
    const tab = await context.newPage();
    tab.on('pageerror', error => errors.push(error.message));
    const url = new URL(page.url());
    url.hash = 'maze=L1-0000002A';
    await tab.goto(url.href);
    const route = await tab.evaluate(() => {
      const maze = MazeCore.fromCode('L1-0000002A');
      const queue = [{ index: 0, directions: [], rooms: [0] }], seen = new Set([0]);
      for (const item of queue) {
        if (item.index === maze.exit) return item;
        for (const [name, [dx, dy, wall]] of Object.entries(MazeCore.DIRECTIONS)) {
          if (maze.cells[item.index] & wall) continue;
          const next = item.index + dy * maze.size + dx;
          if (seen.has(next)) continue;
          seen.add(next);
          queue.push({ index: next, directions: [...item.directions, name], rooms: [...item.rooms, next] });
        }
      }
    });
    // Четвёртая комната сначала не открыта, затем посещена, а после восьми
    // шагов снова вне света. Сравниваем один и тот же участок до и после:
    // совпасть должны все пиксели, включая место, где были следы.
    const target = route.rooms[4];
    const patch = async () => tab.evaluate(index => {
      const canvas = document.querySelector('#board'), unit = canvas.width * .93 / 15, pad = canvas.width * .035;
      const x = Math.round(pad + (index % 15 + .15) * unit);
      const y = Math.round(pad + (Math.floor(index / 15) + .15) * unit);
      return Array.from(canvas.getContext('2d').getImageData(x, y, Math.floor(unit * .7), Math.floor(unit * .7)).data).join(',');
    }, target);
    const keys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    const walk = async directions => {
      for (const direction of directions) await tab.keyboard.press(keys[direction]);
      // Дожидаемся окончания шага, чтобы движущийся силуэт не влиял на снимок.
      await tab.waitForTimeout(180);
    };
    for (const [width, height] of [[1280, 900], [320, 568]]) {
      await tab.setViewportSize({ width, height });
      await tab.reload();
      const unexplored = await patch();
      await tab.locator('#primary').click();
      await walk(route.directions.slice(0, 8));
      check(await patch() === unexplored, 'В сложном режиме вне света остались пол, стены или следы');
      const drawing = await tab.evaluate(() => window.dimDrawing);
      check(drawing.floors === 0 && drawing.walls === 0, 'В сложном режиме нарисована полутёмная область');
      const explored = await tab.locator('#explored').textContent();
      const reverse = { up: 'down', down: 'up', left: 'right', right: 'left' };
      await walk(route.directions.slice(4, 8).reverse().map(direction => reverse[direction]));
      check(await patch() !== unexplored, 'При возвращении комната не появилась в свете');
      check(await tab.locator('#explored').textContent() === explored, 'Возвращение изменило процент исследования');
      await tab.locator('#open-menu').click();
      check(await tab.locator('input[name="difficulty"][value="hard"]').isChecked(), 'Сложность не сохранилась');
      await tab.locator('input[name="difficulty"][value="normal"]').check();
      await tab.locator('#apply-difficulty').click();
      await walk(route.directions.slice(0, 8));
      check(await patch() !== unexplored, 'Обычный режим потерял память карты');
      const normalDrawing = await tab.evaluate(() => window.dimDrawing);
      check(normalDrawing.floors > 0 && normalDrawing.walls > 0, 'В обычном режиме не отображается исследованная область');
      results.push({ width, height, hard: 'полностью скрыто', normal: 'память сохранена', return: 'комната снова видна' });
    }
    check(errors.length === 0, errors.join('\n'));
    return { results, errors };
  } finally {
    await context.close();
  }
}
