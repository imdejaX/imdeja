export class Renderer {
    constructor(game) {
        this.game = game;
        this.containers = {
            players: document.getElementById('players-container'),
            market: document.getElementById('market-cards'),
            turn: document.getElementById('turn-count'),
            phase: document.getElementById('phase-name'),
            hand: null // Created dynamically
        };

        // Add Hand Container to DOM if not exists
        if (!document.getElementById('player-hand')) {
            const handDiv = document.createElement('div');
            handDiv.id = 'player-hand';
            handDiv.className = 'hand-zone';
            document.querySelector('.game-board').appendChild(handDiv);
            this.containers.hand = handDiv;
        }

        // Add Log container
        if (!document.getElementById('game-logs')) {
            const logDiv = document.createElement('div');
            logDiv.id = 'game-logs';
            logDiv.className = 'log-zone';
            document.querySelector('.game-board').appendChild(logDiv);
            this.containers.logs = logDiv;
        }

        // Add Subtitle Container (Footer Info)
        if (!document.getElementById('game-subtitle')) {
            const subDiv = document.createElement('div');
            subDiv.id = 'game-subtitle';
            subDiv.className = 'subtitle-zone';
            // Basic styles for subtitle
            subDiv.style.cssText = `
                position: fixed;
                bottom: 0;
                left: 0;
                width: 100%;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(to right, rgba(0,0,0,0.95), rgba(15,15,15,0.98), rgba(0,0,0,0.95));
                color: #fcd34d;
                font-size: 0.95rem;
                pointer-events: none;
                z-index: 2000;
                border-top: 1px solid rgba(251, 191, 36, 0.4);
                opacity: 1;
                transition: opacity 0.5s ease;
                box-shadow: 0 -4px 10px rgba(0,0,0,0.5);
                letter-spacing: 0.5px;
                font-family: 'Cinzel', serif;
            `;
            document.body.appendChild(subDiv);
            this.containers.subtitle = subDiv;
        }
    }

    getBuildingIcon(type) {
        const icons = {
            'Meclis': '🏰',
            'Çiftlik': '🌾',
            'Kışla': '⚔️',
            'Duvar': '🛡️',
            'Pazar': '🏪',
            'Bilim Merkezi': '⚛️',
            'Piyade': '🗡️',
            'Okçu': '🏹',
            'Süvari': '🐎'
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
        const turnDiv = document.getElementById('turn-indicator');
        const goldDisplay = document.getElementById('gold-display');
        const activePlayer = this.game.getActivePlayer();

        // Show total EARNED gold across all players (not current gold)
        const totalGoldEarned = this.game.getTotalGold(); // Uses totalGoldEarned
        const goldCapPerPlayer = this.game.getGoldCap(); // 65 per player
        const totalGoldCap = goldCapPerPlayer * this.game.players.length; // 65 × player count

        if (turnDiv) {
            turnDiv.innerHTML = `
                <span style="color: var(--color-gold); font-weight: 600;">TUR ${this.game.turn}</span>
                <span style="color: var(--color-text-dim); margin: 0 8px;">•</span>
                <span style="color: var(--color-text-main);">${activePlayer.name}</span>
            `;
        }

        if (goldDisplay) {
            const color = totalGoldEarned >= totalGoldCap ? '#ef4444' : 'var(--color-gold)';
            goldDisplay.innerHTML = `<span style="color: ${color}; font-weight: 600;">💰 ${totalGoldEarned}/${totalGoldCap}</span>`;
        }

        // Add New Game button if game ended
        const endTurnBtn = document.getElementById('end-turn-btn');
        if (this.game.phase === 'SONUÇ') {
            if (endTurnBtn) {
                endTurnBtn.textContent = 'YENİ OYUN';
                endTurnBtn.onclick = () => location.reload();
            }
        } else {
            if (endTurnBtn) {
                endTurnBtn.innerHTML = '⏩';
                endTurnBtn.title = 'Turu Bitir';
                endTurnBtn.onclick = () => {
                    this.game.endTurn();
                    this.render();
                };
            }
        }
    }

    renderLogs() {
        // Group logs by turn
        const logsByTurn = {};
        this.game.logs.forEach(log => {
            const turn = log.turn || 1;
            if (!logsByTurn[turn]) {
                logsByTurn[turn] = [];
            }
            logsByTurn[turn].push(log);
        });

        // Get turns in reverse order (newest first)
        const turns = Object.keys(logsByTurn).sort((a, b) => b - a);

        // Render grouped logs
        let html = '';
        turns.forEach(turn => {
            html += `
                <div class="log-turn-group">
                    <div class="log-turn-header">📅 TUR ${turn}</div>
                    ${logsByTurn[turn].map(log => {
                const message = log.message || log;
                const isTip = log.isTip || false;
                const className = isTip ? 'log-entry log-tip' : 'log-entry';
                return `<div class="${className}">${message}</div>`;
            }).join('')}
                </div>
            `;
        });

        this.containers.logs.innerHTML = html;
        this.containers.logs.scrollTop = 0;
    }

    renderGameInfo() {
        const turn = this.game.turn;
        const phase = this.game.phase;
        const activePlayer = this.game.getActivePlayer();

        let infoHTML = '';

        if (this.game.gameEnded) {
            const winner = this.game.players.find(p => !p.isVassal);
            infoHTML = `
                <div style="font-size: 1.5rem; font-weight: bold; color: #fbbf24; margin-bottom: 10px;">
                    🏆 OYUN BİTTİ!
                </div>
                <div style="font-size: 1.2rem; color: ${winner.color};">
                    ${winner.name} KAZANDI!
                </div>
            `;
        } else if (turn === 1) {
            infoHTML = `
                <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 8px;">
                    🎮 Oyun Başladı!
                </div>
                <div style="font-size: 0.85rem; color: #aaa;">
                    Krallıkların Terazisi v2.0
                </div>
            `;
        } else {
            const vassals = this.game.players.filter(p => p.isVassal);
            const freePlayers = this.game.players.filter(p => !p.isVassal);

            // Calculate total earned: starting gold (8 per player) + all income earned
            const totalEarned = this.game.players.reduce((sum, p) => sum + p.totalGoldEarned, 0);
            infoHTML = `
                <div style="font-size: 1rem; margin-bottom: 8px;">
                    📊 Oyun İlerlemesi
                </div>
                <div style="font-size: 0.8rem; line-height: 1.8;">
                    <div>🎯 Tur: ${turn}</div>
                    <div>💰 Kazanılan: ${totalEarned}</div>
                    <div>👑 Bağımsız: ${freePlayers.length}</div>
                    <div>⛓️ Vasal: ${vassals.length}</div>
                </div>
            `;
        }

        this.containers.gameInfo.innerHTML = infoHTML;
    }

    renderPlayers() {
        this.containers.players.innerHTML = '';

        // Sort players: active player first (leftmost)
        const activePlayer = this.game.getActivePlayer();
        const sortedPlayers = [
            activePlayer,
            ...this.game.players.filter(p => p.id !== activePlayer.id)
        ];

        sortedPlayers.forEach(p => {
            const isActive = p.id === activePlayer.id;

            const div = document.createElement('div');
            div.className = `player-zone ${isActive ? 'active-turn' : ''}`;

            // Player name with bot indicator
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
                    // Check if active player is master of any vassals
                    const activePlayer = this.game.getActivePlayer();
                    const vassals = this.game.players.filter(v => v.isVassal && v.masterId === activePlayer.id);
                    if (vassals.length > 0 && isActive) {
                        return `
                            <div style="margin-top: 8px; display: flex; gap: 4px; flex-wrap: wrap;">
                                ${vassals.map(v => `
                                    <button class="btn-view-vassal" data-vassal-id="${v.id}" style="flex: 1; font-size: 0.7rem; padding: 6px 8px; background: rgba(220, 38, 38, 0.3); border: 1px solid #dc2626; color: #fca5a5; cursor: pointer; border-radius: 4px; font-weight: 600; transition: all 0.2s;">
                                        👁️ ${v.name} Krallığı
                                    </button>
                                `).join('')}
                            </div>
                        `;
                    }
                    return '';
                })()}
                ${p.whiteFlagTurns > 0 ? `<div class="white-flag-badge" style="background: rgba(255, 255, 255, 0.15); border: 2px solid #f0f0f0; color: #ffffff; padding: 6px 10px; border-radius: 6px; font-weight: 700; margin-top: 6px; text-align: center; box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);">🏳️ Barış Koruması (${p.whiteFlagTurns} Tur)</div>` : ''}
                ${p.militaryBoost && p.militaryBoost > 0 ? `<div class="military-boost-badge">⚔️ Askeri Bonus: +${p.militaryBoost}</div>` : ''}
                
                <div class="kingdom-grid ${p.whiteFlagTurns > 0 ? 'white-flag-active' : ''}">
                    ${p.grid.map((cell, idx) => {
                    // Calculate Effective Defense for Display
                    let effectivePower = cell ? (cell.power || 0) : 0;
                    if (cell && effectivePower > 0) {
                        // Apply Tech
                        const defenseMultipliers = [1, 1.2, 1.5, 2, 2.5];
                        effectivePower = Math.floor(effectivePower * defenseMultipliers[p.technologies.defense]);

                        // Apply Wall Bonus
                        const hasWall = p.grid.some(c => c && c.type === 'Duvar');
                        if (hasWall) effectivePower += 5;
                    }

                    return `
                        <div class="grid-cell 
                            ${cell?.type === 'Meclis' ? 'meclis' : ''} 
                            ${cell ? 'occupied' : 'empty'}" 
                            data-pid="${p.id}" 
                            data-idx="${idx}">
                            
                            ${cell ? `
                                <div class="cell-content">
                                    <div class="cell-icon-label">
                                        <span class="icon">${this.getBuildingIcon(cell.type)}</span>
                                        <div class="cell-label">${cell.type}</div>
                                    </div>
                                    <div class="cell-stats">
                                        <span class="hp">❤️${cell.hp || '-'}</span>
                                        ${cell.power ? `<span class="power" title="Efektif Savunma (Taban + Teknoloji + Duvar)">🛡️${effectivePower}</span>` : ''}
                                        ${cell.garrison && (cell.type === 'Kışla' || cell.type === 'Meclis' || cell.type === 'Bilim Merkezi') ? `<span class="garrison">👥${cell.garrison.length}</span>` : ''}
                                    </div>
                                </div>
                            ` : `<span class="slot-empty">□</span>`}
                            
                        </div>
                    `}).join('')}
                </div>
                
                <div class="resources">
                    <span class="res-item" title="Mevcut Altın">💰 ${p.gold}</span>
                <span class="res-item" title="Nüfus (Aktif Ordu) / Kapasite">👥 ${(() => {
                    const { capacity, totalPop } = this.game.getCapacityInfo(p);
                    return `${totalPop}/${capacity}`;
                })()}</span>
                    <span class="res-item" title="Aksiyon">⚡ ${p.actionsRemaining}</span>
                </div>
                
                ${isActive ? `
                    <div class="action-mode-panel">
                        <button class="action-mode-btn demolish ${this.game.actionMode === 'demolish' ? 'active' : ''}" data-mode="demolish" title="Yıkma Modu">
                            🔨
                        </button>
                        <button class="action-mode-btn attack ${this.game.actionMode === 'attack' ? 'active' : ''}" data-mode="attack" title="Saldırı Modu">
                            ⚔️
                        </button>
                    </div>
                ` : ''}
                
            ${isActive && p.allianceWith && this.game.players.length >= 3 ? `
                <div class="diplomacy-panel" style="margin-top:8px; display:flex; gap:4px; flex-wrap:wrap;">
                    <button class="btn-diplo btn-break-alliance" style="flex:1; font-size:0.75rem; padding:6px; background:#dc2626; color:white; border:none; cursor:pointer; border-radius:4px; font-weight:600; transition: all 0.2s;">💔 İttifak Boz</button>
                </div>
            ` : ''}
            
            ${!isActive && activePlayer && !activePlayer.isVassal && !p.isVassal && !p.allianceWith && this.game.players.length >= 3 ? `
                <div class="diplomacy-panel" style="margin-top:8px; display:flex; gap:4px; flex-wrap:wrap;">
                    ${!activePlayer.allianceWith ? `<button class="btn-diplo btn-propose-alliance" style="flex:1; font-size:0.75rem; padding:6px; background:#059669; color:white; border:none; cursor:pointer; border-radius:4px; font-weight:600; transition: all 0.2s;">🤝 İttifak Kur</button>` : ''}
                </div>
            ` : ''}
            
            ${!isActive && activePlayer && (activePlayer.isVassal || p.isVassal) && this.game.players.length >= 3 ? `
                <div style="margin-top:8px; font-size:0.65rem; color:#9ca3af; text-align:center;">
                    ⚠️ Vasallar ittifak kuramaz
                </div>
            ` : ''}
            `;

            this.containers.players.appendChild(div);

            // Rebellion Button
            const rebelBtn = div.querySelector('.btn-rebel');
            if (rebelBtn) {
                rebelBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const result = this.game.rebel();
                    if (result.success === false) alert(result.msg);
                    this.render();
                });
            }

            // Action Mode Buttons
            const actionModeButtons = div.querySelectorAll('.action-mode-btn');
            actionModeButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const mode = btn.dataset.mode;

                    // Toggle mode: if already active, deactivate
                    if (this.game.actionMode === mode) {
                        this.game.clearActionMode();
                    } else {
                        const result = this.game.setActionMode(mode);
                        if (result && result.success === false) {
                            alert(result.msg);
                        }
                    }

                    this.render();
                });
            });

            // Diplomacy Buttons

            const proposeBtn = div.querySelector('.btn-propose-alliance');
            if (proposeBtn) {
                // Add hover effect
                proposeBtn.style.cursor = 'pointer';
                proposeBtn.addEventListener('mouseenter', () => {
                    proposeBtn.style.background = '#047857';
                });
                proposeBtn.addEventListener('mouseleave', () => {
                    proposeBtn.style.background = '#059669';
                });

                proposeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    console.log('Alliance button clicked!', activePlayer, p);

                    // Propose alliance - let game.js handle all validation
                    const result = this.game.proposeAlliance(p.id);
                    if (result.success === false) {
                        alert(result.msg);
                    } else if (result.msg) {
                        alert(result.msg);
                    }
                    this.render();
                });
            }

            const breakBtn = div.querySelector('.btn-break-alliance');
            if (breakBtn) {
                // Add hover effect
                breakBtn.addEventListener('mouseenter', () => {
                    breakBtn.style.background = '#b91c1c';
                });
                breakBtn.addEventListener('mouseleave', () => {
                    breakBtn.style.background = '#dc2626';
                });

                breakBtn.onclick = (e) => {
                    e.stopPropagation();
                    // Use window.confirm explicitly
                    const confirmed = window.confirm('İttifakı bozmak istediğinden emin misin?\n\nCezalar:\n- 2 Diplomasi Puanı kaybedersin\n- Aksiyon harcarsın\n- Eski müttefikin +3 Altın kazanır');

                    if (confirmed) {
                        try {
                            const result = this.game.breakAlliance();
                            if (result.success === false) {
                                alert(result.msg);
                            }
                            this.render();
                        } catch (err) {
                            console.error(err);
                            alert("İşlem sırasında bir hata oluştu: " + err.message);
                        }
                    }
                };
            }

            // Vassal Grid Viewing Buttons
            const vassalViewBtns = div.querySelectorAll('.btn-view-vassal');
            vassalViewBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const vassalId = parseInt(btn.dataset.vassalId);
                    this.showVassalGridModal(vassalId);
                });
            });


            // Grid Click Events
            div.querySelectorAll('.grid-cell').forEach(cell => {
                cell.addEventListener('click', () => {
                    const pid = parseInt(cell.dataset.pid);
                    const idx = parseInt(cell.dataset.idx);

                    // Check if in diplomacy targeting mode
                    if (this.game.pendingDiplomacyCard) {
                        const activePlayer = this.game.getActivePlayer();
                        if (pid !== activePlayer.id) {
                            // Play diplomacy card on this target
                            const { cardIndex } = this.game.pendingDiplomacyCard;
                            const result = this.game.playDiplomacyCard(cardIndex, pid);
                            if (result.success === false) {
                                alert(result.msg);
                            }
                            this.game.pendingDiplomacyCard = null;
                            this.render();
                            return;
                        } else {
                            // Cancel targeting if clicked own kingdom
                            this.game.pendingDiplomacyCard = null;
                            this.render();
                            return;
                        }
                    }

                    // Mode-based actions
                    const activePlayer = this.game.getActivePlayer();

                    // Demolish Mode
                    if (this.game.actionMode === 'demolish') {
                        if (pid === activePlayer.id) {
                            const result = this.game.demolishBuilding(idx);
                            if (result.success === false) {
                                alert(result.msg);
                            }
                            this.render();
                        } else {
                            alert('Sadece kendi binalarını yıkabilirsin!');
                        }
                        return;
                    }

                    // Attack Mode
                    if (this.game.actionMode === 'attack') {
                        if (pid !== activePlayer.id) {
                            let result = this.game.initiateAttack(pid, idx);

                            // Handle Confirmation (Alliance Betrayal)
                            if (result.requiresConfirmation) {
                                const confirmed = window.confirm(result.msg);
                                if (confirmed) {
                                    // Retry with confirmation flag
                                    result = this.game.initiateAttack(pid, idx, true);
                                } else {
                                    // User cancelled
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

                    // No mode active - default to build on own cells
                    if (pid === activePlayer.id) {
                        const result = this.game.buildOnSlot(idx);
                        if (result.success === false) {
                            console.log(result.msg);
                        }
                        this.render();
                    }
                });
            });
        });
    }

    renderMarket() {
        this.containers.market.innerHTML = '';
        this.containers.market.className = ''; // Remove 'market-grid' to allow block layout

        // Create separate grids
        const standardGrid = document.createElement('div');
        standardGrid.className = 'market-grid';
        standardGrid.style.justifyContent = 'center';

        const mercenaryGrid = document.createElement('div');
        mercenaryGrid.className = 'market-grid';
        mercenaryGrid.style.justifyContent = 'center';

        // Sort cards in specified order: Bina, Asker, Diplomasi, Teknoloji
        const typeOrder = { 'Bina': 1, 'Asker': 2, 'Diplomasi': 3, 'Teknoloji': 4, 'Paralı Asker': 5 };
        const sortedMarket = [...this.game.openMarket].sort((a, b) => {
            // Primary Sort: Type
            const typeDiff = (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
            if (typeDiff !== 0) return typeDiff;

            // Secondary Sort: Level (for Tech) or Cost (for Others)
            if (a.type === 'Teknoloji' && b.type === 'Teknoloji') {
                return a.level - b.level;
            }
            return a.cost - b.cost;
        });

        sortedMarket.forEach((card, index) => {
            // Filter out irrelevant Technology cards for the ACTIVE player
            // This hides shared market cards that are for other players' levels
            // Exception: Joker is always relevant
            if (card.type === 'Teknoloji' && !card.isJoker) {
                const activePlayer = this.game.getActivePlayer();
                const currentLevel = activePlayer.technologies[card.techType];

                // Only show the EXACT next level
                // Hide if:
                // 1. Level is too high (> current + 1)
                // 2. Level is already reached (<= current)
                if (card.level !== currentLevel + 1) {
                    return; // Skip rendering effectively "hides" it
                }
            }

            // Find original index for buyCard function
            const originalIndex = this.game.openMarket.indexOf(card);
            const el = document.createElement('div');
            const isPoolSoldier = card.isPoolSoldier || false;

            // Define variables for UI logic
            const activePlayer = this.game.getActivePlayer();
            const actionsRemaining = activePlayer.actionsRemaining;
            const canAfford = activePlayer.gold >= card.cost;

            el.className = `card market-card ${card.type === 'Diplomasi' ? 'diplomacy-card' : ''} 
                            ${card.type === 'Teknoloji' ? 'tech-card' : ''} 
                            ${isPoolSoldier ? 'pool-soldier-card' : ''}
                            ${card.effect === 'terror_joker' ? 'terror-joker' : ''}`;

            // Generate tooltip description
            let description = '';
            if (card.type === 'Diplomasi') {
                const effects = {
                    'steal_card': 'Rakipten rastgele bir kart çalar',
                    'gold_boost': '+3 Altın kazandırır',
                    'steal_unit': 'Rakipten bir askeri birimi çalar',
                    'kill_pop': 'Rakibin 1 nüfusunu öldürür',
                    'military_boost': 'Bir sonraki saldırıda +3 güç bonusu',
                    'terror_joker': 'Rakibin binasını YOK EDER! (Meclis hariç, 10 DP)'
                };
                description = `${card.name} - ${effects[card.effect] || 'Diplomasi kartı'}\n+${card.dp} DP kazandırır`;
            } else if (card.type === 'Teknoloji') {
                const techNames = {
                    'food': 'Tarım',
                    'military': 'Askeri Güç',
                    'defense': 'Savunma',
                    'commerce': 'Ticaret'
                };
                description = `${card.name} - ${techNames[card.techType] || 'Teknoloji'} teknolojisi\nMaliyet: ${card.popCost} nüfus\nÇarpan: x${card.multiplier}`;
            } else if (card.type === 'Asker') {
                description = `${card.name} - Askeri birim\nGüç: ${card.power}`;
            } else if (card.type === 'Bina') {
                const buildingDesc = {
                    'Çiftlik': 'Her turda +1 altın üretir',
                    'Kışla': 'Her turda rastgele asker üretir (garnizon)',
                    'Duvar': 'Tüm binalara +5 savunma bonusu',
                    'Pazar': 'Pazar yenileme maliyetini azaltır'
                };
                description = `${card.name} - ${buildingDesc[card.name] || 'Bina'}\nHP: ${card.hp}`;
            } else if (card.type === 'Paralı Asker') {
                description = `${card.name} - Paralı Asker\nGüç: ${card.power}\n${card.description}`;
            }

            el.title = description;

            if (card.type === 'Paralı Asker') {
                // Mercenary Card Style
                el.className = 'market-card mercenary-card'; // Add specific class
                el.style.border = '2px solid #a855f7'; // Purple border
                el.style.background = 'linear-gradient(135deg, #3b0764 0%, #1e1b4b 100%)';

                el.innerHTML = `
                    <div class="card-icon">⚔️💰</div>
                    <div class="card-name">${card.name}</div>
                    <div class="card-cost">${card.cost} Altın</div>
                    <div class="card-desc" style="font-size: 0.7rem; color: #d8b4fe;">${card.description}</div>
                    ${actionsRemaining > 0 ? (canAfford ? '<div class="buy-hint">🛒</div>' : '<div class="buy-hint" style="color:red">❌</div>') : '<div class="buy-hint" style="color:gray">🔒</div>'}
                `;
            } else {
                // Standard Card
                const isPropaganda = card.name === 'Propaganda';
                // Inline style override to guarantee fit and position
                const propStyle = isPropaganda ? 'font-size: 0.72rem !important; letter-spacing: -0.5px; word-break: break-all; line-height: 1.1; margin-top: 12px;' : '';

                el.innerHTML = `
                    <div class="card-name ${isPropaganda ? 'propaganda-text' : ''}" style="${propStyle}">${card.name}</div>
                    <div class="card-cost">${card.cost} Altın</div>
                    ${card.type === 'Teknoloji' && !card.isJoker ? `<div class="card-level">Lv${card.level}</div>` : ''}
                    ${actionsRemaining > 0 ? (canAfford ? '<div class="buy-hint">🛒</div>' : '<div class="buy-hint" style="color:red">❌</div>') : '<div class="buy-hint" style="color:gray">🔒</div>'}
                `;
            }

            el.addEventListener('click', () => {
                const result = this.game.buyCard(originalIndex);
                if (result.success === false) {
                    alert(result.msg);
                }
                this.render();
            });

            // Append to appropriate grid
            if (card.type === 'Paralı Asker' || isPoolSoldier) {
                mercenaryGrid.appendChild(el);
            } else {
                standardGrid.appendChild(el);
            }
        });

        // Append Standard Grid
        this.containers.market.appendChild(standardGrid);

        // Append Mercenary Grid if has items
        if (mercenaryGrid.children.length > 0) {
            const separator = document.createElement('div');
            separator.style.cssText = 'width: 100%; text-align: center; margin: 20px 0 10px; border-top: 1px solid rgba(251, 191, 36, 0.3); padding-top: 15px;';
            separator.innerHTML = '<h4 style="color: #fbbf24; font-family: Cinzel, serif; margin: 0; text-shadow: 0 0 5px rgba(251, 191, 36, 0.3);">⚔️ Paralı Askerler</h4>';

            this.containers.market.appendChild(separator);
            this.containers.market.appendChild(mercenaryGrid);
        }
    }

    renderHand() {
        const player = this.game.getActivePlayer();
        const handContainer = this.containers.hand;
        handContainer.innerHTML = '<h3>ELİMDEKİ KARTLAR</h3><div class="hand-row"></div>';
        const row = handContainer.querySelector('.hand-row');

        player.hand.forEach((card, index) => {
            const isSelected = this.game.selectedCardIndex === index;
            const el = document.createElement('div');
            el.className = `card hand-card ${isSelected ? 'selected' : ''} 
                            ${card.type === 'Diplomasi' ? 'diplomacy-card' : ''} 
                            ${card.type === 'Teknoloji' ? 'tech-card' : ''}
                            ${card.effect === 'terror_joker' ? 'terror-joker' : ''}`;
            el.innerHTML = `
                <div class="card-title">${card.name}</div>
                <div class="card-type">${card.type === 'Bina' ? '🏭' :
                    card.type === 'Asker' ? '⚔️' :
                        card.type === 'Diplomasi' ? '🎭 DP:' + card.dp :
                            card.type === 'Teknoloji' ? `🔬 Lv${card.level}` : ''
                }</div>
                ${card.type === 'Teknoloji' ? `<div style="font-size:0.6rem; color:#666;">👥${card.popCost}</div>` : ''}
            `;

            el.addEventListener('click', () => {
                if (card.type === 'Diplomasi') {
                    // Check if card needs a target
                    const needsTarget = card.effect && card.effect !== 'gold_boost' && card.effect !== 'military_boost' && card.effect !== 'white_flag';

                    if (needsTarget) {
                        // Auto-target in 1v1 games
                        if (this.game.players.length === 2) {
                            const activePlayer = this.game.getActivePlayer();
                            const opponent = this.game.players.find(p => p.id !== activePlayer.id);
                            const result = this.game.playDiplomacyCard(index, opponent.id);
                            if (result.success === false) {
                                alert(result.msg);
                            }
                            this.render();
                        } else {
                            // Enter targeting mode for multiplayer
                            this.game.pendingDiplomacyCard = { cardIndex: index, card: card };
                            this.render();
                        }
                    } else {
                        // Play card directly (no target needed)
                        const result = this.game.playDiplomacyCard(index, null);
                        if (result.success === false) {
                            alert(result.msg);
                        }
                        this.render();
                    }
                } else if (card.type === 'Paralı Asker') {
                    // Play mercenary card
                    const result = this.game.playMercenaryCard(index);
                    if (result.success === false) {
                        alert(result.msg);
                    }
                    this.render();
                } else if (card.type === 'Teknoloji') {
                    // Play technology card directly
                    const result = this.game.playTechnologyCard(index);

                    if (result.success === false) {
                        if (result.msg === "JOKER_SELECTION_NEEDED") {
                            // Show Selection Modal
                            this.showJokerModal(result.cardIndex, result.availableTechs);
                        } else {
                            alert(result.msg);
                        }
                    } else {
                        this.render();
                    }
                } else {
                    // Select for building
                    this.game.selectHandCard(index);
                    this.render();
                }
            });

            row.appendChild(el);
        });
    }

    showDicePrompt() {
        // Create or show dice prompt overlay
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

            // Add event listener for Roll Dice button
            document.getElementById('roll-dice-btn').addEventListener('click', async () => {
                try {
                    window.soundManager.playDiceRoll();

                    // Roll dice first so animation has data
                    const diceRoll = this.game.prepareAttackDice();
                    if (!diceRoll) {
                        alert("Bekleyen saldırı verisi bulunamadı!");
                        this.game.clearActionMode();
                        this.render();
                        return;
                    }

                    // Hide prompt
                    prompt.style.display = 'none';

                    // Show dice animation FIRST (2 seconds) with CURRENT roll data
                    this.showDiceRoll(diceRoll);

                    // Wait for dice animation to complete
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // NOW execute the attack with combat calculator (uses the prepared dice)
                    const result = await this.game.rollDiceForAttack();

                    if (result.success) {
                        // Render after everything is done
                        this.render();
                    } else {
                        // If success is false (logic error), still render to clear state
                        console.error("Attack failed logic:", result.msg);
                        this.game.clearActionMode();
                        this.render();
                    }
                } catch (err) {
                    console.error("Dice Roll Error:", err);
                    alert("Saldırı sırasında hata oluştu: " + err.message);
                    this.game.clearActionMode(); // FORCE CLEAR
                    this.game.pendingAttack = null;
                    this.render();
                }
            });

            // Add event listener for Cancel button
            document.getElementById('cancel-dice-btn').addEventListener('click', () => {
                // Clear pending attack
                this.game.pendingAttack = null;
                this.game.clearActionMode();
                // Hide prompt
                prompt.style.display = 'none';
                // Re-render to update UI
                this.render();
            });
        }

        prompt.style.display = 'flex';
    }


    showSubtitle(text) {
        if (!this.containers.subtitle) return;
        this.containers.subtitle.textContent = text;
        this.containers.subtitle.style.opacity = '1';

        // Removed timeout logic as user requested permanent visibility
        if (this.subtitleTimeout) {
            clearTimeout(this.subtitleTimeout);
            this.subtitleTimeout = null;
        }
    }

    showDiceRoll(diceData) {
        const backdrop = document.getElementById('dice-backdrop');
        const container = document.getElementById('dice-container');
        const label = document.getElementById('dice-label');
        const attackerDice = document.getElementById('dice-attacker');
        const defenderDice = document.getElementById('dice-defender');

        // Show backdrop and container
        backdrop.classList.add('active');
        container.classList.add('active');

        // Update label
        label.textContent = `${diceData.attackerName} vs ${diceData.defenderName}`;

        // Animate dice
        attackerDice.textContent = '?';
        defenderDice.textContent = '?';

        setTimeout(() => {
            attackerDice.textContent = diceData.attacker;
            defenderDice.textContent = diceData.defender;
        }, 300);

        // Hide after 2 seconds
        setTimeout(() => {
            backdrop.classList.remove('active');
            container.classList.remove('active');
        }, 2000);
    }

    showAttackNotification(attackInfoArray) {
        // Create or get notification element
        let notification = document.getElementById('attack-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'attack-notification';
            notification.className = 'attack-notification';
            document.body.appendChild(notification);
        }

        // Process attack info - handle both old string format and new object format
        let attackText = '';
        let attackerColor = '#dc2626'; // Default red
        let defenderColor = '#991b1b'; // Default dark red

        if (Array.isArray(attackInfoArray)) {
            // Multiple attacks or array of attack objects
            if (attackInfoArray.length > 0) {
                const firstAttack = attackInfoArray[0];
                if (typeof firstAttack === 'object') {
                    // New format with colors
                    attackText = attackInfoArray.map(a => a.text).join(', ');
                    attackerColor = firstAttack.attackerColor;
                    defenderColor = firstAttack.defenderColor;
                } else {
                    // Old string format
                    attackText = attackInfoArray.join(', ');
                }
            }
        } else if (typeof attackInfoArray === 'object') {
            // Single attack object
            attackText = attackInfoArray.text;
            attackerColor = attackInfoArray.attackerColor;
            defenderColor = attackInfoArray.defenderColor;
        } else {
            // Old string format
            attackText = attackInfoArray;
        }

        // Create gradient from attacker color (left) to defender color (right)
        // Smooth transition with center meeting point
        const gradient = `linear-gradient(90deg, ${attackerColor} 0%, ${attackerColor} 20%, 
                         color-mix(in srgb, ${attackerColor} 50%, ${defenderColor} 50%) 50%, 
                         ${defenderColor} 80%, ${defenderColor} 100%)`;

        // Create border gradient (lighter versions)
        const borderGradient = `linear-gradient(90deg, 
                                color-mix(in srgb, ${attackerColor} 70%, white 30%) 0%, 
                                color-mix(in srgb, ${defenderColor} 70%, white 30%) 100%)`;

        // Set content with dynamic gradient
        notification.innerHTML = `
            <div class="attack-notification-content" style="background: ${gradient}; border-image: ${borderGradient} 1; border-image-slice: 1;">
                <div class="attack-icon">⚔️</div>
                <div class="attack-message">
                    <strong>${attackText}</strong> saldırısı!
                </div>
            </div>
        `;

        // Show notification
        notification.classList.add('show');

        // Hide after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
    }

    showVassalGridModal(vassalId) {
        const vassal = this.game.players.find(p => p.id === vassalId);
        if (!vassal) return;

        // Create or get modal element
        let modal = document.getElementById('vassal-grid-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'vassal-grid-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                backdrop-filter: blur(5px);
            `;
            document.body.appendChild(modal);

            // Close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }

        // Build modal content
        modal.innerHTML = `
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 16px; max-width: 600px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.5); border: 2px solid ${vassal.color};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: ${vassal.color}; font-size: 1.5rem; text-shadow: 0 0 10px ${vassal.color};">
                        ⛓️ ${vassal.name} Krallığı
                    </h2>
                    <button id="close-vassal-modal" style="background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 1rem;">
                        ✕
                    </button>
                </div>

                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="display: flex; gap: 20px; justify-content: space-around; font-size: 0.9rem;">
                        <span style="color: #fbbf24;">💰 Altın: ${vassal.gold}</span>
                        <span style="color: #60a5fa;">👥 Nüfus: ${vassal.pop}</span>
                        <span style="color: #a78bfa;">🎯 DP: ${vassal.dp}</span>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px;">
                    ${vassal.grid.map((cell, idx) => `
                        <div style="
                            background: ${cell ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.3)'};
                            border: 2px solid ${cell ? (cell.type === 'Meclis' ? '#fbbf24' : '#3b82f6') : '#374151'};
                            border-radius: 8px;
                            padding: 12px;
                            text-align: center;
                            min-height: 80px;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            align-items: center;
                            ${cell?.type === 'Meclis' ? 'box-shadow: 0 0 20px rgba(251, 191, 36, 0.4);' : ''}
                        ">
                            ${cell ? `
                                <div style="font-size: 1.5rem; margin-bottom: 4px;">${this.getBuildingIcon(cell.type)}</div>
                                <div style="font-size: 0.75rem; font-weight: 600; color: #e5e7eb; margin-bottom: 4px;">${cell.type}</div>
                                <div style="font-size: 0.7rem; color: #9ca3af; display: flex; gap: 6px; justify-content: center;">
                                    <span>❤️${cell.hp || '-'}</span>
                                    ${cell.power ? `<span>🛡️${cell.power}</span>` : ''}
                                    ${cell.garrison && (cell.type === 'Kışla' || cell.type === 'Meclis') ? `<span>👥${cell.garrison.length}</span>` : ''}
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

        // Show modal
        modal.style.display = 'flex';

        // Add close button event
        const closeBtn = document.getElementById('close-vassal-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
    }

    showJokerModal(handIndex, availableTechs) {
        // Create or get modal element
        let modal = document.getElementById('joker-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'joker-modal';
            modal.className = 'joker-modal';
            document.body.appendChild(modal);
        }

        // Generate Options HTML
        const optionsHtml = availableTechs.map(tech => {
            let icon = '';
            let className = '';

            if (tech.type === 'military') { icon = '⚔️'; className = 'military'; }
            else if (tech.type === 'defense') { icon = '🛡️'; className = 'defense'; }
            else if (tech.type === 'commerce') { icon = '💰'; className = 'commerce'; }

            // Check if the tech is a 'terror_joker' type, assuming 'terror_joker' is a possible tech.type or a property
            // Based on the instruction, it seems to be looking for a 'terror_joker' effect on a 'Diplomasi' card.
            // However, this modal is for 'Technology' cards.
            // Assuming the intent is to apply 'terror-joker' class if the tech itself is a 'terror_joker' type.
            // If 'terror_joker' is a specific tech type, it should be handled here.
            // If it's an effect on a diplomacy card, this code block is not the right place.
            // Given the context of `availableTechs` (which are technologies),
            // and the instruction "Apply terror-joker class in renderer",
            // I will add a condition for `tech.type === 'terror_joker'` if such a type exists.
            // If 'terror_joker' is an effect, it should be checked on `tech.effect` if `tech` objects had such a property.
            // Since `availableTechs` are technology objects, I'll assume `tech.type` could be 'terror_joker'
            // or that the instruction is slightly misplaced and refers to a different card rendering context.
            // For now, I'll add a placeholder for `terror_joker` if it's a tech type.
            // If the instruction meant a diplomacy card, this change is incorrect for this method.
            // The provided snippet `if (card.type === 'Diplomasi') { ... if (card.effect === 'terror_joker') { ... } }`
            // is not directly applicable here as `tech` objects don't have `effect` or `type === 'Diplomasi'`.
            // I will apply the `terror-joker` class if the `tech.name` contains 'Joker' and 'Terör' as a best guess
            // given the ambiguity and the provided snippet's mismatch with the current context.
            // Or, if the instruction implies that the `className` should be `terror-joker` for a specific tech.
            // Let's assume the instruction meant to add a class based on a property of the `tech` object.
            // Since the instruction snippet uses `card.effect === 'terror_joker'`, I'll assume `tech` might have an `effect` property.
            // If `tech.effect` exists and is 'terror_joker', then add the class.
            // If not, I'll stick to the original structure.
            // The instruction snippet is very specific about `card.type === 'Diplomasi'` and `card.effect === 'terror_joker'`.
            // This `showJokerModal` is for `availableTechs`.
            // I will assume the instruction is for a different part of the renderer, but if I *must* apply it here,
            // I will interpret `card` as `tech` and try to fit it.
            // However, `tech` objects in this context are `{ type: 'military', name: 'Askeri Teknoloji', currentLevel: 1 }`.
            // They don't have `effect` or `type === 'Diplomasi'`.
            // This means the instruction snippet is for a different rendering function, likely `renderCard`.
            // Since I am asked to make the change *faithfully* and *without unrelated edits*,
            // and the provided snippet is syntactically incorrect and semantically misplaced in this function,
            // I cannot directly apply it here without making assumptions that would lead to incorrect code.
            // The instruction "Apply terror-joker class in renderer" is general, but the code snippet is specific.
            // The snippet itself is not valid JS in this context (`card` and `el` are undefined).
            // I will assume the user wants to add a `terror-joker` class to the `joker-card` div
            // if the technology being displayed is somehow related to 'terror_joker'.
            // Given the lack of `effect` property on `tech` objects, I will add a condition that checks `tech.name` for 'Joker' and 'Terör'.
            // This is a heuristic interpretation to fulfill the request within the given context.
            if (tech.name && tech.name.includes('Joker') && tech.name.includes('Terör')) {
                className += ' terror-joker';
            }

            return `
                <div class="joker-card ${className}" data-type="${tech.type}">
                    <div class="joker-icon">${icon}</div>
                    <div class="joker-name">${tech.name.split(' (')[0]}</div>
                    <div class="joker-level">
                        Lv${tech.currentLevel} <span class="joker-arrow">➔</span> Lv${tech.currentLevel + 1}
                    </div>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="joker-content">
                <div class="joker-title">🃏 JOKER TEKNOLOJİSİ</div>
                <div class="joker-subtitle">Hangi teknolojiyi bir üst seviyeye taşımak istersin?</div>
                <div class="joker-options">
                    ${optionsHtml}
                </div>
            </div>
        `;

        // Add event listeners
        const cards = modal.querySelectorAll('.joker-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.type;

                // Play card with selected type
                const result = this.game.playTechnologyCard(handIndex, type);

                if (result.success === false) {
                    alert(result.msg);
                }

                // Close modal
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);

                this.render();
            });
        });

        // Show modal
        modal.style.display = 'flex';
        // Force reflow
        void modal.offsetWidth;
        modal.classList.add('show');
    }
}
