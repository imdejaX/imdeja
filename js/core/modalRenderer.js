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
        if (!this.game.pendingAttack) return;

        const overlay   = document.getElementById('dice-overlay');
        const label     = document.getElementById('dice-overlay-label');
        const nameAtk   = document.getElementById('dice-attacker-name');
        const nameDef   = document.getElementById('dice-defender-name');
        const faceAtk   = document.getElementById('dice-face-attacker');
        const faceDef   = document.getElementById('dice-face-defender');
        if (!overlay) return;

        const attacker = this.game.players.find(p => p.id === this.game.pendingAttack.attackerId);
        const defender = this.game.players.find(p => p.id === this.game.pendingAttack.targetPlayerId);

        if (label)   label.textContent   = `${attacker?.name || '?'} ⚔️ ${defender?.name || '?'}`;
        if (nameAtk) nameAtk.textContent = attacker?.name || '?';
        if (nameDef) nameDef.textContent = defender?.name || '?';
        if (faceAtk) { faceAtk.textContent = '🎲'; faceAtk.classList.add('rolling'); }
        if (faceDef) { faceDef.textContent = '🎲'; faceDef.classList.add('rolling'); }

        // İptal butonu ekle (ilk açılışta)
        let cancelBtn = overlay.querySelector('.dice-cancel-btn');
        if (!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.className = 'dice-cancel-btn';
            cancelBtn.textContent = '❌ Vazgeç';
            overlay.querySelector('.dice-overlay-content')?.appendChild(cancelBtn);
            cancelBtn.addEventListener('click', () => {
                this.game.pendingAttack = null;
                this.game.clearActionMode();
                overlay.classList.remove('active');
                this._lockInput(false);
                this.render();
            });
        }
        cancelBtn.style.display = 'block';

        overlay.classList.add('active');
        // Harita ve panelleri tıklamaya kapat
        this._lockInput(true);
        if (window.soundManager) window.soundManager.playDiceRoll();

        // Zarları 700ms sonra göster
        const diceRoll = this.game.prepareAttackDice();
        setTimeout(() => {
            if (faceAtk) { faceAtk.classList.remove('rolling'); faceAtk.textContent = diceRoll?.attacker ?? '?'; }
            if (faceDef) { faceDef.classList.remove('rolling'); faceDef.textContent = diceRoll?.defender ?? '?'; }
        }, 700);

        // 2 saniye sonra sonucu uygula
        setTimeout(async () => {
            cancelBtn.style.display = 'none';
            overlay.classList.remove('active');
            try {
                const result = await this.game.rollDiceForAttack();
                if (!result?.success) console.error('Attack result:', result?.msg);
            } catch (err) {
                console.error('Dice error:', err);
                this.game.clearActionMode();
                this.game.pendingAttack = null;
            }
            this._lockInput(false);
            this.render();
            if (window.mapRenderer) window.mapRenderer.render();
        }, 2200);
    },

    showDiceRoll(diceData) {
        // showDicePrompt ile birleştirildi — bu metod artık kullanılmıyor
        // Yine de geriye dönük uyumluluk için bırakıldı
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
        this.showVassalLandModal(vassalId, false);
    },

    showVassalLandModal(vassalId, interactive = true) {
        const vassal = this.game.players.find(p => p.id === vassalId);
        if (!vassal) return;
        const master = this.game.getActivePlayer();
        const isMaster = vassal.masterId === master.id;

        const hasBuildingSelected = interactive && isMaster &&
            master.hand[this.game.selectedCardIndex]?.type === 'Bina';
        const isDemolishMode = interactive && isMaster && this.game.actionMode === 'demolish';

        let hint = '';
        if (interactive && isMaster) {
            if (hasBuildingSelected) hint = '🏗️ Boş slota tıklayarak bina inşa edebilirsin.';
            else if (isDemolishMode) hint = '🔨 Binaya tıklayarak yıkabilirsin (sadece kendi binaların).';
            else hint = '📐 El kartlarından bina seç veya Yık modunu aktif et.';
        }

        let modal = document.getElementById('vassal-grid-modal');
        if (modal) modal.remove();
        modal = document.createElement('div');
        modal.id = 'vassal-grid-modal';
        modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;justify-content:center;align-items:center;z-index:10000;backdrop-filter:blur(5px);`;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        const gridHtml = vassal.grid.map((cell, idx) => {
            const isSaray = cell?.type === 'Saray';
            const isOwned = cell?.ownerId === master.id;
            const isEmpty = !cell && idx > 0;
            const canBuild = hasBuildingSelected && isEmpty;
            const canDemolish = isDemolishMode && cell && !isSaray && isOwned;

            let borderColor = '#374151';
            if (isSaray) borderColor = '#fbbf24';
            else if (isOwned) borderColor = master.color;
            else if (cell) borderColor = '#6b7280';
            if (canBuild) borderColor = '#22c55e';
            if (canDemolish) borderColor = '#ef4444';

            return `
                <div class="vl-cell ${canBuild ? 'vl-can-build' : ''} ${canDemolish ? 'vl-can-demolish' : ''}"
                     data-idx="${idx}"
                     style="background:${cell ? (isOwned ? `${master.color}22` : 'rgba(59,130,246,0.1)') : 'rgba(0,0,0,0.3)'};
                            border:2px solid ${borderColor};border-radius:8px;padding:10px;text-align:center;
                            min-height:72px;display:flex;flex-direction:column;justify-content:center;align-items:center;
                            cursor:${canBuild || canDemolish ? 'pointer' : 'default'};
                            ${isSaray ? 'box-shadow:0 0 15px rgba(251,191,36,0.3);' : ''}
                            ${isOwned ? `box-shadow:0 0 8px ${master.color}55;` : ''}">
                    ${cell ? `
                        <div style="font-size:1.4rem">${this.getBuildingIcon(cell.type)}</div>
                        <div style="font-size:0.7rem;font-weight:600;color:#e5e7eb;margin:2px 0">${cell.type}</div>
                        <div style="font-size:0.65rem;color:#9ca3af;display:flex;gap:4px;justify-content:center">
                            <span>❤️${cell.hp||'-'}</span>
                            ${cell.power ? `<span>🛡️${cell.power}</span>` : ''}
                            ${cell.garrison && (cell.type==='Kışla'||cell.type==='Saray') ? `<span>👥${cell.garrison.length}</span>` : ''}
                        </div>
                        ${isOwned ? `<div style="font-size:0.6rem;color:${master.color};margin-top:2px">👑 ${master.name}</div>` : ''}
                        ${canDemolish ? `<div style="font-size:0.65rem;color:#ef4444;margin-top:2px">🔨 Yık</div>` : ''}
                    ` : `
                        <div style="font-size:1.2rem;color:${canBuild ? '#22c55e' : '#4b5563'}">${canBuild ? '＋' : '□'}</div>
                        <div style="font-size:0.6rem;color:${canBuild ? '#22c55e' : '#6b7280'}">${canBuild ? 'İnşa Et' : 'Boş'}</div>
                    `}
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:24px;border-radius:16px;max-width:560px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,0.5);border:2px solid ${vassal.color};">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h2 style="margin:0;color:${vassal.color};font-size:1.3rem;text-shadow:0 0 10px ${vassal.color};">⛓️ ${vassal.name}</h2>
                    <button id="close-vassal-modal" style="background:#dc2626;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:600;">✕</button>
                </div>
                <div style="display:flex;gap:16px;font-size:0.85rem;margin-bottom:14px;padding:10px;background:rgba(0,0,0,0.3);border-radius:8px;">
                    <span style="color:#fbbf24">💰 ${vassal.gold}</span>
                    <span style="color:#a78bfa">🎯 ${vassal.dp} DP</span>
                    <span style="color:${master.color}">👑 Efendi: ${master.name}</span>
                </div>
                ${hint ? `<div style="padding:8px 12px;background:rgba(212,175,55,0.15);border:1px solid #d4af3760;border-radius:6px;color:#d4af37;font-size:0.8rem;margin-bottom:12px;">${hint}</div>` : ''}
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">${gridHtml}</div>
            </div>
        `;

        modal.style.display = 'flex';
        document.getElementById('close-vassal-modal').addEventListener('click', () => modal.remove());

        if (interactive && isMaster) {
            modal.querySelectorAll('.vl-cell').forEach(cell => {
                const idx = parseInt(cell.dataset.idx);
                cell.addEventListener('click', () => {
                    if (cell.classList.contains('vl-can-build')) {
                        const result = this.game.buildOnVassalLand(vassalId, idx);
                        if (result.success === false) alert(result.msg);
                        else { modal.remove(); this.render(); }
                    } else if (cell.classList.contains('vl-can-demolish')) {
                        const result = this.game.demolishOnVassalLand(vassalId, idx);
                        if (result.success === false) alert(result.msg);
                        else { modal.remove(); this.render(); }
                    }
                });
            });
        }
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

    _lockInput(lock) {
        // SVG harita
        const svg = document.getElementById('game-map');
        if (svg) svg.style.pointerEvents = lock ? 'none' : '';

        // Oyuncu panelleri
        ['players-left', 'players-right'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.pointerEvents = lock ? 'none' : '';
        });

        // Eylem butonları
        ['end-turn-btn', 'market-btn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = lock;
        });
    },

    showDiplomacyEffect({ card, playerName, playerColor, targetName, targetColor }) {
        const DIPLO_META = {
            'steal_card':      { icon: '🕵️', label: 'Casusluk',       color: '#60a5fa', desc: (t) => `${t}'den kart çalındı` },
            'steal_unit':      { icon: '📢', label: 'Propaganda',     color: '#a855f7', desc: (t) => `${t}'den asker devşirildi` },
            'military_boost':  { icon: '⚔️', label: 'Askeri Gösteri', color: '#ef4444', desc: () => 'Sonraki saldırıya +3 güç bonusu' },
            'gold_boost':      { icon: '💰', label: 'Altın Hamlesi',  color: '#fbbf24', desc: () => '+3 Altın kazanıldı' },
            'white_flag':      { icon: '🏳️', label: 'Beyaz Bayrak',   color: '#e2e8f0', desc: () => '1 tur saldırı koruması' },
            'repair_building': { icon: '🔨', label: 'Mimari Onarım',  color: '#4ade80', desc: () => 'Hasarlı bina onarıldı' },
            'break_alliance':  { icon: '🌪️', label: 'Nifak Tohumu',   color: '#f97316', desc: (t) => `${t}'in ittifakı bozuldu` },
            'terror_joker':    { icon: '💣', label: 'Terör Jokeri',   color: '#dc2626', desc: (t) => `${t}'in bir binası yıkıldı` },
            'assassination':   { icon: '🗡️', label: 'Suikast',        color: '#7c3aed', desc: (t) => `${t}'e suikast girişimi` },
        };

        const meta = DIPLO_META[card.effect] || { icon: '🎭', label: card.name, color: '#a78bfa', desc: () => 'Etki uygulandı' };

        document.getElementById('diplo-effect-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'diplo-effect-modal';
        modal.className = 'diplo-overlay';
        modal.innerHTML = `
            <div class="diplo-modal" style="--diplo-color:${meta.color}">
                <div class="diplo-icon">${meta.icon}</div>
                <div class="diplo-card-name">${meta.label}</div>
                <div class="diplo-players">
                    <span style="color:${playerColor};font-weight:700">${playerName}</span>
                    ${targetName ? `<span class="diplo-arrow">→</span><span style="color:${targetColor};font-weight:700">${targetName}</span>` : ''}
                </div>
                <div class="diplo-desc">${meta.desc(targetName || '')}</div>
                ${card.dp > 0 ? `<div class="diplo-dp-badge">+${card.dp} DP</div>` : ''}
            </div>
        `;

        document.body.appendChild(modal);
        modal.addEventListener('click', () => modal.remove());
        setTimeout(() => { modal.classList.add('diplo-closing'); setTimeout(() => modal.remove(), 300); }, 3500);
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
