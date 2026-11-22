/* Оригинальные звуки синтезируются локально: сеть, записи и библиотеки не нужны. */
(() => {
  'use strict';
  // 120 четвертей в минуту; внутри доли — четыре коротких ноты.
  // Это новая оригинальная партия, референс не встраивается в игру.
  const MUSIC = Object.freeze({ bpm: 120, stepsPerBeat: 4, stepsPerBar: 16 });
  const roots = [50, 46, 43, 45]; // Dm — Bb — Gm — A: доминанта возвращает напряжение.
  const arpeggio = [0, 7, 12, 3, 7, 12, 7, 15, 0, 7, 12, 3, 14, 7, 13, 7];
  const frequencyOf = note => 440 * 2 ** ((note - 69) / 12);
  class Soundscape {
    constructor(environment = globalThis, onAvailability = () => {}) {
      this.env = environment;
      this.onAvailability = onAvailability;
      this.context = null;
      this.available = Boolean(environment.AudioContext || environment.webkitAudioContext);
      this.preferences = {};
      this.active = false;
      this.timer = null;
      this.voices = new Set();
      this.beat = 0;
      this.nextBeat = 0;
      this.lastWall = -Infinity;
      this.step = 0;
      this.generation = 0;
    }
    configure(preferences) {
      this.preferences = preferences;
      if (!this.context) return;
      // Меню ставит игру на паузу. Здесь также поддержано изменение громкости
      // во время игры: плавное изменение усиления не создаёт щелчков.
      const now = this.context.currentTime;
      this.music.gain.setTargetAtTime(preferences.music ? preferences.musicVolume / 100 : 0, now, .025);
      this.effects.gain.setTargetAtTime(preferences.effects ? preferences.effectsVolume / 100 : 0, now, .025);
      if (!preferences.music) this.stopVoices('music');
      if (!preferences.effects) this.stopVoices('effects');
    }
    fail() {
      this.available = false;
      this.stop();
      this.onAvailability(false);
    }
    unlock() {
      // Вызывается только из жеста пользователя. Создание контекста при
      // загрузке запрещено политикой autoplay в части мобильных браузеров.
      if (!this.available) return;
      try {
        if (!this.context) {
          const Context = this.env.AudioContext || this.env.webkitAudioContext;
          this.context = new Context();
          this.music = this.context.createGain();
          this.effects = this.context.createGain();
          this.music.connect(this.context.destination);
          this.effects.connect(this.context.destination);
          this.configure(this.preferences);
          this.context.addEventListener('statechange', () => {
            if (this.context.state !== 'running') this.stop();
          });
        }
        // Пока resume ожидает разрешения браузера, пауза может отменить старт.
        // Номер поколения не позволяет позднему Promise вернуть музыку.
        const generation = this.generation;
        if (this.context.state !== 'running') {
          Promise.resolve(this.context.resume()).then(() => {
            if (this.active && generation === this.generation) this.startMusic();
          }).catch(() => this.fail());
        }
      } catch { this.fail(); }
    }
    tone(channel, frequency, when, duration, volume, type = 'sine', endFrequency = frequency, attack = .035) {
      if (!this.available || !this.context || this.context.state !== 'running') return;
      if (!this.preferences[channel === 'music' ? 'music' : 'effects']) return;
      const oscillator = this.context.createOscillator(), envelope = this.context.createGain();
      const start = Math.max(this.context.currentTime, when);
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(volume, start + Math.min(attack, duration / 4));
      envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(envelope); envelope.connect(this[channel]);
      const voice = { oscillator, envelope, channel };
      this.voices.add(voice);
      oscillator.onended = () => {
        oscillator.disconnect(); envelope.disconnect(); this.voices.delete(voice);
      };
      oscillator.start(start); oscillator.stop(start + duration + .01);
    }
    stopVoices(channel) {
      for (const voice of [...this.voices]) {
        if (channel && voice.channel !== channel) continue;
        // Отключаем сразу даже ноты, запланированные в будущем. Повторный
        // stop допустим, но закрытый браузером контекст может его отклонить.
        voice.envelope.disconnect();
        try { voice.oscillator.stop(); } catch { /* Уже остановлен. */ }
        voice.oscillator.disconnect(); this.voices.delete(voice);
      }
    }
    stop() {
      this.active = false; this.generation++;
      if (this.timer !== null) this.env.clearInterval(this.timer);
      this.timer = null; this.stopVoices();
    }
    play() {
      this.active = true;
      this.startMusic();
    }
    startMusic() {
      if (!this.active || !this.available || !this.preferences.music || !this.context || this.context.state !== 'running' || this.timer !== null) return;
      this.beat = 0; this.nextBeat = this.context.currentTime + .04;
      const schedule = () => {
        if (!this.active || this.context.state !== 'running') return;
        // Короткий горизонт не даёт проиграть накопленные ноты после сна.
        if (this.nextBeat < this.context.currentTime) this.nextBeat = this.context.currentTime + .04;
        while (this.nextBeat < this.context.currentTime + .3) {
          this.musicStep(this.beat, this.nextBeat);
          this.beat++; this.nextBeat += 60 / MUSIC.bpm / MUSIC.stepsPerBeat;
        }
      };
      schedule(); this.timer = this.env.setInterval(schedule, 100);
    }
    musicStep(step, when) {
      const bar = Math.floor(step / MUSIC.stepsPerBar), position = step % MUSIC.stepsPerBar;
      const chord = bar % roots.length, root = roots[chord], third = chord % 2 ? 4 : 3;
      // Шестнадцатые создают движение. Полутоновые подходы и мажорная
      // доминанта добавляют тревожность при умеренном усилении каналов.
      let offset = arpeggio[position];
      if (offset === 3) offset = third;
      if (offset === 15) offset = 12 + third;
      const frequency = frequencyOf(root + offset);
      const accent = position % 4 === 0 ? 1 : .72;
      this.tone('music', frequency, when, .115, .075 * accent, 'triangle', frequency, .006);
      this.tone('music', frequency * 2, when + .012, .09, .012 * accent, 'sine', frequency * 2, .004);
      if (position % 2 === 0) {
        const bass = frequencyOf(root - 12 + (position % 4 === 2 ? 7 : 0));
        this.tone('music', bass, when, .19, .115, 'triangle', bass, .008);
      }
      // Ударные принадлежат музыкальному каналу: выключение эффектов
      // оставляет всю композицию, а выключение музыки убирает и её ритм.
      if (position % 4 === 0) this.tone('music', 125, when, .15, .12, 'sine', 44, .004);
      if (position % 4 === 2) {
        this.tone('music', 2100, when, .028, .016, 'triangle', 1500, .002);
        this.tone('music', 3200, when, .022, .009, 'sine', 2600, .002);
      }
      if (position === 4 || position === 12) this.tone('music', 190, when, .085, .055, 'triangle', 85, .003);
      if (position === 0) {
        // Короткая гармоническая подложка и верхний мотив во втором
        // четырёхтакте делают 16-секундную фразу менее однообразной.
        for (const interval of [12, 12 + third, 19]) {
          const pad = frequencyOf(root + interval);
          this.tone('music', pad, when, 1.8, .019);
        }
      }
      if (bar % 8 >= 4 && position % 4 === 0) {
        const note = frequencyOf(root + [24, 19, 24 + third, 25][position / 4]);
        this.tone('music', note, when, .32, .035);
      }
    }
    effect(name) {
      if (!this.available || !this.context || this.context.state !== 'running' || !this.preferences.effects) return;
      const now = this.context.currentTime;
      if (name === 'wall') {
        if (!this.active || now - this.lastWall < .4) return;
        this.lastWall = now;
        this.tone('effects', 110, now, .11, .18, 'triangle', 48);
      } else if (name === 'step' && this.active) {
        this.tone('effects', this.step++ % 2 ? 160 : 185, now, .065, .075, 'triangle', 65);
      } else if (name === 'warning' && this.active) {
        [440, 523.25].forEach((frequency, i) => this.tone('effects', frequency, now + i * .2, .35, .13));
      } else if (name === 'won') {
        this.tone('effects', 90, now, .5, .11, 'triangle', 240);
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => this.tone('effects', frequency, now + .15 + i * .18, .8, .16));
      } else if (name === 'lost') {
        [293.66, 261.63, 220].forEach((frequency, i) => this.tone('effects', frequency, now + i * .28, .8, .14));
      }
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { Soundscape, MUSIC };
  else globalThis.MazeAudio = { Soundscape, MUSIC };
})();
