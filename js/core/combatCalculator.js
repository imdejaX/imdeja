/**
 * Combat Calculator Display
 * Shows detailed power calculation with typewriter effect
 */

export class CombatCalculator {
    constructor() {
        this.typewriterSpeed = 40; // ms per character
        this.lineDelay = 300; // ms between lines
    }

    /**
     * Show detailed combat calculation with typewriter effect
     * @param {Object} combatData - Combat data with all calculation details
     */
    async showCombatCalculation(combatData) {
        // Create or get modal element
        let modal = document.getElementById('combat-calc-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'combat-calc-modal';
            modal.className = 'combat-calc-modal';
            document.body.appendChild(modal);
        }

        // Build combat data
        const {
            attackerName,
            attackerColor,
            defenderName,
            defenderColor,
            attackerBaseCalc,
            defenderBaseCalc,
            attackRoll,
            defenseRoll,
            totalAttack,
            totalDefense,
            result
        } = combatData;

        // Create content container
        modal.innerHTML = `
            <div id="combat-content-container" class="combat-calc-content" style="
                background: linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(30, 30, 45, 0.98) 100%);
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-radius: 16px;
                padding: 30px;
                max-width: 600px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9), 0 0 100px rgba(255, 255, 255, 0.1);
                color: white;
                font-family: 'Courier New', monospace;
                font-size: 0.95rem;
                line-height: 1.8;
                position: relative;
            ">
                <button id="combat-skip-btn" style="
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    background: rgba(59, 130, 246, 0.4);
                    border: 1px solid #3b82f6;
                    color: white;
                    padding: 4px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.75rem;
                    font-weight: normal;
                    transition: all 0.2s;
                    font-family: 'Inter', sans-serif;
                    z-index: 10;
                ">
                    ⏩ Sonucu Göster
                </button>
                
                <div class="combat-header" style="
                    text-align: center;
                    font-size: 1.4rem;
                    font-weight: bold;
                    margin-bottom: 20px;
                    color: #fbbf24;
                    text-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
                    font-family: 'Cinzel', serif;
                ">
                    ⚔️ GÜÇ HESAPLAMA ⚔️
                </div>
                
                <div id="combat-calc-lines"></div>
            </div>
        `;

        const linesContainer = document.getElementById('combat-calc-lines');
        const skipBtn = document.getElementById('combat-skip-btn');
        const contentContainer = document.getElementById('combat-content-container');

        // Show modal
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);

        // Play calculation sound
        if (window.soundManager) {
            window.soundManager.playClick();
        }

        // Define calculation lines
        // Show calculation lines
        const lines = [
            { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━`, color: '#4b5563', bold: false },
            { text: `SALDIRGAN: ${attackerName}`, color: attackerColor, bold: true },
            { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━`, color: '#4b5563', bold: false },
            ...attackerBaseCalc.map(calc => ({ text: calc.text, color: calc.color || '#a8dadc', bold: false })),
            { text: `🎲 Zar: ${attackRoll}`, color: '#fbbf24', bold: false },
            { text: ``, color: 'white', bold: false },
            { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━`, color: '#4b5563', bold: false },
            { text: `SAVUNUCU: ${defenderName}`, color: defenderColor, bold: true },
            { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━`, color: '#4b5563', bold: false },
            ...defenderBaseCalc.map(calc => ({ text: calc.text, color: calc.color || '#a8dadc', bold: false })),
            { text: `🎲 Zar: ${defenseRoll}`, color: '#fbbf24', bold: false },
        ];

        // 1. Show setup and base calculations first
        for (let i = 0; i < lines.length; i++) {
            if (combatData.skipAnimation) {
                await this.typewriteLine(linesContainer, lines[i], true);
            } else {
                await this.typewriteLine(linesContainer, lines[i]);
                await this.delay(25); // Faster line delay for setup
            }
        }

