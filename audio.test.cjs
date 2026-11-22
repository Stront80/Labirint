'use strict';
const assert = require('node:assert/strict');
const { Soundscape } = require('./audio.js');
const preferences = { music: true, effects: true, musicVolume: 35, effectsVolume: 60 };

// Подмена только браузерной среды: проверяем жизненный цикл настоящего
// планировщика, отмену будущих нот и гонку разрешения аудио с паузой.
function environment() {
  const intervals = new Map();
  let counter = 0, created = 0;
  class Context {
    constructor() { created++; this.currentTime = 0; this.state = 'suspended'; this.oscillators = []; }
    addEventListener() {}
    resume() { return new Promise(resolve => { this.resolveResume = () => { this.state = 'running'; resolve(); }; }); }
    createGain() {
      return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }, connect() {}, disconnect() {} };
    }
    createOscillator() {
      const oscillator = { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {}, disconnect() {}, start() {}, stop() { this.stopped = true; } };
      this.oscillators.push(oscillator); return oscillator;
    }
  }
  return { AudioContext: Context, intervals, created: () => created,
    setInterval(callback) { intervals.set(++counter, callback); return counter; },
    clearInterval(id) { intervals.delete(id); } };
}
(async () => {
  const env = environment(), audio = new Soundscape(env);
  audio.configure(preferences);
  assert.equal(env.created(), 0, 'Настройки и загрузка не создают AudioContext');
  audio.unlock(); audio.play(); audio.stop();
  audio.context.resolveResume(); await Promise.resolve();
  assert.equal(env.intervals.size, 0, 'Позднее разрешение аудио не отменяет паузу');
  assert.equal(audio.voices.size, 0);
  audio.unlock(); audio.play(); audio.play();
  assert.equal(env.created(), 1, 'Повтор не создаёт новые контексты');
  assert.equal(env.intervals.size, 1, 'Только один музыкальный планировщик');
  assert(audio.voices.size > 0);
  const before = audio.voices.size;
  audio.effect('wall'); const after = audio.voices.size;
  assert.equal(after, before + 1);
  audio.effect('wall'); assert.equal(audio.voices.size, after, 'Удержание стены ограничено');
  audio.context.currentTime = .5; audio.effect('wall'); assert.equal(audio.voices.size, after + 1);
  audio.effect('step'); audio.effect('warning');
  audio.stop();
  assert.equal(env.intervals.size, 0);
  assert.equal(audio.voices.size, 0, 'Пауза отменяет и текущие, и будущие ноты');
  assert(audio.context.oscillators.every(oscillator => oscillator.stopped));
  audio.effect('won'); assert.equal(audio.voices.size, 5);
  audio.stop(); audio.effect('lost'); assert.equal(audio.voices.size, 3);
  audio.stop(); audio.configure({ ...preferences, music: false, effects: false }); audio.play();
  audio.effect('won'); audio.effect('step');
  assert.equal(audio.voices.size, 0); assert.equal(env.intervals.size, 0);
  audio.stop();
  const rhythmEnvironment = environment(), rhythm = new Soundscape(rhythmEnvironment);
  rhythm.configure(preferences); rhythm.unlock();
  rhythm.context.resolveResume(); await Promise.resolve();
  const scheduled = [], musicStep = rhythm.musicStep.bind(rhythm);
  rhythm.musicStep = (step, when) => { scheduled.push({ step, when }); musicStep(step, when); };
  rhythm.play();
  for (let tick = 1; tick <= 160; tick++) {
    rhythm.context.currentTime = tick / 10;
    for (const schedule of rhythmEnvironment.intervals.values()) schedule();
  }
  const phrase = scheduled.filter(({ when }) => when < 16.04 - .00001);
  assert.equal(phrase.length, 128, 'За 16 секунд — 128 шестнадцатых, то есть 120 BPM');
  assert(phrase.every(({ when }, i) => i === 0 || Math.abs(when - phrase[i - 1].when - .125) < .00001), 'Ритм ровный независимо от таймеров');
  const beforeStall = scheduled.length;
  rhythm.context.currentTime = 80;
  for (const schedule of rhythmEnvironment.intervals.values()) schedule();
  assert(scheduled.length - beforeStall <= 3, 'После задержки нет залпа пропущенных нот');
  assert(scheduled.slice(beforeStall).every(({ when }) => when >= 80 && when < 80.3));
  rhythm.stop(); assert.equal(rhythm.voices.size, 0); assert.equal(rhythmEnvironment.intervals.size, 0);
  const unavailable = new Soundscape({}); unavailable.configure(preferences); unavailable.unlock(); unavailable.play(); unavailable.effect('won'); unavailable.stop();
  assert.equal(unavailable.available, false);
  const failed = new Soundscape({ AudioContext: class { constructor() { throw new Error('denied'); } } });
  failed.unlock(); assert.equal(failed.available, false);
  const rejectedEnvironment = environment();
  rejectedEnvironment.AudioContext.prototype.resume = () => Promise.reject(new Error('denied'));
  const rejected = new Soundscape(rejectedEnvironment); rejected.configure(preferences); rejected.unlock(); rejected.play();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(rejected.available, false); assert.equal(rejectedEnvironment.intervals.size, 0);
  console.log('Успешно: аудио — пауза, гонка resume, повтор, тишина, ограничение стены и отказ API.');
})().catch(error => { console.error(error); process.exitCode = 1; });
