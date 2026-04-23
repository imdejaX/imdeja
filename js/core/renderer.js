import { ModalRendererMixin } from './modalRenderer.js';

export class Renderer {
    constructor(game) {
        this.game = game;

        // Yeni harita-merkezli HTML yapısı desteği
        const panelLeft = document.getElementById('players-left');
        const panelRight = document.getElementById('players-right');

        this.containers = {
            // Sol/sağ panel yoksa eski #players-container'a geri dön
            playersLeft: panelLeft,
            playersRight: panelRight,
            players: panelLeft || document.getElementById('players-container'),
            market: document.getElementById('market-cards'),
            hand: document.getElementById('hand-cards'),
            logs: document.getElementById('log-content'),
            subtitle: document.getElementById('subtitle'),
        };

        // hand container artık market modal içinde — DOM'da var, oluşturmaya gerek yok

        if (!this.containers.logs) {
            const logDiv = document.createElement('div');
            logDiv.id = 'log-content';
            logDiv.className = 'log-zone';
            document.body.appendChild(logDiv);
            this.containers.logs = logDiv;
        }

        if (!this.containers.subtitle) {
            const subDiv = document.createElement('div');
            subDiv.id = 'subtitle';
            document.body.appendChild(subDiv);
            this.containers.subtitle = subDiv;
        }
    }

    getBuildingIcon(type) {
        const icons = {
            'Saray': '🏰', 'Çiftlik': '🌾', 'Kışla': '⚔️', 'Duvar': '🛡️',
            'Pazar': '🏪', 'Bilim Merkezi': '⚛️', 'Piyade': '🗡️', 'Okçu': '🏹', 'Süvari': '🐎'
        };
        return icons[type] || type.substring(0, 2);
    }

    render() {
        this.renderHeader();
        this.renderPlayers();
        this.renderMarket();
        this.renderHand();
        this.renderLogs();
        this.updateScreenBorder();
    }

    updateScreenBorder() {
        const activePlayer = this.game.getActivePlayer();
        document.body.style.boxShadow = `inset 0 0 0 8px ${activePlayer.color}, inset 0 0 40px 8px ${activePlayer.color}80`;
        document.body.style.animation = 'borderPulse 2s ease-in-out infinite';
    }

    renderHeader() {
        const activePlayer = this.game.getActivePlayer();
        const totalGoldEarned = this.game.getTotalGold();
        const goldCapPerPlayer = this.game.getGoldCap();
        const totalGoldCap = goldCapPerPlayer * this.game.players.length;

        // Yeni harita-merkezli layout: bireysel span'lar
        const turnNum = document.getElementById('turn-number');
        if (turnNum) turnNum.textContent = this.game.turn;

        const badge = document.getElementById('active-player-badge');
        if (badge) {
            badge.textContent = activePlayer.isBot ? `🤖 ${activePlayer.name}` : `👑 ${activePlayer.name}`;
            badge.style.color = activePlayer.color;
            badge.style.borderColor = activePlayer.color + '60';
        }

        // Eski layout uyumu: tüm turn-indicator'ı doldur
        const turnDiv = document.getElementById('turn-indicator');
        if (turnDiv && !turnNum) {
            turnDiv.innerHTML = `
                <span style="color: var(--gold); font-weight: 600;">TUR ${this.game.turn}</span>
                <span style="color: #64748b; margin: 0 8px;">•</span>
                <span style="color: #e2e8f0;">${activePlayer.name}</span>
            `;
        }

        const goldDisplay = document.getElementById('gold-display');
        if (goldDisplay) {
            const goldAmount = document.getElementById('gold-amount');
            const capColor = totalGoldEarned >= totalGoldCap ? '#ef4444' : '#d4af37';
            if (goldAmount) {
                goldAmount.textContent = `${totalGoldEarned}`;
                goldAmount.style.color = '#d4af37';
            } else {
                goldDisplay.innerHTML = `<span style="color:${capColor};">💰 ${totalGoldEarned}/${totalGoldCap}</span>`;
            }
        }

        const endTurnBtn = document.getElementById('end-turn-btn');
        if (this.game.phase === 'SONUÇ') {
            if (endTurnBtn) {
                endTurnBtn.textContent = 'YENİ OYUN';
                endTurnBtn.disabled = false;
                endTurnBtn.onclick = () => location.reload();
            }
        } else {
            if (endTurnBtn) {
                endTurnBtn.innerHTML = '⏩';
                endTurnBtn.title = 'Turu Bitir';
                endTurnBtn.disabled = activePlayer.isBot;
                endTurnBtn.onclick = () => {
                    this.game.endTurn();
                    this.render();
                };
            }
        }
    }

