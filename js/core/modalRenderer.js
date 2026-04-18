/**
 * ModalRendererMixin — Zar, bildirim, vasal ve joker modalleri.
 * Renderer.prototype'a Object.assign ile uygulanır.
 */
export const ModalRendererMixin = {

    showSubtitle(text) {
        if (!this.containers.subtitle) return;
        this.containers.subtitle.textContent = text;
        this.containers.subtitle.style.opacity = '1';
        if (this.subtitleTimeout) {
            clearTimeout(this.subtitleTimeout);
            this.subtitleTimeout = null;
        }
    },

    showDicePrompt() {
        let prompt = document.getElementById('dice-roll-prompt');
        if (!prompt) {
            prompt = document.createElement('div');
            prompt.id = 'dice-roll-prompt';
            prompt.className = 'dice-prompt';
            prompt.innerHTML = `
                <div class="dice-prompt-content">
                    <h2>🎲 Zar At</h2>
                    <p>Saldırı için zar atmaya hazır mısın?</p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button id="roll-dice-btn" class="btn btn-primary">🎲 Zar At!</button>
                        <button id="cancel-dice-btn" class="btn btn-secondary" style="background: #6b7280; color: white;">❌ Vazgeç</button>
                    </div>
                </div>
            `;
            document.body.appendChild(prompt);

            document.getElementById('roll-dice-btn').addEventListener('click', async () => {
                try {
                    window.soundManager.playDiceRoll();

                    const diceRoll = this.game.prepareAttackDice();
                    if (!diceRoll) {
                        alert("Bekleyen saldırı verisi bulunamadı!");
                        this.game.clearActionMode();
                        this.render();
                        return;
                    }

                    prompt.style.display = 'none';
                    this.showDiceRoll(diceRoll);
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    const result = await this.game.rollDiceForAttack();
                    if (result.success) {
                        this.render();
                    } else {
                        console.error("Attack failed logic:", result.msg);
                        this.game.clearActionMode();
                        this.render();
                    }
                } catch (err) {
                    console.error("Dice Roll Error:", err);
                    alert("Saldırı sırasında hata oluştu: " + err.message);
                    this.game.clearActionMode();
                    this.game.pendingAttack = null;
                    this.render();
                }
            });

            document.getElementById('cancel-dice-btn').addEventListener('click', () => {
                this.game.pendingAttack = null;
                this.game.clearActionMode();
                prompt.style.display = 'none';
                this.render();
            });
        }

        prompt.style.display = 'flex';
    },

    showDiceRoll(diceData) {
        const backdrop = document.getElementById('dice-backdrop');
        const container = document.getElementById('dice-container');
        const label = document.getElementById('dice-label');
        const attackerDice = document.getElementById('dice-attacker');
        const defenderDice = document.getElementById('dice-defender');

        backdrop.classList.add('active');
        container.classList.add('active');
        label.textContent = `${diceData.attackerName} vs ${diceData.defenderName}`;

        attackerDice.textContent = '?';
        defenderDice.textContent = '?';

        setTimeout(() => {
            attackerDice.textContent = diceData.attacker;
            defenderDice.textContent = diceData.defender;
        }, 300);

        setTimeout(() => {
            backdrop.classList.remove('active');
            container.classList.remove('active');
        }, 2000);
    },

    showAttackNotification(attackInfoArray) {
        let notification = document.getElementById('attack-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'attack-notification';
            notification.className = 'attack-notification';
            document.body.appendChild(notification);
        }

        let attackText = '';
        let attackerColor = '#dc2626';
        let defenderColor = '#991b1b';

        if (Array.isArray(attackInfoArray)) {
            if (attackInfoArray.length > 0) {
                const firstAttack = attackInfoArray[0];
                if (typeof firstAttack === 'object') {
                    attackText = attackInfoArray.map(a => a.text).join(', ');
                    attackerColor = firstAttack.attackerColor;
                    defenderColor = firstAttack.defenderColor;
                } else {
                    attackText = attackInfoArray.join(', ');
                }
            }
        } else if (typeof attackInfoArray === 'object') {
            attackText = attackInfoArray.text;
            attackerColor = attackInfoArray.attackerColor;
            defenderColor = attackInfoArray.defenderColor;
        } else {
            attackText = attackInfoArray;
        }

        const gradient = `linear-gradient(90deg, ${attackerColor} 0%, ${attackerColor} 20%,
                         color-mix(in srgb, ${attackerColor} 50%, ${defenderColor} 50%) 50%,
                         ${defenderColor} 80%, ${defenderColor} 100%)`;

        notification.innerHTML = `
            <div class="attack-notification-content" style="background: ${gradient};">
                <div class="attack-icon">⚔️</div>
                <div class="attack-message"><strong>${attackText}</strong> saldırısı!</div>
            </div>
        `;

        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 5000);
    },

    showVassalGridModal(vassalId) {
        const vassal = this.game.players.find(p => p.id === vassalId);
        if (!vassal) return;

        let modal = document.getElementById('vassal-grid-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'vassal-grid-modal';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.85); display: flex;
                justify-content: center; align-items: center;
                z-index: 10000; backdrop-filter: blur(5px);
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        }

        modal.innerHTML = `
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 16px; max-width: 600px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.5); border: 2px solid ${vassal.color};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: ${vassal.color}; font-size: 1.5rem; text-shadow: 0 0 10px ${vassal.color};">
                        ⛓️ ${vassal.name} Krallığı
                    </h2>
                    <button id="close-vassal-modal" style="background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 1rem;">✕</button>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="display: flex; gap: 20px; justify-content: space-around; font-size: 0.9rem;">
                        <span style="color: #fbbf24;">💰 Altın: ${vassal.gold}</span>
                        <span style="color: #60a5fa;">👥 Nüfus: ${vassal.pop}</span>
                        <span style="color: #a78bfa;">🎯 DP: ${vassal.dp}</span>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px;">
                    ${vassal.grid.map((cell) => `
                        <div style="
                            background: ${cell ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.3)'};
                            border: 2px solid ${cell ? (cell.type === 'Saray' ? '#fbbf24' : '#3b82f6') : '#374151'};
                            border-radius: 8px; padding: 12px; text-align: center;
                            min-height: 80px; display: flex; flex-direction: column;
                            justify-content: center; align-items: center;
                            ${cell?.type === 'Saray' ? 'box-shadow: 0 0 20px rgba(251, 191, 36, 0.4);' : ''}
                        ">
                            ${cell ? `
                                <div style="font-size: 1.5rem; margin-bottom: 4px;">${this.getBuildingIcon(cell.type)}</div>
                                <div style="font-size: 0.75rem; font-weight: 600; color: #e5e7eb; margin-bottom: 4px;">${cell.type}</div>
                                <div style="font-size: 0.7rem; color: #9ca3af; display: flex; gap: 6px; justify-content: center;">
                                    <span>❤️${cell.hp || '-'}</span>
                                    ${cell.power ? `<span>🛡️${cell.power}</span>` : ''}
                                    ${cell.garrison && (cell.type === 'Kışla' || cell.type === 'Saray') ? `<span>👥${cell.garrison.length}</span>` : ''}
                                </div>
                            ` : `
                                <div style="font-size: 1.5rem; color: #4b5563;">□</div>
                                <div style="font-size: 0.65rem; color: #6b7280;">Boş</div>
                            `}
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 20px; padding: 12px; background: rgba(220, 38, 38, 0.2); border: 1px solid #dc2626; border-radius: 6px; text-align: center; color: #fca5a5; font-size: 0.85rem;">
                    ℹ️ Bu krallık senin vasalın. Geliri otomatik olarak sana aktarılıyor.
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        const closeBtn = document.getElementById('close-vassal-modal');
        if (closeBtn) closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    },

    showJokerModal(handIndex, availableTechs) {
        let modal = document.getElementById('joker-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'joker-modal';
            modal.className = 'joker-modal';
            document.body.appendChild(modal);
        }

        const optionsHtml = availableTechs.map(tech => {
            let icon = '';
            let className = '';
            if (tech.type === 'military') { icon = '⚔️'; className = 'military'; }
            else if (tech.type === 'defense') { icon = '🛡️'; className = 'defense'; }
            else if (tech.type === 'commerce') { icon = '💰'; className = 'commerce'; }

            return `
                <div class="joker-card ${className}" data-type="${tech.type}">
                    <div class="joker-icon">${icon}</div>
                    <div class="joker-name">${tech.name.split(' (')[0]}</div>
                    <div class="joker-level">Lv${tech.currentLevel} <span class="joker-arrow">➔</span> Lv${tech.currentLevel + 1}</div>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="joker-content">
                <div class="joker-title">🃏 JOKER TEKNOLOJİSİ</div>
                <div class="joker-subtitle">Hangi teknolojiyi bir üst seviyeye taşımak istersin?</div>
                <div class="joker-options">${optionsHtml}</div>
            </div>
        `;

        modal.querySelectorAll('.joker-card').forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.type;
                const result = this.game.playTechnologyCard(handIndex, type);
                if (result.success === false) alert(result.msg);

                modal.classList.remove('show');
                setTimeout(() => { modal.style.display = 'none'; }, 300);
                this.render();
            });
        });

        modal.style.display = 'flex';
        void modal.offsetWidth;
        modal.classList.add('show');
    },

    showGameOver(winner) {
        let overlay = document.getElementById('game-over-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'game-over-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85); display: flex; flex-direction: column;
                justify-content: center; align-items: center; z-index: 99999;
                backdrop-filter: blur(8px);
            `;
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 4rem; margin-bottom: 16px;">🏆</div>
                <h1 style="color: ${winner.color}; font-size: 2.5rem; text-shadow: 0 0 30px ${winner.color}; margin-bottom: 8px;">
                    ${winner.name}
                </h1>
                <div style="color: #fcd34d; font-size: 1.5rem; margin-bottom: 32px;">MUTLAK HAKİM!</div>
                <button onclick="location.reload()" style="
                    background: ${winner.color}; color: white; border: none;
                    padding: 14px 32px; font-size: 1.1rem; border-radius: 8px;
                    cursor: pointer; font-weight: 700; font-family: Cinzel, serif;
                ">🔄 Yeni Oyun</button>
            </div>
        `;

        overlay.style.display = 'flex';
    }
};
