/**
 * BattleReport — Muharebe sonucu popup'ı.
 * Daktilo efekti yok. Tek seferde render edilir, 4 sn sonra kapanır.
 */

const BUILDING_META = {
    'Saray':         { icon: '🏰', label: 'Saray Saldırısı',     color: '#fbbf24' },
    'Kışla':         { icon: '⚔️', label: 'Kışla Saldırısı',     color: '#ef4444' },
    'Duvar':         { icon: '🛡️', label: 'Duvar Saldırısı',     color: '#60a5fa' },
    'Çiftlik':       { icon: '🌾', label: 'Çiftlik Saldırısı',   color: '#4ade80' },
    'Pazar':         { icon: '🏪', label: 'Pazar Saldırısı',     color: '#fb923c' },
    'Bilim Merkezi': { icon: '⚛️', label: 'Bilim M. Saldırısı', color: '#a78bfa' },
};

export class CombatCalculator {

    async showCombatCalculation(data) {
        const {
            attackerName, attackerColor,
            defenderName, defenderColor,
            attackerBaseCalc, defenderBaseCalc,
            attackRoll, defenseRoll,
            totalAttack, totalDefense,
            result, targetType, skipAnimation
        } = data;

        // Eski modalı temizle
        document.getElementById('battle-report-modal')?.remove();

        const meta = BUILDING_META[targetType] || { icon: '🔥', label: 'Bina Saldırısı', color: '#f59e0b' };

        // Saldırgan satırlarını HTML'e dönüştür
        const atkRows = attackerBaseCalc.map(r => `
            <div class="br-row">
                <span class="br-row-label">${r.text.split(':')[0]}</span>
                <span class="br-row-val" style="color:${r.color}">${(r.text.split(':')[1] || '').trim()}</span>
            </div>`).join('');

        const defRows = defenderBaseCalc.map(r => `
            <div class="br-row">
                <span class="br-row-label">${r.text.split(':')[0]}</span>
                <span class="br-row-val" style="color:${r.color}">${(r.text.split(':')[1] || '').trim()}</span>
            </div>`).join('');

        const resultClass = result.success ? 'br-result-win' : 'br-result-lose';
        const resultIcon  = result.success ? '💥' : '🛡️';

        // Hasar satırı (sadece başarılı saldırıda)
        const damageText = result.success
            ? `<div class="br-damage">${meta.icon} ${meta.label.replace(' Saldırısı','')} — <span style="color:#ef4444">-${totalAttack - totalDefense} HP</span></div>`
            : '';

        const modal = document.createElement('div');
        modal.id = 'battle-report-modal';
        modal.className = 'battle-report-overlay' + (skipAnimation ? ' instant' : '');
        modal.innerHTML = `
            <div class="battle-report">
                <!-- Başlık -->
                <div class="br-header" style="--meta-color:${meta.color}">
                    <span class="br-target-icon">${meta.icon}</span>
                    <span class="br-title">${meta.label.toUpperCase()}</span>
                    <button class="br-close">✕</button>
                </div>

                <!-- İki sütun -->
                <div class="br-split">
                    <!-- Saldırgan -->
                    <div class="br-side" style="--side-color:${attackerColor}">
                        <div class="br-side-name">⚔️ ${attackerName}</div>
                        <div class="br-rows">${atkRows}</div>
                        <div class="br-dice">🎲 <span>${attackRoll}</span></div>
                        <div class="br-total" style="color:${attackerColor}">${totalAttack}</div>
                    </div>

                    <!-- VS -->
                    <div class="br-vs">VS</div>

                    <!-- Savunucu -->
                    <div class="br-side" style="--side-color:${defenderColor}">
                        <div class="br-side-name">🛡️ ${defenderName}</div>
                        <div class="br-rows">${defRows}</div>
                        <div class="br-dice">🎲 <span>${defenseRoll}</span></div>
                        <div class="br-total" style="color:${defenderColor}">${totalDefense}</div>
                    </div>
                </div>

                <!-- Sonuç -->
                <div class="br-result ${resultClass}">
                    <span class="br-result-icon">${resultIcon}</span>
                    <span class="br-result-text">${result.text}</span>
                </div>
                ${damageText}
            </div>
        `;

        document.body.appendChild(modal);

        // Kapat
        const closeHandler = () => { modal.classList.add('br-closing'); setTimeout(() => modal.remove(), 300); };
        modal.querySelector('.br-close').addEventListener('click', closeHandler);
        modal.addEventListener('click', e => { if (e.target === modal) closeHandler(); });

        // Otomatik kapat
        const delay = skipAnimation ? 1800 : 4000;
        return new Promise(resolve => {
            setTimeout(() => { closeHandler(); resolve(); }, delay);
        });
    }
}

export const combatCalculator = new CombatCalculator();
