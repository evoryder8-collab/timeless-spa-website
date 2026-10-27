// Every sound on the site is synthesised live with the Web Audio API, so there are no audio files
// and each sound can follow the motion that triggers it. Nothing plays until the visitor chooses sound.

const KEY = 'ts-sound';
const rand = (a: number, b: number) => a + Math.random() * (b - a);

class SoundEngine {
  ctx: AudioContext | null = null;
  enabled = false;
  private master!: GainNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private noise!: AudioBuffer;
  private ambient: { stop: () => void } | null = null;
  private dripTimer = 0;
  /** the page is hidden (phone locked, app switched): sound faded out and the engine suspended */
  private asleep = false;
  private listeners = new Set<(on: boolean) => void>();
  private lastHover = 0;

  /** what the visitor chose earlier this session */
  get wanted() {
    try { return sessionStorage.getItem(KEY) === 'on'; } catch { return false; }
  }

  onChange(fn: (on: boolean) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setup() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    // a small warm room: generated impulse response, darker towards the tail
    const len = ctx.sampleRate * 3.2;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        lp += (Math.random() * 2 - 1 - lp) * (0.5 - 0.4 * t);
        d[i] = lp * Math.pow(1 - t, 3.2);
      }
    }
    const verb = ctx.createConvolver();
    verb.buffer = ir;
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.55;
    this.dry.connect(this.master);
    this.wet.connect(verb).connect(this.master);

    // two seconds of brown noise, reused by every noisy sound
    const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = n.getChannelData(0);
    let last = 0;
    for (let i = 0; i < nd.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      nd[i] = last * 3.5;
    }
    this.noise = n;

    // Phones cut audio abruptly when they lock or switch apps, which pops. Fade out first and
    // suspend while hidden; fade back in on return.
    const hide = () => this.sleep();
    const show = () => this.wake();
    document.addEventListener('visibilitychange', () => (document.hidden ? hide() : show()));
    addEventListener('pagehide', hide);
    addEventListener('pageshow', show);
    document.addEventListener('freeze', hide);
    document.addEventListener('resume', show);
    // Safari reports 'interrupted' (lock, call, Siri): make sure the return starts from silence
    ctx.addEventListener('statechange', () => {
      if (ctx.state !== 'running') {
        this.master.gain.cancelScheduledValues(0);
        this.master.gain.value = 0;
      }
    });
  }

  private sleep() {
    if (!this.ctx || this.asleep) return;
    this.asleep = true;
    const ctx = this.ctx;
    const g = this.master.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + 0.12);
    setTimeout(() => {
      if (this.asleep) ctx.suspend().catch(() => {});
    }, 160);
  }

  private wake() {
    if (!this.ctx || !this.asleep) return;
    this.asleep = false;
    if (!this.enabled) return;
    const ctx = this.ctx;
    const g = this.master.gain;
    g.cancelScheduledValues(0);
    g.value = 0;
    ctx
      .resume()
      .then(() => {
        const t = ctx.currentTime;
        g.cancelScheduledValues(t);
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(0.8, t + 1.8);
      })
      .catch(() => {});
    // iOS may refuse to resume without a fresh touch: then the next tap brings the sound back
    setTimeout(() => {
      if (ctx.state === 'running' || !this.enabled) return;
      const again = () => {
        removeEventListener('pointerdown', again, true);
        removeEventListener('keydown', again, true);
        this.asleep = true;
        this.wake();
      };
      addEventListener('pointerdown', again, true);
      addEventListener('keydown', again, true);
    }, 500);
  }

  /** route a node to the dry and reverb buses */
  private out(node: AudioNode, wet = 0.5) {
    const d = this.ctx!.createGain();
    d.gain.value = 1 - wet * 0.5;
    const w = this.ctx!.createGain();
    w.gain.value = wet;
    node.connect(d).connect(this.dry);
    node.connect(w).connect(this.wet);
  }

  async enable() {
    this.setup();
    const ctx = this.ctx!;
    if (ctx.state !== 'running') await ctx.resume().catch(() => {});
    this.enabled = true;
    this.asleep = false;
    try { sessionStorage.setItem(KEY, 'on'); } catch {}
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(0.8, ctx.currentTime, 0.4);
    this.startAmbient();
    this.listeners.forEach((fn) => fn(true));
  }

  disable() {
    this.enabled = false;
    try { sessionStorage.setItem(KEY, 'off'); } catch {}
    if (this.ctx) {
      const ctx = this.ctx;
      this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      setTimeout(() => {
        if (!this.enabled) { this.ambient?.stop(); this.ambient = null; ctx.suspend().catch(() => {}); }
      }, 1400);
    }
    this.listeners.forEach((fn) => fn(false));
  }

  toggle() {
    return this.enabled ? this.disable() : this.enable();
  }

  // ───────────────────────── ambient bed ─────────────────────────
  private startAmbient() {
    if (this.ambient || !this.ctx) return;
    const ctx = this.ctx;
    const bed = ctx.createGain();
    bed.gain.value = 0;
    bed.gain.setTargetAtTime(1, ctx.currentTime, 2.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.Q.value = 0.3;
    bed.connect(lp);
    this.out(lp, 0.6);

    // a soft, slowly breathing chord (A, E, A, C#) on sine waves
    const nodes: AudioScheduledSourceNode[] = [];
    [110, 164.81, 220.5, 277.18].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = rand(-6, 6);
      const g = ctx.createGain();
      g.gain.value = [0.05, 0.022, 0.016, 0.009][i];
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rand(0.04, 0.11);
      const lg = ctx.createGain();
      lg.gain.value = g.gain.value * 0.7;
      lfo.connect(lg).connect(g.gain);
      o.connect(g).connect(bed);
      o.start();
      lfo.start();
      nodes.push(o, lfo);
    });

    // distant water: band-passed noise that swells like small waves
    const water = ctx.createBufferSource();
    water.buffer = this.noise;
    water.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 0.6;
    const wg = ctx.createGain();
    wg.gain.value = 0.05;
    const wl = ctx.createOscillator();
    wl.frequency.value = 0.13;
    const wlg = ctx.createGain();
    wlg.gain.value = 0.03;
    wl.connect(wlg).connect(wg.gain);
    water.connect(bp).connect(wg).connect(bed);
    water.start();
    wl.start();
    nodes.push(water, wl);

    // and now and then a far-off drop
    const tick = () => {
      if (this.enabled) this.drip(rand(0.12, 0.3));
      this.dripTimer = window.setTimeout(tick, rand(3500, 8000));
    };
    this.dripTimer = window.setTimeout(tick, 2500);

    this.ambient = {
      stop: () => {
        clearTimeout(this.dripTimer);
        bed.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch {} }), 1500);
      },
    };
  }

  private ready() {
    return this.enabled && !this.asleep && this.ctx && this.ctx.state === 'running';
  }

  // ───────────────────────── one-shots ─────────────────────────

  /** a water drop: a sine "plink" whose pitch rises as the bubble closes */
  drip(strength = 1) {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const f = rand(700, 1300);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * rand(1.9, 2.6), t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * strength, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.12, 0.2));
    o.connect(g);
    this.out(g, 0.75);
    o.start(t);
    o.stop(t + 0.3);
  }

  /** a singing bowl: inharmonic partials with long, slightly beating decays */
  bowl(strength = 1) {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const base = [196, 220, 246.94, 293.66][Math.floor(Math.random() * 4)];
    const partials: [number, number, number][] = [
      [1, 1, 5.5],
      [2.71, 0.45, 3.8],
      [5.15, 0.2, 2.4],
      [8.3, 0.08, 1.4],
    ];
    const sum = ctx.createGain();
    sum.gain.value = 0.11 * strength;
    for (const [ratio, amp, decay] of partials) {
      for (const beat of [-0.7, 0.7]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = base * ratio + beat;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(amp, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
        o.connect(g).connect(sum);
        o.start(t);
        o.stop(t + decay + 0.1);
      }
    }
    // the mallet touching the rim
    const m = ctx.createBufferSource();
    m.buffer = this.noise;
    const mf = ctx.createBiquadFilter();
    mf.type = 'bandpass';
    mf.frequency.value = 1800;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(0.25, t);
    mg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    m.connect(mf).connect(mg).connect(sum);
    m.start(t, rand(0, 1.5), 0.08);
    this.out(sum, 0.7);
  }

  /** a soft wooden click for navigation */
  click() {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(rand(1500, 1800), t);
    o.frequency.exponentialRampToValueAtTime(700, t + 0.03);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g);
    this.out(g, 0.25);
    o.start(t);
    o.stop(t + 0.08);
  }

  /** an even softer tick on hover, rate-limited */
  hover() {
    const now = performance.now();
    if (now - this.lastHover < 90 || !this.ready()) return;
    this.lastHover = now;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = rand(2200, 2600);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.018, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g);
    this.out(g, 0.4);
    o.start(t);
    o.stop(t + 0.07);
  }

  /** the breath of air when the page changes */
  whoosh() {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(260, t);
    f.frequency.exponentialRampToValueAtTime(1500, t + 0.45);
    f.frequency.exponentialRampToValueAtTime(380, t + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
    s.connect(f).connect(g);
    this.out(g, 0.5);
    s.start(t, rand(0, 0.8), 1.2);
  }

  /** a stone settling on stone: a low, dull "tok" */
  stone(strength = 1) {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const sum = ctx.createGain();
    sum.gain.value = 0.22 * strength;
    for (const [f, d] of [[150, 0.22], [410, 0.12], [930, 0.05]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * 1.06, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(f === 150 ? 1 : 0.45, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(sum);
      o.start(t);
      o.stop(t + d + 0.05);
    }
    this.out(sum, 0.35);
  }

  /** warmth rising: a low swell with a little air on top */
  warm() {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 82.4;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    o.connect(g);
    s.connect(f).connect(g);
    this.out(g, 0.6);
    o.start(t);
    o.stop(t + 1.4);
    s.start(t, rand(0, 0.6), 1.4);
  }
}

export const sound = new SoundEngine();
