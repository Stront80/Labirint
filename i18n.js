/* Тексты и форматирование представления отделены от правил игры.
   Переключение языка не меняет карту, таймер и результаты попыток. */
(function (root) {
  'use strict';
  const messages = {
    ru: {
      title: 'Лабиринт — найди свой путь', brand: 'ЛАБИРИНТ', brandTitle: 'Лабиринт', home: 'Лабиринт — на старт',
      description: 'Исследуйте скрытый лабиринт и найдите выход за три минуты. Небольшая игра для компьютера и телефона.',
      edition: 'Маленькое приключение', eyebrow: 'ИДИ НА СВЕТ', heading: 'Найди свой путь.',
      subtitle: 'За каждым поворотом — что-то новое. Где-то впереди — выход.', pause: 'Пауза',
      game: 'Игра', expedition: 'ЭКСПЕДИЦИЯ', mapOpen: 'КАРТА ОТКРЫТА',
      board: 'Карта лабиринта. Управляйте стрелками. Бирюзовый человечек — вы, золотая дверь — выход, отпечатки ног — пройденный путь.',
      boardHard: 'Сложный режим: комнаты и следы видны только в текущем свете. Дверь видна всегда.',
      boardFinished: 'Партия завершена: вся карта открыта, ваш маршрут отмечен линией.',
      you: 'Вы', exit: 'Выход', tracks: 'Следы', sidebar: 'Показатели и управление',
      timeLeft: 'ОСТАЛОСЬ ВРЕМЕНИ', timeSpent: 'ВРЕМЯ ПАРТИИ', timerLeft: 'Осталось времени', timerSpent: 'Время партии',
      timeNote: 'Одна игра. Три минуты. Только ты и неизвестность.', explored: 'Исследовано', steps: 'Сделано шагов',
      chooseDirection: 'ВЫБИРАЙ НАПРАВЛЕНИЕ', direction: 'Направление движения',
      up: 'Вверх', left: 'Влево', right: 'Вправо', down: 'Вниз', hold: 'Удерживай, чтобы идти дальше',
      tip: 'Твои следы остаются на карте. Они помогут не ходить кругами.', footer: 'Заблудиться — часть приключения.',
      keyboardNote: 'Стрелки на клавиатуре или на экране', noScript: 'Для игры включите JavaScript в браузере.',
      readyLabel: 'НЕБОЛЬШОЕ ПУТЕШЕСТВИЕ', readyTitle: 'Найди выход.',
      readyCopy: 'Исследуй лабиринт и доберись до золотой двери. Карта открывается по мере движения. У тебя 3 минуты.',
      readyShort: 'Найди дверь за 3 минуты.', start: 'Начать исследование', startShort: 'Начать',
      pausedLabel: 'МОЖНО ПЕРЕВЕСТИ ДУХ', pausedTitle: 'На паузе.',
      pausedCopy: 'Игра на паузе. Время остановлено, исследованная карта сохранена.', pausedShort: 'Время остановлено.', resume: 'Продолжить',
      wonLabel: 'ЭКСПЕДИЦИЯ ЗАВЕРШЕНА', wonTitle: 'Выход найден!',
      wonCopy: 'Вся карта открыта. Посмотри свой маршрут и попробуй пройти эту карту ещё раз или исследуй новую.', wonShort: 'Маршрут на карте.',
      lostLabel: 'ПУТЕШЕСТВИЕ НЕ ЗАКОНЧЕНО', lostTitle: 'Время вышло.',
      lostCopy: 'Вся карта открыта. Посмотри, где находился выход. Можно повторить эту карту с самого начала или выбрать новую.', lostShort: 'Выход теперь виден.',
      retry: 'Повторить карту', newMaze: 'Новый лабиринт', share: 'Поделиться',
      resultAnnouncement: 'Время {time}, шагов {steps}, исследовано {explored}%.',
      comparisonFirst: 'Первая попытка на этой карте.', comparisonNowWon: 'Теперь выход найден!', comparisonPreviouslyWon: 'В прошлой попытке выход был найден.',
      sameRooms: 'Открыто столько же комнат, сколько в прошлый раз.', moreRooms: 'Открыто на {n} {unit} больше.', fewerRooms: 'Открыто на {n} {unit} меньше.',
      fewerSteps: 'На {n} {unit} меньше', moreSteps: 'На {n} {unit} больше', sameSteps: 'Столько же шагов',
      faster: 'на {n} с быстрее', slower: 'на {n} с дольше', sameTime: 'время примерно то же',
      openCode: 'Код карты', codeTitle: 'Открыть карту', codeHelp: 'Введите код друга — расположение стен и двери будет тем же.',
      codeLabel: 'Код карты', codeError: 'Проверьте код: например, L1-00000001.', open: 'Открыть', cancel: 'Отмена',
      shareTitle: 'Поделиться результатом', shareTextLabel: 'Текст для отправки', copy: 'Скопировать', close: 'Закрыть',
      shareLinkNote: 'Можно скопировать текст вместе со ссылкой.', shareLocalNote: 'Локальная версия: делимся кодом карты без пути к файлу.',
      shareLocalHelp: 'Откройте игру и введите этот код через меню → «Код карты».', copied: 'Скопировано. Теперь можно отправить другу.', manualCopy: 'Скопируйте выделенный текст вручную.',
      shareResult: 'Лабиринт: {outcome}. Сложность: {difficulty}. Время {time}, шагов {steps}, исследовано {explored}%. Карта {code}.',
      outcomeWon: 'выход найден', outcomeLost: 'время вышло', noCode: 'без кода',
      sound: 'Звук', music: 'Музыка', effects: 'Эффекты', musicVolume: 'Громкость музыки', effectsVolume: 'Громкость эффектов',
      audioHelp: 'Звук включается с началом игры и останавливается на паузе.', audioUnavailable: 'Звук недоступен в этом браузере. Можно играть без звука.',
      difficulty: 'Сложность', difficultyNormal: 'Обычный', difficultyHard: 'Сложный',
      difficultyHelp: 'Обычный — карта и следы сохраняются. Сложный — виден только участок вокруг человечка.',
      difficultyWarning: 'Смена сложности начнёт эту карту заново: время, шаги и маршрут сбросятся.', restartDifficulty: 'Начать заново',
      tipHard: 'За пределами света комнаты и следы исчезают. Запоминай повороты — дверь видна всегда.',
      pausedCopyHard: 'Игра на паузе. Время остановлено. После продолжения виден только участок вокруг человечка.',
      menu: 'Меню', settings: 'Настройки', language: 'Язык', controls: 'Управление на телефоне', rightHand: 'Для правшей', leftHand: 'Для левшей',
      handNote: 'Стрелки со стороны ведущей руки. Карта не отражается.', prefsSaved: 'Язык, сложность, управление и звук запоминаются на этом устройстве.', prefsSession: 'Выбор действует в этой вкладке.',
      storyLink: 'История лабиринта', storyTitle: 'Вдоль собственных иллюзий', backMenu: 'К меню', backGame: 'К игре',
      storyAlt: 'Путник в тёмном лабиринте. Светящиеся отпечатки ног и тонкие трещины ведут к золотой двери.',
      storyImageError: 'Иллюстрация недоступна. Историю можно прочитать ниже.',
    },
    en: {
      title: 'Labyrinth — find your way', brand: 'LABYRINTH', brandTitle: 'Labyrinth', home: 'Labyrinth — back to start',
      description: 'Explore a hidden maze and find the exit in three minutes. A small adventure for desktop and mobile.',
      edition: 'A small adventure', eyebrow: 'FOLLOW THE LIGHT', heading: 'Find your way.',
      subtitle: 'Something new around every corner. An exit somewhere ahead.', pause: 'Pause',
      game: 'Game', expedition: 'EXPLORING', mapOpen: 'MAP REVEALED',
      board: 'Maze map. Use the arrow keys or onscreen arrows. The mint pedestrian is you, the golden door is the exit, and footprints mark your path.',
      boardHard: 'Hard mode: rooms and footprints are visible only within the current light. The door is always visible.',
      boardFinished: 'The round is over: the entire map is revealed and your route is marked with a line.',
      you: 'You', exit: 'Exit', tracks: 'Footprints', sidebar: 'Stats and controls',
      timeLeft: 'TIME LEFT', timeSpent: 'ROUND TIME', timerLeft: 'Time remaining', timerSpent: 'Time spent',
      timeNote: 'One round. Three minutes. Just you and the unknown.', explored: 'Explored', steps: 'Steps taken',
      chooseDirection: 'CHOOSE A DIRECTION', direction: 'Movement direction',
      up: 'Up', left: 'Left', right: 'Right', down: 'Down', hold: 'Hold to keep walking',
      tip: 'Your footprints stay on the map. Use them to avoid going in circles.', footer: 'Getting lost is part of the adventure.',
      keyboardNote: 'Arrow keys or onscreen arrows', noScript: 'Enable JavaScript in your browser to play.',
      readyLabel: 'A SMALL JOURNEY', readyTitle: 'Find the exit.',
      readyCopy: 'Explore the maze and reach the golden door. The map unfolds as you move. You have 3 minutes.',
      readyShort: 'Find the door in 3 minutes.', start: 'Start exploring', startShort: 'Start',
      pausedLabel: 'TAKE A BREATH', pausedTitle: 'On pause.',
      pausedCopy: 'The game is paused. Time has stopped and your explored map is safe.', pausedShort: 'Time has stopped.', resume: 'Continue',
      wonLabel: 'JOURNEY COMPLETE', wonTitle: 'Exit found!',
      wonCopy: 'The whole map is revealed. Look back at your route, try this maze again, or explore a new one.', wonShort: 'Your route is on the map.',
      lostLabel: 'THE JOURNEY CONTINUES', lostTitle: 'Time is up.',
      lostCopy: 'The whole map is revealed. See where the exit was. Try this maze again from the start, or choose a new one.', lostShort: 'The exit is now visible.',
      retry: 'Retry this maze', newMaze: 'New maze', share: 'Share',
      resultAnnouncement: 'Time {time}, {steps} steps, {explored}% explored.',
      comparisonFirst: 'First attempt at this maze.', comparisonNowWon: 'You found the exit this time!', comparisonPreviouslyWon: 'You found the exit on your previous attempt.',
      sameRooms: 'You explored the same number of rooms as last time.', moreRooms: '{n} more {unit} explored.', fewerRooms: '{n} fewer {unit} explored.',
      fewerSteps: '{n} fewer {unit}', moreSteps: '{n} more {unit}', sameSteps: 'The same number of steps',
      faster: '{n}s faster', slower: '{n}s slower', sameTime: 'about the same time',
      openCode: 'Maze code', codeTitle: 'Open a maze', codeHelp: 'Enter a friend’s code to get the same walls and exit.',
      codeLabel: 'Maze code', codeError: 'Check the code. For example: L1-00000001.', open: 'Open', cancel: 'Cancel',
      shareTitle: 'Share your result', shareTextLabel: 'Text to share', copy: 'Copy', close: 'Close',
      shareLinkNote: 'Copy the result together with its link.', shareLocalNote: 'Local version: share the maze code without a file path.',
      shareLocalHelp: 'Open the game, then enter this code in Menu → Maze code.', copied: 'Copied. You can send it to a friend.', manualCopy: 'Copy the selected text manually.',
      shareResult: 'Labyrinth: {outcome}. Difficulty: {difficulty}. Time {time}, {steps} steps, {explored}% explored. Maze {code}.',
      outcomeWon: 'exit found', outcomeLost: 'time is up', noCode: 'no code',
      sound: 'Sound', music: 'Music', effects: 'Effects', musicVolume: 'Music volume', effectsVolume: 'Effects volume',
      audioHelp: 'Sound starts when you play and stops while paused.', audioUnavailable: 'Audio is unavailable in this browser. You can play without sound.',
      difficulty: 'Difficulty', difficultyNormal: 'Normal', difficultyHard: 'Hard',
      difficultyHelp: 'Normal keeps explored rooms and footprints. Hard shows only the area around you.',
      difficultyWarning: 'Changing difficulty restarts this maze: time, steps and route will reset.', restartDifficulty: 'Start again',
      tipHard: 'Rooms and footprints disappear outside the light. Remember the turns — the door stays visible.',
      pausedCopyHard: 'The game is paused. Time has stopped. Only the area around you will be visible when you resume.',
      menu: 'Menu', settings: 'Settings', language: 'Language', controls: 'Mobile controls', rightHand: 'Right-handed', leftHand: 'Left-handed',
      handNote: 'Arrows on your preferred side. The maze stays the same.', prefsSaved: 'Language, difficulty, controls and sound are remembered on this device.', prefsSession: 'Your choices apply to this tab.',
      storyLink: 'The maze’s story', storyTitle: 'Along your own illusions', backMenu: 'Back to menu', backGame: 'Back to game',
      storyAlt: 'A traveller in a dark labyrinth. Glowing footprints and fine cracks lead towards a golden door.',
      storyImageError: 'The illustration is unavailable. You can still read the story below.',
    }
  };
  const stories = {
    ru: [
      'Лабиринт был не местом, а состоянием — вроде навязчивой мысли, которая крутится в голове и не даёт уснуть.',
      'Твои следы — это не отметины на полу, а отпечатки решений: каждый шаг оставляет в структуре пространства микроскопическую трещину, и именно по ним можно прочесть, где реальность чуть-чуть прогнулась под твою волю.',
      'Узор из следов — это твой личный код доступа: лабиринт признаёт только тех, кто согласен считать себя автором собственного заблуждения.',
      'Выход вспыхивает не там, где ты хочешь оказаться, а там, где наконец понимаешь: ты всё это время шёл не сквозь лабиринт, а вдоль собственных иллюзий.'
    ],
    en: [
      'The labyrinth was not a place, but a state of mind — like a persistent thought that turns over and over in your head and will not let you sleep.',
      'Your footprints are not marks upon the floor, but impressions left by decisions: each step leaves a microscopic crack in the fabric of space, and through those cracks you can read where reality yielded, ever so slightly, to your will.',
      'The pattern of your footprints is your own access code: the labyrinth recognises only those willing to see themselves as the author of their own misdirection.',
      'The exit flares into light not where you want to be, but where you finally understand: all this time, you were walking not through the labyrinth, but along your own illusions.'
    ]
  };
  // Старые настройки получают обычную сложность и звуковые значения по умолчанию.
  // Не принимаем строки, NaN и бесконечность за допустимую громкость.
  const volume = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.max(0, Math.min(100, value))) : fallback;
  const normalizePreferences = value => ({
    language: value?.language === 'en' ? 'en' : 'ru', hand: value?.hand === 'left' ? 'left' : 'right',
    difficulty: value?.difficulty === 'hard' ? 'hard' : 'normal',
    music: value?.music !== false, effects: value?.effects !== false,
    musicVolume: volume(value?.musicVolume, 35), effectsVolume: volume(value?.effectsVolume, 60)
  });
  function t(language, key, values = {}) {
    const text = (messages[language] || messages.ru)[key];
    if (typeof text !== 'string') throw new Error(`Unknown translation key: ${key}`);
    return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
  }
  function plural(language, n, type) {
    if (language === 'en') return type === 'step' ? (n === 1 ? 'step' : 'steps') : (n === 1 ? 'room' : 'rooms');
    const forms = type === 'step' ? ['шаг', 'шага', 'шагов'] : ['комнату', 'комнаты', 'комнат'];
    return forms[n % 100 >= 11 && n % 100 <= 14 ? 2 : n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2];
  }
  function comparison(language, pair) {
    if (!pair) return '';
    const { previous, current } = pair;
    if (!previous) return t(language, 'comparisonFirst');
    if (current.status === 'won' && previous.status !== 'won') return t(language, 'comparisonNowWon');
    if (current.status !== 'won' && previous.status === 'won') return t(language, 'comparisonPreviouslyWon');
    if (current.status !== 'won') {
      const delta = current.seen - previous.seen, n = Math.abs(delta);
      return t(language, delta > 0 ? 'moreRooms' : delta < 0 ? 'fewerRooms' : 'sameRooms', { n, unit: plural(language, n, 'room') });
    }
    const steps = current.steps - previous.steps, seconds = Math.round((current.elapsed - previous.elapsed) / 1000), n = Math.abs(steps);
    return [t(language, steps < 0 ? 'fewerSteps' : steps > 0 ? 'moreSteps' : 'sameSteps', { n, unit: plural(language, n, 'step') }),
      t(language, seconds < 0 ? 'faster' : seconds > 0 ? 'slower' : 'sameTime', { n: Math.abs(seconds) })].join(', ') + '.';
  }
  function shareText(language, game) {
    const seconds = Math.floor(game.elapsed / 1000);
    return t(language, 'shareResult', {
      difficulty: t(language, game.rules.difficulty === 'hard' ? 'difficultyHard' : 'difficultyNormal'),
      outcome: t(language, game.status === 'won' ? 'outcomeWon' : 'outcomeLost'),
      time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, steps: game.steps,
      explored: Math.round(game.seen.size / game.maze.cells.length * 100), code: game.maze.code || t(language, 'noCode')
    });
  }
  const api = { messages, stories, normalizePreferences, t, comparison, shareText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MazeI18n = api;
})(globalThis);