        // 2. Insert Animation Container
        const animContainer = document.createElement('div');
        animContainer.className = 'combat-anim-container';
        animContainer.innerHTML = `
            <div class="anim-emoji anim-sword-left">🗡️</div>
            <div class="anim-emoji anim-sword-right">🗡️</div>
            <div class="anim-emoji anim-shield">🛡️</div>
            <div class="anim-damage-text">-${combatData.result.success ? (totalAttack - totalDefense) : 0}</div>
        `;
        // Insert before text lines or overlay? Overlay is better.
        // The modal content has relative positioning.
        contentContainer.appendChild(animContainer);

        if (!combatData.skipAnimation) {
            // 3. Animation Sequence
            await this.delay(200);

            // Phase 1: Prepare (Swords appear)
            animContainer.classList.add('anim-prepare');
            if (window.soundManager) window.soundManager.playTone(600, 0.1, 'triangle');
            await this.delay(600);

            // Phase 2: Clash
            animContainer.classList.add('anim-clash');
            if (window.soundManager) window.soundManager.playTone(100, 0.1, 'sawtooth', 0.5); // Impact sound
            await this.delay(300);

            // Phase 3: Result
            if (result.success) {
                animContainer.classList.add('anim-result-success');
                if (window.soundManager) window.soundManager.playVictory();
            } else {
                animContainer.classList.add('anim-result-fail');
                if (window.soundManager) window.soundManager.playDefeat();
            }
            await this.delay(800);
        }

        // 3. Show Final Totals and Result Text (After animation)
        const finalLines = [
            { text: ``, color: 'white', bold: false },
            { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━`, color: '#4b5563', bold: false },
            { text: `TOPLAM SALDIRI: ${totalAttack}`, color: attackerColor, bold: true, size: '1.1rem' },
            { text: `TOPLAM SAVUNMA: ${totalDefense}`, color: defenderColor, bold: true, size: '1.1rem' },
            { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━`, color: '#4b5563', bold: false },
            { text: ``, color: 'white', bold: false },
            {
                text: result.text,
                color: result.color,
                bold: true,
                size: '1.3rem',
                glow: true
            }
        ];

        for (let i = 0; i < finalLines.length; i++) {
            if (combatData.skipAnimation) {
                await this.typewriteLine(linesContainer, finalLines[i], true);
            } else {
                await this.typewriteLine(linesContainer, finalLines[i]);
                await this.delay(this.lineDelay);
            }
        }

        // Hide skip button after completion
        skipBtn.style.display = 'none';

        // Auto-close after showing result
        await this.delay(combatData.skipAnimation ? 1000 : 3000);
        modal.classList.remove('show');
        await this.delay(300);
        modal.style.display = 'none';
        modal.innerHTML = ''; // Clean up for next time
    }

    /**
     * Typewriter effect for a single line
     */
    async typewriteLine(container, lineData, instant = false) {
        const lineDiv = document.createElement('div');
        lineDiv.style.cssText = `
            color: ${lineData.color};
            font-weight: ${lineData.bold ? 'bold' : 'normal'};
            font-size: ${lineData.size || '0.95rem'};
            margin: 4px 0;
            ${lineData.glow ? `text-shadow: 0 0 20px ${lineData.color};` : ''}
        `;
        container.appendChild(lineDiv);

        // Empty line
        if (!lineData.text) {
            return;
        }

        // Instant mode or typewriter effect
        if (instant) {
            lineDiv.textContent = lineData.text;
        } else {
            // Typewriter effect
            let currentText = '';
            for (const char of lineData.text) {
                currentText += char;
                lineDiv.textContent = currentText;

                // Light tick sound for non-empty chars
                if (char !== ' ' && window.soundManager && Math.random() > 0.7) {
                    window.soundManager.playTone(1200, 0.01, 'sine', 0.05);
                }

                await this.delay(this.typewriterSpeed);
            }
        }
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton instance
export const combatCalculator = new CombatCalculator();
