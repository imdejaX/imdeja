/**
 * SoundManager — Ortaçağ temalı ses efektleri.
 * Web Audio API ile sıfırdan sentezlenmiş sesler.
 */
export class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.volume = 0.35;
        this._initCtx();
    }

    _initCtx() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.enabled = false;
        }
    }

    resumeContext() {
        if (this.audioContext?.state === 'suspended') this.audioContext.resume();
    }

    toggle() { this.enabled = !this.enabled; return this.enabled; }
    isEnabled() { return this.enabled; }
    setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); }

    // ── Temel ses katmanı ─────────────────────────────────────────────────────

    _tone(freq, dur, type = 'sine', vol = 1.0, delay = 0, attack = 0.01, release = null) {
        if (!this.enabled || !this.audioContext) return;
        this.resumeContext();
        const ctx = this.audioContext;
        const now = ctx.currentTime + delay;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);

        const v = this.volume * vol;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(v, now + attack);
        const rel = release ?? dur * 0.6;
        gain.gain.setValueAtTime(v, now + dur - rel);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        osc.start(now);
        osc.stop(now + dur + 0.05);
    }

    _noise(dur, vol = 0.5, delay = 0, highpass = 200) {
        if (!this.enabled || !this.audioContext) return;
        this.resumeContext();
        const ctx = this.audioContext;
        const now = ctx.currentTime + delay;
        const bufLen = Math.ceil(ctx.sampleRate * dur);
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

        const src = ctx.createBufferSource();
        src.buffer = buf;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = highpass;

        const gain = ctx.createGain();
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        const v = this.volume * vol;
        gain.gain.setValueAtTime(v, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        src.start(now);
        src.stop(now + dur + 0.05);
    }

    // ── Oyun Sesleri ──────────────────────────────────────────────────────────

    /** Hafif tıklama — tahta üzerine parmak */
    playClick() {
        this._noise(0.04, 0.25, 0, 2000);
        this._tone(320, 0.06, 'triangle', 0.2);
    }

    /** Kart seçimi — parşömen hışırtısı */
    playCardSelect() {
        this._noise(0.08, 0.18, 0, 1000);
        this._tone(520, 0.09, 'sine', 0.18, 0.03);
    }

    /** Kart oynama / inşaat tamamlandı */
    playCardPlay() {
        this._tone(330, 0.12, 'triangle', 0.35);
        this._tone(495, 0.12, 'triangle', 0.28, 0.06);
        this._tone(660, 0.18, 'triangle', 0.22, 0.12);
    }

    /** Bina yerleştirme — taş yerleşme sesi */
    playBuildingPlace() {
        this._noise(0.12, 0.4, 0, 100);
        this._tone(200, 0.15, 'sawtooth', 0.22, 0.04);
        this._tone(150, 0.18, 'triangle', 0.18, 0.10);
    }

    /** Bina yıkımı — çöküş */
    playDemolish() {
        this._noise(0.35, 0.55, 0, 80);
        this._tone(120, 0.3, 'sawtooth', 0.4, 0);
        this._tone(90, 0.35, 'sawtooth', 0.3, 0.1);
        this._tone(60, 0.4, 'square', 0.25, 0.2);
    }

    /** Pazar tazelen — jeton ve metal sesi */
    playMarketRefresh() {
        [880, 1100, 1320, 1760].forEach((f, i) => {
            this._tone(f, 0.09, 'triangle', 0.22, i * 0.055);
        });
    }

    /** Altın kazanma — sikke şıkırtısı */
    playGold() {
        [1200, 1500, 1800].forEach((f, i) => {
            this._tone(f, 0.07, 'triangle', 0.28, i * 0.045);
        });
        this._noise(0.06, 0.12, 0, 3000);
    }

    /** Tur sonu — yavaş davul */
    playTurnEnd() {
        this._noise(0.25, 0.5, 0, 50);
        this._tone(110, 0.3, 'sawtooth', 0.4, 0);
        this._tone(90, 0.35, 'sawtooth', 0.3, 0.15);
    }

    /** Tur başlangıcı — boru fanfar */
    playTurnStart() {
        this._tone(440, 0.12, 'sawtooth', 0.3, 0);
        this._tone(550, 0.12, 'sawtooth', 0.28, 0.1);
        this._tone(660, 0.2, 'sawtooth', 0.32, 0.2);
        this._tone(880, 0.3, 'sawtooth', 0.28, 0.35);
    }

    /** Saldırı başlatma — savaş borusu */
    playAttack() {
        this._tone(220, 0.1, 'sawtooth', 0.45, 0);
        this._tone(165, 0.15, 'square', 0.4, 0.08);
        this._noise(0.2, 0.45, 0.05, 200);
    }

    /** Zafer — kısa fanfar */
    playVictory() {
        [523, 659, 784, 1047].forEach((f, i) => {
            this._tone(f, 0.22, 'sawtooth', 0.3, i * 0.13);
        });
        this._tone(784, 0.4, 'triangle', 0.2, 0.55);
    }

    /** Yenilgi — alçalan boru */
    playDefeat() {
        [440, 370, 310, 245].forEach((f, i) => {
            this._tone(f, 0.18, 'sawtooth', 0.28, i * 0.11);
        });
    }

    /** Zar atma — tahta üzerinde yuvarlanma */
    playDiceRoll() {
        for (let i = 0; i < 9; i++) {
            const f = 150 + Math.random() * 300;
            this._noise(0.04, 0.22, i * 0.06, f);
        }
    }

    /** İttifak kuruldu — uyumlu akor */
    playAlliance() {
        [440, 554, 659, 880].forEach((f, i) => {
            this._tone(f, 0.5, 'sine', 0.22, i * 0.04);
        });
    }

    /** Diplomasi kartı — gizemli tını */
    playDiplomacy() {
        this._tone(370, 0.25, 'triangle', 0.28, 0);
        this._tone(466, 0.25, 'triangle', 0.22, 0.08);
        this._tone(554, 0.3, 'sine', 0.18, 0.18);
    }

    /** Asker toplandı — marş davulu */
    playSoldierRecruit() {
        this._noise(0.08, 0.35, 0, 300);
        this._noise(0.08, 0.35, 0.15, 300);
        this._tone(220, 0.08, 'square', 0.2, 0.3);
    }

    /** Bina yıkıldı (düşman saldırısıyla) */
    playBuildingDestroyed() {
        this._noise(0.5, 0.6, 0, 60);
        this._tone(100, 0.4, 'sawtooth', 0.45, 0);
        this._tone(75, 0.5, 'square', 0.35, 0.15);
        this._tone(50, 0.6, 'sawtooth', 0.3, 0.3);
    }

    /** Modal açma — parşömen açılışı */
    playModalOpen() {
        this._noise(0.06, 0.15, 0, 1500);
        this._tone(660, 0.07, 'sine', 0.15, 0.04);
    }

    /** Modal kapama */
    playModalClose() {
        this._tone(550, 0.06, 'sine', 0.15);
        this._noise(0.05, 0.1, 0.03, 1500);
    }

    /** Hata */
    playError() {
        this._tone(180, 0.15, 'sawtooth', 0.4);
        this._tone(160, 0.2, 'square', 0.35, 0.1);
    }

    /** Başarı */
    playSuccess() {
        this._tone(660, 0.1, 'triangle', 0.35);
        this._tone(880, 0.18, 'triangle', 0.3, 0.08);
    }
}

export const soundManager = new SoundManager();
