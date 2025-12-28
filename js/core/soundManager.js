/**
 * Sound Effects Manager
 * Handles all game audio including UI sounds and game events
 */

export class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.volume = 0.3; // Master volume (0.0 to 1.0)
        this.initAudioContext();
    }

    /**
     * Initialize Web Audio API context
     */
    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported', e);
            this.enabled = false;
        }
    }

    /**
     * Resume audio context (needed for autoplay policies)
     */
    resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    /**
     * Play a simple beep sound
     * @param {number} frequency - Frequency in Hz
     * @param {number} duration - Duration in seconds
     * @param {string} type - Oscillator type ('sine', 'square', 'sawtooth', 'triangle')
     */
    playTone(frequency, duration, type = 'sine', volume = 1.0) {
        if (!this.enabled || !this.audioContext) return;

        this.resumeContext();

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        const actualVolume = this.volume * volume;
        gainNode.gain.setValueAtTime(actualVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    /**
     * Play button click sound
     */
    playClick() {
        this.playTone(800, 0.05, 'square', 0.3);
    }

    /**
     * Play card selection sound
     */
    playCardSelect() {
        this.playTone(600, 0.08, 'sine', 0.4);
        setTimeout(() => this.playTone(900, 0.08, 'sine', 0.3), 50);
    }

    /**
     * Play card purchase/play sound
     */
    playCardPlay() {
        this.playTone(500, 0.1, 'triangle', 0.5);
        setTimeout(() => this.playTone(700, 0.1, 'triangle', 0.4), 80);
        setTimeout(() => this.playTone(900, 0.15, 'triangle', 0.3), 150);
    }

    /**
     * Play market refresh sound
     */
    playMarketRefresh() {
        const notes = [440, 554, 659, 880];
        notes.forEach((freq, index) => {
            setTimeout(() => this.playTone(freq, 0.1, 'sine', 0.3), index * 50);
        });
    }

    /**
     * Play turn end sound
     */
    playTurnEnd() {
        this.playTone(400, 0.15, 'sawtooth', 0.4);
        setTimeout(() => this.playTone(300, 0.2, 'sawtooth', 0.5), 150);
    }

    /**
     * Play turn start notification
     */
    playTurnStart() {
        this.playTone(600, 0.1, 'sine', 0.5);
        setTimeout(() => this.playTone(800, 0.15, 'sine', 0.6), 100);
    }

    /**
     * Play attack/combat sound
     */
    playAttack() {
        // Aggressive sound
        this.playTone(200, 0.15, 'sawtooth', 0.6);
        setTimeout(() => this.playTone(150, 0.1, 'square', 0.5), 80);
    }

    /**
     * Play victory sound (successful attack)
     */
    playVictory() {
        const melody = [523, 659, 784, 1047]; // C, E, G, C (octave higher)
        melody.forEach((freq, index) => {
            setTimeout(() => this.playTone(freq, 0.2, 'triangle', 0.4), index * 150);
        });
    }

    /**
     * Play defeat sound (failed attack/defense)
     */
    playDefeat() {
        const melody = [400, 350, 300, 250];
        melody.forEach((freq, index) => {
            setTimeout(() => this.playTone(freq, 0.15, 'sawtooth', 0.3), index * 100);
        });
    }

    /**
     * Play dice roll sound
     */
    playDiceRoll() {
        // Rapid random tones to simulate dice rolling
        for (let i = 0; i < 8; i++) {
            const randomFreq = 200 + Math.random() * 400;
            setTimeout(() => this.playTone(randomFreq, 0.05, 'square', 0.2), i * 50);
        }
    }

    /**
     * Play building placement sound
     */
    playBuildingPlace() {
        this.playTone(300, 0.1, 'triangle', 0.4);
        setTimeout(() => this.playTone(400, 0.15, 'sine', 0.5), 100);
    }

    /**
     * Play demolish sound
     */
    playDemolish() {
        this.playTone(250, 0.2, 'sawtooth', 0.5);
        setTimeout(() => this.playTone(200, 0.15, 'square', 0.4), 150);
    }

    /**
     * Play alliance formed sound
     */
    playAlliance() {
        const harmony = [440, 554, 659]; // A major chord
        harmony.forEach((freq, index) => {
            setTimeout(() => this.playTone(freq, 0.3, 'sine', 0.3), index * 30);
        });
    }

    /**
     * Play modal open sound
     */
    playModalOpen() {
        this.playTone(600, 0.08, 'sine', 0.3);
    }

    /**
     * Play modal close sound
     */
    playModalClose() {
        this.playTone(500, 0.08, 'sine', 0.3);
    }

    /**
     * Play error/invalid action sound
     */
    playError() {
        this.playTone(200, 0.2, 'sawtooth', 0.4);
    }

    /**
     * Play success sound (generic positive feedback)
     */
    playSuccess() {
        this.playTone(700, 0.1, 'sine', 0.4);
        setTimeout(() => this.playTone(900, 0.15, 'sine', 0.5), 100);
    }

    /**
     * Play coin/gold sound
     */
    playGold() {
        this.playTone(800, 0.05, 'triangle', 0.3);
        setTimeout(() => this.playTone(1000, 0.05, 'triangle', 0.3), 50);
        setTimeout(() => this.playTone(1200, 0.1, 'triangle', 0.3), 100);
    }

    /**
     * Toggle sound on/off
     */
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    /**
     * Set master volume
     * @param {number} vol - Volume from 0.0 to 1.0
     */
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    }

    /**
     * Get current enabled state
     */
    isEnabled() {
        return this.enabled;
    }
}

// Create and export a singleton instance
export const soundManager = new SoundManager();