    renderLogs() {
        const logsByTurn = {};
        this.game.logs.forEach(log => {
            const turn = log.turn || 1;
            if (!logsByTurn[turn]) logsByTurn[turn] = [];
            logsByTurn[turn].push(log);
        });

        const turns = Object.keys(logsByTurn).sort((a, b) => b - a);
        let html = '';
        turns.forEach(turn => {
            html += `
                <div class="log-turn-group">
                    <div class="log-turn-header">📅 TUR ${turn}</div>
                    ${logsByTurn[turn].map(log => {
                        const message = log.message || log;
                        const className = log.isTip ? 'log-entry log-tip' : 'log-entry';
                        return `<div class="${className}">${message}</div>`;
                    }).join('')}
                </div>
            `;
        });

        this.containers.logs.innerHTML = html;
        this.containers.logs.scrollTop = 0;
    }

    renderPlayers() {
        const activePlayer = this.game.getActivePlayer();
        const players = this.game.players;

        // Yeni harita-merkezli layout: 1.sol 2.sağ 3.sol 4.sağ ... (zigzag)
        if (this.containers.playersLeft && this.containers.playersRight) {
            this.containers.playersLeft.innerHTML = '';
            this.containers.playersRight.innerHTML = '';
            players.forEach((p, i) => {
                const isActive = p.id === activePlayer.id;
                const div = this._buildPlayerCard(p, isActive);
                if (i % 2 === 0) {
                    this.containers.playersLeft.appendChild(div);
                } else {
                    this.containers.playersRight.appendChild(div);
                }
                this._bindPlayerCardEvents(div, p, activePlayer);
            });
            // Aktif oyuncu badge'ini güncelle
            const badge = document.getElementById('active-player-badge');
            if (badge) {
                badge.textContent = activePlayer.isBot ? `🤖 ${activePlayer.name}` : `👑 ${activePlayer.name}`;
                badge.style.color = activePlayer.color;
                badge.style.borderColor = activePlayer.color + '60';
            }
            return;
        }

        // Eski tek-panel fallback
        this.containers.players.innerHTML = '';
        const sortedPlayers = [
            activePlayer,
            ...players.filter(p => p.id !== activePlayer.id)
        ];

        sortedPlayers.forEach(p => {
            const isActive = p.id === activePlayer.id;
            const div = document.createElement('div');
            div.className = `player-zone ${isActive ? 'active-turn' : ''}`;

            const playerNameDisplay = p.isBot ? `🤖 ${p.name}` : p.name;

            div.innerHTML = `
                <div class="player-header">
                    <span>
                        <span class="player-color-badge" style="background: ${p.color}; box-shadow: 0 0 10px ${p.color};"></span>
                        ${playerNameDisplay} ${isActive ? '👑' : ''} ${p.isVassal ? '⛓️' : ''}
                    </span>
                    <span style="display: flex; gap: 8px; align-items: center;">
                        <span>DP: ${p.dp}</span>
                        <span style="font-size: 0.75rem; color: #fbbf24;">
                            ⚔️${p.technologies.military}
                            🛡️${p.technologies.defense}
                            📈${p.technologies.commerce}
                        </span>
                    </span>
                </div>

                ${p.allianceWith ? `<div class="alliance-badge">🤝 İttifak: ${this.game.players.find(pl => pl.id === p.allianceWith)?.name}</div>` : ''}
                ${p.isVassal ? `
                    <div class="vassal-badge" style="background: rgba(220, 38, 38, 0.2); border: 2px solid #dc2626; color: #fca5a5; padding: 6px 10px; border-radius: 6px; font-weight: 700; margin-top: 6px; text-align: center; box-shadow: 0 0 15px rgba(220, 38, 38, 0.4);">
                        ⛓️ ${this.game.players.find(pl => pl.id === p.masterId)?.name} Hükümranlığı Altında
                    </div>
                ` : ''}
                ${(() => {
                    const vassals = this.game.players.filter(v => v.isVassal && v.masterId === activePlayer.id);
                    if (vassals.length > 0 && isActive) {
                        return `
                            <div style="margin-top: 8px; display: flex; gap: 4px; flex-wrap: wrap;">
                                ${vassals.map(v => `
                                    <button class="btn-view-vassal" data-vassal-id="${v.id}" style="flex: 1; font-size: 0.7rem; padding: 6px 8px; background: rgba(220, 38, 38, 0.3); border: 1px solid #dc2626; color: #fca5a5; cursor: pointer; border-radius: 4px; font-weight: 600;">
                                        👁️ ${v.name} Krallığı
                                    </button>
                                `).join('')}
                            </div>
                        `;
                    }
                    return '';
                })()}
                ${p.whiteFlagTurns > 0 ? `<div class="white-flag-badge" style="background: rgba(255,255,255,0.15); border: 2px solid #f0f0f0; color: #ffffff; padding: 6px 10px; border-radius: 6px; font-weight: 700; margin-top: 6px; text-align: center;">🏳️ Barış Koruması (${p.whiteFlagTurns} Tur)</div>` : ''}
                ${p.militaryBoost && p.militaryBoost > 0 ? `<div class="military-boost-badge">⚔️ Askeri Bonus: +${p.militaryBoost}</div>` : ''}

                <div class="kingdom-grid ${p.whiteFlagTurns > 0 ? 'white-flag-active' : ''}">
                    ${p.grid.map((cell, idx) => {
                        let effectivePower = cell ? (cell.power || 0) : 0;
                        if (cell && effectivePower > 0) {
                            const defenseMultipliers = [1, 1.2, 1.5, 2, 2.5];
                            effectivePower = Math.floor(effectivePower * defenseMultipliers[p.technologies.defense]);
                            if (p.grid.some(c => c && c.type === 'Duvar')) effectivePower += 5;
                        }
                        return `
                            <div class="grid-cell ${cell?.type === 'Saray' ? 'meclis' : ''} ${cell ? 'occupied' : 'empty'}"
                                data-pid="${p.id}" data-idx="${idx}">
                                ${cell ? `
                                    <div class="cell-content">
                                        <div class="cell-icon-label">
                                            <span class="icon">${this.getBuildingIcon(cell.type)}</span>
                                            <div class="cell-label">${cell.type}</div>
                                        </div>
                                        <div class="cell-stats">
                                            <span class="hp">❤️${cell.hp || '-'}</span>
                                            ${cell.power ? `<span class="power" title="Efektif Savunma">🛡️${effectivePower}</span>` : ''}
                                            ${cell.garrison && (cell.type === 'Kışla' || cell.type === 'Saray' || cell.type === 'Bilim Merkezi') ? `<span class="garrison">👥${cell.garrison.length}</span>` : ''}
                                        </div>
                                    </div>
                                ` : `<span class="slot-empty">□</span>`}
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="resources">
                    <span class="res-item" title="Mevcut Altın">💰 ${p.gold}</span>
                    <span class="res-item" title="Nüfus / Kapasite">👥 ${(() => {
                        const { capacity, totalPop } = this.game.getCapacityInfo(p);
                        return `${totalPop}/${capacity}`;
                    })()}</span>
                    <span class="res-item" title="Aksiyon">⚡ ${p.actionsRemaining}</span>
                </div>

                ${isActive ? `
                    <div class="action-mode-panel">
                        <button class="action-mode-btn demolish ${this.game.actionMode === 'demolish' ? 'active' : ''}" data-mode="demolish" title="Yıkma Modu">🔨</button>
                        <button class="action-mode-btn attack ${this.game.actionMode === 'attack' ? 'active' : ''}" data-mode="attack" title="Saldırı Modu">⚔️</button>
                    </div>
                ` : ''}

                ${isActive && p.allianceWith && this.game.players.length >= 3 ? `
                    <div class="diplomacy-panel" style="margin-top:8px; display:flex; gap:4px; flex-wrap:wrap;">
                        <button class="btn-diplo btn-break-alliance" style="flex:1; font-size:0.75rem; padding:6px; background:#dc2626; color:white; border:none; cursor:pointer; border-radius:4px; font-weight:600;">💔 İttifak Boz</button>
                    </div>
                ` : ''}

                ${!isActive && activePlayer && !activePlayer.isVassal && !p.isVassal && !p.allianceWith && this.game.players.length >= 3 ? `
                    <div class="diplomacy-panel" style="margin-top:8px; display:flex; gap:4px; flex-wrap:wrap;">
                        ${!activePlayer.allianceWith ? `<button class="btn-diplo btn-propose-alliance" style="flex:1; font-size:0.75rem; padding:6px; background:#059669; color:white; border:none; cursor:pointer; border-radius:4px; font-weight:600;">🤝 İttifak Kur</button>` : ''}
                    </div>
                ` : ''}

                ${!isActive && activePlayer && (activePlayer.isVassal || p.isVassal) && this.game.players.length >= 3 ? `
                    <div style="margin-top:8px; font-size:0.65rem; color:#9ca3af; text-align:center;">⚠️ Vasallar ittifak kuramaz</div>
                ` : ''}
            `;

            this.containers.players.appendChild(div);

            // Action Mode Buttons
            div.querySelectorAll('.action-mode-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const mode = btn.dataset.mode;
                    if (this.game.actionMode === mode) {
                        this.game.clearActionMode();
                    } else {
                        const result = this.game.setActionMode(mode);
                        if (result && result.success === false) alert(result.msg);
                    }
                    this.render();
                });
            });

            // Propose Alliance
            const proposeBtn = div.querySelector('.btn-propose-alliance');
            if (proposeBtn) {
                proposeBtn.addEventListener('mouseenter', () => { proposeBtn.style.background = '#047857'; });
                proposeBtn.addEventListener('mouseleave', () => { proposeBtn.style.background = '#059669'; });
                proposeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const result = this.game.proposeAlliance(p.id);
                    if (result.success === false) alert(result.msg);
                    else if (result.msg) alert(result.msg);
                    this.render();
                });
            }

            // Break Alliance
            const breakBtn = div.querySelector('.btn-break-alliance');
            if (breakBtn) {
                breakBtn.addEventListener('mouseenter', () => { breakBtn.style.background = '#b91c1c'; });
                breakBtn.addEventListener('mouseleave', () => { breakBtn.style.background = '#dc2626'; });
                breakBtn.onclick = (e) => {
                    e.stopPropagation();
                    const confirmed = window.confirm('İttifakı bozmak istediğinden emin misin?\n\nCezalar:\n- 2 DP kaybedersin\n- Aksiyon harcarsın\n- Eski müttefikin +3 Altın kazanır');
                    if (confirmed) {
                        try {
                            const result = this.game.breakAlliance();
                            if (result.success === false) alert(result.msg);
                            this.render();
                        } catch (err) {
                            alert("İşlem sırasında bir hata oluştu: " + err.message);
                        }
                    }
                };
            }

            // Vassal View Buttons
            div.querySelectorAll('.btn-view-vassal').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showVassalGridModal(parseInt(btn.dataset.vassalId));
                });
            });

            // Grid Click Events
            div.querySelectorAll('.grid-cell').forEach(cell => {
                cell.addEventListener('click', () => {
                    const pid = parseInt(cell.dataset.pid);
                    const idx = parseInt(cell.dataset.idx);

                    if (this.game.pendingDiplomacyCard) {
                        const active = this.game.getActivePlayer();
                        if (pid !== active.id) {
                            const { cardIndex } = this.game.pendingDiplomacyCard;
                            const result = this.game.playDiplomacyCard(cardIndex, pid);
                            if (result.success === false) alert(result.msg);
                            this.game.pendingDiplomacyCard = null;
                        } else {
                            this.game.pendingDiplomacyCard = null;
                        }
                        this.render();
                        return;
                    }

                    const active = this.game.getActivePlayer();

                    if (this.game.actionMode === 'demolish') {
                        if (pid === active.id) {
                            const result = this.game.demolishBuilding(idx);
                            if (result.success === false) alert(result.msg);
                            this.render();
                        } else {
                            alert('Sadece kendi binalarını yıkabilirsin!');
                        }
                        return;
                    }

                    if (this.game.actionMode === 'attack') {
                        if (pid !== active.id) {
                            let result = this.game.initiateAttack(pid, idx);

                            if (result.requiresConfirmation) {
                                const confirmed = window.confirm(result.msg);
                                if (confirmed) {
                                    result = this.game.initiateAttack(pid, idx, true);
                                } else {
                                    this.render();
                                    return;
                                }
                            }

                            if (result.success === false) {
                                alert(result.msg);
                            } else if (result.waitingForDice) {
                                this.showDicePrompt();
                            }
                            this.render();
                        } else {
                            alert('Kendine saldıramazsın!');
                        }
                        return;
                    }

                    if (pid === active.id) {
                        const result = this.game.buildOnSlot(idx);
                        if (result.success === false) console.log(result.msg);
                        this.render();
                    }
                });
            });

            this.containers.players.appendChild(div);
        });
    }

    /**
     * Yeni harita-merkezli layout için player-card DOM elementi oluşturur.
     * _bindPlayerCardEvents ile event'lar eklenir.
     */
    _buildPlayerCard(p, isActive) {
        const div = document.createElement('div');
        div.className = `player-card${isActive ? ' active-player' : ''}${p.eliminated ? ' eliminated' : ''}`;
        div.style.setProperty('--player-color', p.color);
        div.dataset.playerId = p.id;

        const allyName = p.allianceWith
            ? this.game.players.find(pl => pl.id === p.allianceWith)?.name
            : null;
        const masterName = p.isVassal
            ? this.game.players.find(pl => pl.id === p.masterId)?.name
            : null;

        // Saray (index 0) ayrı
        const saray = p.grid[0];
        const sarayHp = saray ? saray.hp : 0;
        const sarayMaxHp = 10;
        const sarayHpPct = saray ? Math.max(0, sarayHp / sarayMaxHp) : 0;
        const sarayHpColor = sarayHpPct > 0.6 ? '#22c55e' : sarayHpPct > 0.3 ? '#f59e0b' : '#ef4444';
        const sarayCivils = saray?.garrison?.length ?? 0;

        // Bina kapasitesi özeti (1-12 slotlar)
        const usedSlots = p.grid.slice(1).filter(Boolean).length;
        const totalSlots = 12;

        // Kışla askerleri toplam
        let totalSoldiers = 0;
        p.grid.forEach(cell => {
            if (cell?.type === 'Kışla' && cell.garrison) totalSoldiers += cell.garrison.length;
        });

        // HP bar width hesaplama
        const sarayHpW = Math.round(sarayHpPct * 100);

        div.innerHTML = `
            <div class="pc-header">
                <div class="pc-color-dot"></div>
                <div class="pc-name${isActive ? ' pc-name-clickable' : ''}" ${isActive ? 'title="El kartlarını göster"' : ''}>${p.isBot ? '🤖 ' : ''}${p.name}${isActive ? ' 👑' : ''}${p.isVassal ? ' ⛓️' : ''}</div>
                <div class="pc-tech">⚔️${p.technologies.military} 🛡️${p.technologies.defense} 📈${p.technologies.commerce}</div>
            </div>

            ${p.isVassal && masterName ? `<div class="pc-vassal-badge">⛓️ ${masterName}</div>` : ''}
            ${allyName ? `<div class="pc-ally-badge">🤝 ${allyName}</div>` : ''}
            ${p.whiteFlagTurns > 0 ? `<div class="pc-flag-badge">🏳️ Barış (${p.whiteFlagTurns})</div>` : ''}
            ${p.mustRetaliateAgainst ? (() => { const t = this.game.players.find(x => x.id === p.mustRetaliateAgainst); return t ? `<div class="pc-retaliate-badge">⚔️ Misilleme: ${t.name}</div>` : ''; })() : ''}

            <!-- Saray -->
            <div class="pc-palace-block" data-pid="${p.id}">
                <div class="pc-palace-left">
                    <div class="pc-palace-big-icon" style="filter:drop-shadow(0 0 6px ${sarayHpColor})">🏰</div>
                    <div class="pc-palace-dp" style="color:${p.dp >= 5 ? '#fbbf24' : '#64748b'}">🎯${p.dp}</div>
                </div>
                <div class="pc-palace-info">
                    <div class="pc-palace-label">
                        <span style="font-family:var(--font-heading);font-size:0.72rem;color:#e2e8f0">Saray</span>
                        <span class="pc-hp-text" style="color:${sarayHpColor}">❤️ ${sarayHp}/${sarayMaxHp}</span>
                        <span class="pc-civil">👤${sarayCivils}</span>
                    </div>
                    <div class="pc-hp-bar-wrap">
                        <div class="pc-hp-bar-fill" style="width:${sarayHpW}%;background:${sarayHpColor}"></div>
                    </div>
                    <div class="pc-resources">
                        <span>💰 ${p.gold}</span>
                        <span>👥 ${(() => { try { const i = this.game.getCapacityInfo(p); return `${i.totalPop}/${i.capacity}`; } catch(e) { return p.pop || 0; } })()}</span>
                        <span>⚡ ${p.actionsRemaining}</span>
                    </div>
                </div>
            </div>

            <!-- Bina kapasitesi özeti -->
            <div class="pc-bld-summary">
                <span class="pc-bld-summary-icon">🏗️</span>
                <span class="pc-bld-summary-count">${usedSlots}/${totalSlots}</span>
                ${totalSoldiers > 0 ? `<span class="pc-bld-summary-soldiers">⚔️ ${totalSoldiers}</span>` : ''}
            </div>

            ${isActive ? `
                <div class="action-mode-panel">
                    <button class="action-mode-btn demolish ${this.game.actionMode === 'demolish' ? 'active' : ''}" data-mode="demolish">
                        <span class="amb-icon">🔨</span><span class="amb-label">Yık</span>
                    </button>
                    <button class="action-mode-btn attack ${this.game.actionMode === 'attack' ? 'active' : ''}" data-mode="attack">
                        <span class="amb-icon">⚔️</span><span class="amb-label">Saldır</span>
                    </button>
                </div>
            ` : ''}
            ${isActive && p.allianceWith ? `
                <button class="btn-diplo btn-break-alliance"><span>💔</span> İttifak Boz</button>
            ` : ''}
            ${!isActive && !p.allianceWith && !p.isVassal && !this.game.getActivePlayer().isVassal && !this.game.getActivePlayer().allianceWith && this.game.players.length >= 3 ? `
                <button class="btn-diplo btn-propose-alliance"><span>🤝</span> İttifak Kur</button>
            ` : ''}
            ${(() => {
                const activeP = this.game.getActivePlayer();
                if (!isActive && p.isVassal && p.masterId === activeP.id) {
                    return `<button class="btn-diplo btn-vassal-land" data-vassal-id="${p.id}" style="background:rgba(212,175,55,0.2);border-color:#d4af37;color:#d4af37;">📐 Arazi Yönet</button>`;
                }
                return '';
            })()}
        `;
        return div;
    }

    _bindPlayerCardEvents(div, p, activePlayer) {
        // Krallık ismine tıklayınca el kartı popup'ı aç (sadece aktif oyuncu)
        const nameEl = div.querySelector('.pc-name-clickable');
        if (nameEl) {
            nameEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this._showHandPopup(p);
            });
        }

        div.querySelectorAll('.action-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const mode = btn.dataset.mode;
                if (this.game.actionMode === mode) this.game.clearActionMode();
                else { const r = this.game.setActionMode(mode); if (r?.success === false) alert(r.msg); }
                this.render();
            });
        });

        const proposeBtn = div.querySelector('.btn-propose-alliance');
        if (proposeBtn) {
            proposeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const result = this.game.proposeAlliance(p.id);
                if (result.success === false) alert(result.msg);
                else if (result.msg) alert(result.msg);
                this.render();
            });
        }

        const breakBtn = div.querySelector('.btn-break-alliance');
        if (breakBtn) {
            breakBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm('İttifakı bozmak istediğinden emin misin?')) {
                    const result = this.game.breakAlliance();
                    if (result.success === false) alert(result.msg);
                    this.render();
                }
            };
        }

        const vassalLandBtn = div.querySelector('.btn-vassal-land');
        if (vassalLandBtn) {
            vassalLandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showVassalLandModal(parseInt(vassalLandBtn.dataset.vassalId));
            });
        }

        // Diplomasi hedef — oyuncu kartına (palace-row veya karta) tıklayınca
        div.addEventListener('click', (e) => {
            // Buton tıklamalarını geçir
            if (e.target.closest('button')) return;

            const active = this.game.getActivePlayer();

            if (this.game.pendingDiplomacyCard && p.id !== active.id) {
                const { cardIndex } = this.game.pendingDiplomacyCard;
                const result = this.game.playDiplomacyCard(cardIndex, p.id);
                if (result.success === false) alert(result.msg);
                this.game.pendingDiplomacyCard = null;
                this.render();
                return;
            }

            // Saldırı modu — rakip oyuncu kartına tıkla
            if (this.game.actionMode === 'attack' && p.id !== active.id) {
                // Rakibin Saray'ına saldır (idx=0)
                let result = this.game.initiateAttack(p.id, 0);
                if (result.requiresConfirmation) {
                    if (confirm(result.msg)) result = this.game.initiateAttack(p.id, 0, true);
                    else { this.render(); return; }
                }
                if (result.success === false) alert(result.msg);
                else if (result.waitingForDice) this.showDicePrompt();
                this.render();
            }
        });

        // Yıkım modu — bina ikonuna tıklayınca
        div.querySelectorAll('.pc-bld-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const active = this.game.getActivePlayer();
                if (this.game.actionMode !== 'demolish') return;
                if (p.id !== active.id) { alert('Sadece kendi binalarını yıkabilirsin!'); return; }
                const gridIdx = parseInt(chip.dataset.gridIdx);
                const result = this.game.demolishBuilding(gridIdx);
                if (result.success === false) alert(result.msg);
                this.render();
            });
        });
    }

    renderMarket(activeTab) {
        // Determine active tab (persist via dataset)
        const area = this.containers.market;
        const tabBar = document.getElementById('mkt-tab-bar');
        if (!activeTab) {
            activeTab = area.dataset.activeTab || 'standard';
        }
        area.dataset.activeTab = activeTab;

        // Update tab button active states
        if (tabBar) {
            tabBar.querySelectorAll('.mkt-tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === activeTab);
            });
        }

        area.innerHTML = '';

        const grid = document.createElement('div');
        grid.className = 'market-grid';
        grid.style.justifyContent = 'center';

        const typeOrder = { 'Bina': 1, 'Asker': 2, 'Diplomasi': 3, 'Teknoloji': 4 };
        const activePlayer = this.game.getActivePlayer();

        const sourceList = activeTab === 'mercenary'
            ? [...this.game.mercenaryPool]
            : [...this.game.openMarket].sort((a, b) => {
                const td = (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
                if (td !== 0) return td;
                if (a.type === 'Teknoloji' && b.type === 'Teknoloji') return a.level - b.level;
                return a.cost - b.cost;
            });

        sourceList.forEach((card) => {
            if (card.type === 'Teknoloji' && !card.isJoker) {
                const currentLevel = activePlayer.technologies[card.techType];
                if (card.level !== currentLevel + 1) return;
            }

            const isPool = activeTab === 'mercenary';
            const sourceIndex = isPool
                ? this.game.mercenaryPool.indexOf(card)
                : this.game.openMarket.indexOf(card);

            const canAfford = activePlayer.gold >= card.cost;
            const actionsRemaining = activePlayer.actionsRemaining;

            const el = document.createElement('div');

            if (card.type === 'Paralı Asker') {
                el.className = 'market-card mercenary-card';
                el.innerHTML = `
                    <div class="card-icon">⚔️💰</div>
                    <div class="card-name">${card.name}</div>
                    <div class="card-cost">${card.cost} Altın</div>
                    <div class="card-desc" style="font-size:0.7rem;color:#d8b4fe;">${card.description || ''}</div>
                    ${actionsRemaining > 0 ? (canAfford ? '<div class="buy-hint">🛒</div>' : '<div class="buy-hint" style="color:red">❌</div>') : '<div class="buy-hint" style="color:gray">🔒</div>'}
                `;
            } else {
                el.className = [
                    'card market-card',
                    card.type === 'Diplomasi' ? 'diplomacy-card' : '',
                    card.type === 'Teknoloji' ? 'tech-card' : '',
                    card.effect === 'terror_joker' ? 'terror-joker' : '',
                ].filter(Boolean).join(' ');

                const isPropaganda = card.name === 'Propaganda';
                const propStyle = isPropaganda ? 'font-size:0.72rem;letter-spacing:-0.5px;word-break:break-all;line-height:1.1;margin-top:12px;' : '';
                el.innerHTML = `
                    <div class="card-name ${isPropaganda ? 'propaganda-text' : ''}" style="${propStyle}">${card.name}</div>
                    <div class="card-cost">${card.cost} Altın</div>
                    ${card.type === 'Teknoloji' && !card.isJoker ? `<div class="card-level">Lv${card.level}</div>` : ''}
                    ${actionsRemaining > 0 ? (canAfford ? '<div class="buy-hint">🛒</div>' : '<div class="buy-hint" style="color:red">❌</div>') : '<div class="buy-hint" style="color:gray">🔒</div>'}
                `;
            }

            el.addEventListener('click', () => {
                const result = this.game.buyCard(sourceIndex, isPool ? 'mercenaryPool' : 'openMarket');
                if (result.success === false) alert(result.msg);
                this.render();
            });

            grid.appendChild(el);
        });

        area.appendChild(grid);
    }

    renderHand() {
        const player = this.game.getActivePlayer();
        const handContainer = this.containers.hand;
        if (!handContainer) return;

        // Kart sayısını güncelle
        const countEl = document.getElementById('hand-count');
        if (countEl) countEl.textContent = `${player.hand.length} kart`;

        // Log turn badge
        const badge = document.getElementById('log-turn-badge');
        if (badge) badge.textContent = `Tur ${this.game.turn}`;

        if (player.hand.length === 0) {
            handContainer.innerHTML = '<div class="mkt-hand-empty">Elinde kart yok — pazardan kart satın al</div>';
            // Eski pending pill'leri temizle
            handContainer.parentElement.querySelectorAll('.pending-card-pill').forEach(p => p.remove());
            return;
        }

        handContainer.innerHTML = '';
        // Eski pending pill'leri temizle
        handContainer.parentElement.querySelectorAll('.pending-card-pill').forEach(p => p.remove());

        const CARD_META = {
            'Bina':        { icon: '🏗️', badge: 'bina',     hint: 'Tıkla → krallığına otomatik inşa edilir' },
            'Asker':       { icon: '⚔️', badge: 'asker',    hint: 'Tıkla → Kışla garrison\'una otomatik eklenir' },
            'Diplomasi':   { icon: '🎭', badge: 'diplo',    hint: 'Tıkla → hedef oyuncuyu seç (panel üzerinden)' },
            'Teknoloji':   { icon: '🔬', badge: 'tech',     hint: 'Tıkla → araştırılır' },
            'Paralı Asker':{ icon: '💰', badge: 'mercenary',hint: 'Tıkla → Kışla garrison\'una anında eklenir' },
        };

        // Diplomasi bekleme bildirimi
        if (this.game.pendingDiplomacyCard) {
            const pill = document.createElement('div');
            pill.className = 'pending-card-pill';
            pill.textContent = '🎭 Diplomasi kartı bekleniyor — oyuncu panelinden hedef oyuncuya tıkla · İptal için buraya tıkla';
            pill.addEventListener('click', () => {
                this.game.pendingDiplomacyCard = null;
                this.renderHand();
            });
            handContainer.parentElement.insertBefore(pill, handContainer);
        }

        player.hand.forEach((card, index) => {
            const isSelected = this.game.selectedCardIndex === index;
            const isPending = this.game.pendingDiplomacyCard?.cardIndex === index;
            const meta = CARD_META[card.type] || { icon: '🃏', badge: 'bina', hint: 'Karta tıkla' };

            const el = document.createElement('div');
            el.className = [
                'hand-card',
                isSelected || isPending ? 'selected' : '',
                card.type === 'Diplomasi' ? 'diplomacy-card' : '',
                card.type === 'Teknoloji' ? 'tech-card' : '',
            ].filter(Boolean).join(' ');

            el.innerHTML = `
                <span class="hc-icon">${meta.icon}</span>
                <div class="hc-body">
                    <div class="hc-name">${card.name}${card.type === 'Teknoloji' && card.level ? ` Lv${card.level}` : ''}${card.type === 'Diplomasi' && card.dp ? ` (DP:${card.dp})` : ''}</div>
                    <div class="hc-hint">${meta.hint}</div>
                </div>
                <span class="hc-badge ${meta.badge}">${card.type}</span>
            `;

            el.addEventListener('click', () => {
                if (card.type === 'Bina') {
                    // Doğrudan otomatik slota yerleştir
                    const result = this.game.buildBuilding(index);
                    if (result.success === false) {
                        alert(result.msg);
                    } else {
                        this.render();
                    }

                } else if (card.type === 'Asker') {
                    // Doğrudan Kışla'ya ekle
                    const result = this.game.playAskerCard(index);
                    if (result.success === false) {
                        alert(result.msg);
                    } else {
                        this.render();
                    }

                } else if (card.type === 'Diplomasi') {
                    const needsTarget = card.effect &&
                        card.effect !== 'gold_boost' &&
                        card.effect !== 'military_boost' &&
                        card.effect !== 'white_flag';

                    if (needsTarget) {
                        const independentOpponents = this.game.players.filter(p => !p.isVassal && p.id !== this.game.getActivePlayer().id);
                        if (independentOpponents.length === 1) {
                            const result = this.game.playDiplomacyCard(index, independentOpponents[0].id);
                            if (result.success === false) alert(result.msg);
                            this.render();
                        } else {
                            // Market kapat, oyuncu panelinde hedef seçmesini bekle
                            this.game.pendingDiplomacyCard = { cardIndex: index, card };
                            if (this.game.onDiplomacyTargetNeeded) {
                                this.game.onDiplomacyTargetNeeded(card.name);
                            }
                            this.renderHand();
                        }
                    } else {
                        const result = this.game.playDiplomacyCard(index, null);
                        if (result.success === false) alert(result.msg);
                        this.render();
                    }

                } else if (card.type === 'Paralı Asker') {
                    const result = this.game.playMercenaryCard(index);
                    if (result.success === false) alert(result.msg);
                    else this.render();

                } else if (card.type === 'Teknoloji') {
                    const result = this.game.playTechnologyCard(index);
                    if (result.success === false) {
                        if (result.msg === "JOKER_SELECTION_NEEDED") {
                            this.showJokerModal(result.cardIndex, result.availableTechs);
                        } else {
                            alert(result.msg);
                        }
                    } else {
                        this.render();
                    }
                }
            });

            handContainer.appendChild(el);
        });
    }

    _showHandPopup(p) {
        // Mevcut popup varsa kapat
        let existing = document.getElementById('hand-popup');
        if (existing) { existing.remove(); return; }

        const popup = document.createElement('div');
        popup.id = 'hand-popup';
        popup.className = 'hand-popup';

        const CARD_META = {
            'Bina':        { icon: '🏗️', color: '#60a5fa' },
            'Asker':       { icon: '⚔️', color: '#f87171' },
            'Diplomasi':   { icon: '🎭', color: '#a78bfa' },
            'Teknoloji':   { icon: '🔬', color: '#34d399' },
            'Paralı Asker':{ icon: '💰', color: '#c084fc' },
        };

        const header = document.createElement('div');
        header.className = 'hp-header';
        header.innerHTML = `<span>🃏 El Kartları <span class="hp-count">${p.hand.length}</span></span><button class="hp-close">✕</button>`;
        header.querySelector('.hp-close').addEventListener('click', () => popup.remove());
        popup.appendChild(header);

        if (p.hand.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'hp-empty';
            empty.textContent = 'Elinde kart yok';
            popup.appendChild(empty);
        } else {
            const list = document.createElement('div');
            list.className = 'hp-list';

            p.hand.forEach((card, idx) => {
                const meta = CARD_META[card.type] || { icon: '🃏', color: '#94a3b8' };
                const el = document.createElement('div');
                el.className = 'hp-card';
                el.style.setProperty('--card-color', meta.color);
                el.innerHTML = `
                    <div class="hp-card-top">
                        <span class="hp-card-icon">${meta.icon}</span>
                        <span class="hp-card-name">${card.name}${card.level ? ` Lv${card.level}` : ''}${card.dp ? ` (+${card.dp}DP)` : ''}</span>
                        <span class="hp-card-cost">${card.cost}💰</span>
                    </div>
                    <div class="hp-card-type">${card.type}</div>
                `;
                el.addEventListener('click', () => {
                    popup.remove();
                    this._useCardFromPopup(idx, card);
                });
                list.appendChild(el);
            });

            popup.appendChild(list);
        }

        document.body.appendChild(popup);

        // Dışarı tıklayınca kapat
        setTimeout(() => {
            document.addEventListener('click', function closePopup(e) {
                if (!popup.contains(e.target)) {
                    popup.remove();
                    document.removeEventListener('click', closePopup);
                }
            });
        }, 50);
    }

    _useCardFromPopup(handIndex, card) {
        const game = this.game;

        if (card.type === 'Bina') {
            const result = game.buildBuilding(handIndex);
            if (result.success === false) alert(result.msg);
            else this.render();
        } else if (card.type === 'Asker') {
            const result = game.playAskerCard(handIndex);
            if (result.success === false) alert(result.msg);
            else this.render();
        } else if (card.type === 'Paralı Asker') {
            const result = game.playMercenaryCard(handIndex);
            if (result.success === false) alert(result.msg);
            else this.render();
        } else if (card.type === 'Teknoloji') {
            const result = game.playTechnologyCard(handIndex);
            if (result.success === false) {
                if (result.msg === 'JOKER_SELECTION_NEEDED') this.showJokerModal(result.cardIndex, result.availableTechs);
                else alert(result.msg);
            } else this.render();
        } else if (card.type === 'Diplomasi') {
            const needsTarget = card.effect && card.effect !== 'gold_boost' &&
                card.effect !== 'military_boost' && card.effect !== 'white_flag';
            if (!needsTarget) {
                const result = game.playDiplomacyCard(handIndex, null);
                if (result.success === false) alert(result.msg);
                else this.render();
            } else {
                const independentOpponents = game.players.filter(p => !p.isVassal && p.id !== game.getActivePlayer().id);
                if (independentOpponents.length === 1) {
                    const result = game.playDiplomacyCard(handIndex, independentOpponents[0].id);
                    if (result.success === false) alert(result.msg);
                    else this.render();
                } else {
                    game.pendingDiplomacyCard = { cardIndex: handIndex, card };
                    if (game.onDiplomacyTargetNeeded) game.onDiplomacyTargetNeeded(card.name);
                    this.render();
                }
            }
        }
    }
}

// Modal metodlarını Renderer'a uygula
Object.assign(Renderer.prototype, ModalRendererMixin);
