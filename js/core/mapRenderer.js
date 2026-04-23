/**
 * MapRenderer — harita.png arka planı üzerinde oyuncu göstergeleri.
 * SVG path / sınır / overlay yok. Yalnızca merkez koordinatlarına
 * yerleştirilen saray, isim, HP barı ve ordu sayısı.
 */
export class MapRenderer {
    constructor(game, svgElement) {
        this.game = game;
        this.svg = svgElement;
        this.selectedTerritory = null;

        // 8 bölge — merkez koordinatları (cx, cy) harita.png üzerinde
        this.territories = [
            { id: 0, cx: 314, cy: 136 },
            { id: 1, cx: 491, cy: 263 },
            { id: 2, cx: 296, cy: 413 },
            { id: 3, cx: 631, cy: 152 },
            { id: 4, cx: 666, cy: 303 },
            { id: 5, cx: 265, cy: 282 },
            { id: 6, cx: 466, cy: 464 },
            { id: 7, cx: 707, cy: 440 }
        ];

        // Komşuluk (saldırı / erişim kontrolü için)
        this.adjacency = {
            0: [1, 2, 3],
            1: [0, 2, 5, 6],
            2: [0, 1, 3, 4, 6],
            3: [0, 2, 4],
            4: [3, 2, 6, 7],
            5: [1, 6],
            6: [2, 3, 4],
            7: [3, 4, 5]
        };

        this._buildSVG();
        this._bindEvents();
    }

    // ─── SVG Yapısı ───────────────────────────────────────────────────────────

    _buildSVG() {
        this.svg.setAttribute('viewBox', '0 0 1000 700');
        this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        this.svg.innerHTML = '';

        // Koyu zemin (harita yüklenmezse)
        const bg = this._el('rect');
        bg.setAttribute('width', '1000'); bg.setAttribute('height', '700');
        bg.setAttribute('fill', '#2a1a0a');
        this.svg.appendChild(bg);

        // Harita arka planı
        const mapImg = this._el('image');
        mapImg.setAttribute('href', '/harita.png');
        mapImg.setAttribute('x', '30');
        mapImg.setAttribute('y', '18');
        mapImg.setAttribute('width', '940');
        mapImg.setAttribute('height', '664');
        mapImg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        mapImg.setAttribute('pointer-events', 'none');
        this.svg.appendChild(mapImg);

        // Bölge katmanı
        this.territoryLayer = this._el('g');
        this.territoryLayer.id = 'territory-layer';
        this.svg.appendChild(this.territoryLayer);

        // Animasyon katmanı
        this.animLayer = this._el('g');
        this.animLayer.id = 'anim-layer';
        this.svg.appendChild(this.animLayer);

        // Bölge grupları
        this.territoryGroups = {};
        this.territories.forEach(t => {
            const g = this._el('g');
            g.id = `territory-group-${t.id}`;
            g.classList.add('territory');
            g.setAttribute('data-territory-id', t.id);
            this.territoryLayer.appendChild(g);
            this.territoryGroups[t.id] = g;
        });
    }

    // ─── Ana Render ───────────────────────────────────────────────────────────

    render() {
        const game = this.game;
        const players = game.players;

        if (game.actionMode && game.actionMode !== 'build') {
            this._toggleHandPanel(false);
            this.selectedTerritory = null;
        }

        this.territories.forEach(t => {
            const owner = players[t.id];
            const g = this.territoryGroups[t.id];
            if (!g) return;
            g.innerHTML = '';

            if (!owner) return;

            const isElim = owner.eliminated;
            const isSelected = this.selectedTerritory === t.id;
            const isActionTarget = this._isActionTarget(t.id);

            // Seçili / hedef durumunda ince halka
            if (isSelected || isActionTarget) {
                const ring = this._el('rect');
                ring.setAttribute('x', t.cx - 36);
                ring.setAttribute('y', t.cy - 50);
                ring.setAttribute('width', '72');
                ring.setAttribute('height', '100');
                ring.setAttribute('rx', '8');
                ring.setAttribute('fill', 'none');
                ring.setAttribute('stroke', isActionTarget ? '#e74c3c' : '#f4d03f');
                ring.setAttribute('stroke-width', '2.5');
                ring.setAttribute('opacity', '0.85');
                ring.setAttribute('pointer-events', 'none');
                if (isActionTarget) ring.classList.add('attack-target-pulse');
                g.appendChild(ring);
            }

            this._renderTerritoryLabel(g, t, owner);
            this._renderBuildings(g, t, owner);
            this._renderHPBar(g, t, owner);
            this._renderArmyCount(g, t, owner);

            // Tıklama alanı — ikon grubunu kaplayan şeffaf rect
            const hit = this._el('rect');
            hit.setAttribute('x', t.cx - 40);
            hit.setAttribute('y', t.cy - 55);
            hit.setAttribute('width', '80');
            hit.setAttribute('height', '110');
            hit.setAttribute('fill', 'transparent');
            hit.setAttribute('stroke', 'none');
            hit.classList.add('territory-shape');
            if (isSelected) hit.classList.add('selected');
            if (isActionTarget) hit.classList.add('attack-target');
            g.appendChild(hit);
        });
    }

    // ─── Gösterge Renderlama ──────────────────────────────────────────────────

    _renderTerritoryLabel(g, t, owner) {
        const lx = t.cx;
        const ly = t.cy - 36;

        const nameStr = owner.eliminated ? `✝ ${owner.name}` : owner.name;
        const charW = nameStr.length * 5.5;

        const bg = this._el('rect');
        bg.setAttribute('x', lx - charW / 2 - 4);
        bg.setAttribute('y', ly - 8);
        bg.setAttribute('width', charW + 8);
        bg.setAttribute('height', 14);
        bg.setAttribute('fill', 'rgba(0,0,0,0.60)');
        bg.setAttribute('rx', '3');
        bg.setAttribute('pointer-events', 'none');
        g.appendChild(bg);

        const name = this._el('text');
        name.setAttribute('x', lx); name.setAttribute('y', ly);
        name.setAttribute('text-anchor', 'middle');
        name.setAttribute('dominant-baseline', 'middle');
        name.setAttribute('fill', owner.eliminated ? '#9ca3af' : '#ffffff');
        name.setAttribute('font-size', '10');
        name.setAttribute('font-weight', '700');
        name.setAttribute('font-family', 'Cinzel, serif');
        name.setAttribute('pointer-events', 'none');
        name.textContent = nameStr;
        g.appendChild(name);
    }

    _renderBuildings(g, t, owner) {
        if (!owner.grid) return;

        // Saray — tam merkez
        const saray = owner.grid[0];
        if (saray) {
            const palaceTxt = this._el('text');
            palaceTxt.setAttribute('x', t.cx);
            palaceTxt.setAttribute('y', t.cy);
            palaceTxt.setAttribute('text-anchor', 'middle');
            palaceTxt.setAttribute('dominant-baseline', 'middle');
            palaceTxt.setAttribute('font-size', '28');
            palaceTxt.textContent = '🏰';
            g.appendChild(palaceTxt);
        }

        // Diğer binalar — sarayın altı
        const others = owner.grid.slice(1).filter(Boolean);
        if (others.length === 0) return;

        const icons = others.slice(0, 12).map(b => this._getBuildingIcon(b.type));
        const cols = 4;
        const gap = 15;
        const startX = t.cx - ((Math.min(icons.length, cols) - 1) * gap) / 2;
        const startY = t.cy + 22;

        icons.forEach((icon, i) => {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const txt = this._el('text');
            txt.setAttribute('x', startX + col * gap);
            txt.setAttribute('y', startY + row * gap);
            txt.setAttribute('text-anchor', 'middle');
            txt.setAttribute('dominant-baseline', 'middle');
            txt.setAttribute('font-size', '11');
            txt.textContent = icon;
            g.appendChild(txt);
        });

        if (others.length > 12) {
            const more = this._el('text');
            more.setAttribute('x', t.cx + 48);
            more.setAttribute('y', t.cy + 22);
            more.setAttribute('text-anchor', 'middle');
            more.setAttribute('fill', 'rgba(200,210,230,0.6)');
            more.setAttribute('font-size', '9');
            more.textContent = `+${others.length - 12}`;
            g.appendChild(more);
        }
    }

    _renderHPBar(g, t, owner) {
        if (!owner.grid) return;
        const saray = owner.grid.find(b => b && b.type === 'Saray');
        if (!saray) return;

        const maxHp = 10;
        const hp = saray.hp || 0;
        const pct = Math.max(0, Math.min(1, hp / maxHp));
        const barW = 72;
        const barH = 5;
        const others = owner.grid.slice(1).filter(Boolean).length;
        const rows = Math.ceil(others / 4);
        const bx = t.cx - barW / 2;
        const by = t.cy + 22 + (rows > 0 ? rows * 15 : 0);

        const bgRect = this._el('rect');
        bgRect.setAttribute('x', bx - 1); bgRect.setAttribute('y', by - 1);
        bgRect.setAttribute('width', barW + 2); bgRect.setAttribute('height', barH + 2);
        bgRect.setAttribute('fill', 'rgba(60,30,5,0.40)');
        bgRect.setAttribute('rx', '2');
        g.appendChild(bgRect);

        const hpColor = pct > 0.6 ? '#4a7c3f' : pct > 0.3 ? '#8b6e14' : '#8b1a1a';
        const fillRect = this._el('rect');
        fillRect.setAttribute('x', bx); fillRect.setAttribute('y', by);
        fillRect.setAttribute('width', Math.max(0, barW * pct));
        fillRect.setAttribute('height', barH);
        fillRect.setAttribute('fill', hpColor);
        fillRect.setAttribute('rx', '2');
        fillRect.classList.add('territory-hp-bar-fill');
        g.appendChild(fillRect);

        const hpText = this._el('text');
        hpText.setAttribute('x', t.cx); hpText.setAttribute('y', by + barH + 9);
        hpText.setAttribute('text-anchor', 'middle');
        hpText.setAttribute('fill', '#3d1c02');
        hpText.setAttribute('font-size', '7.5');
        hpText.setAttribute('font-family', 'Cinzel, serif');
        hpText.textContent = `${hp}/${maxHp}`;
        g.appendChild(hpText);
    }

    _renderArmyCount(g, t, owner) {
        let total = 0;
        if (owner.grid) {
            owner.grid.forEach(cell => {
                if (cell && cell.garrison) total += cell.garrison.length;
            });
        }
        if (total === 0) return;

        const ax = t.cx + 40;
        const ay = t.cy - 8;

        const armyBg = this._el('rect');
        armyBg.setAttribute('x', ax - 15); armyBg.setAttribute('y', ay - 9);
        armyBg.setAttribute('width', '30'); armyBg.setAttribute('height', '14');
        armyBg.setAttribute('fill', '#dcc898');
        armyBg.setAttribute('stroke', '#4a2c0a');
        armyBg.setAttribute('stroke-width', '0.8');
        armyBg.setAttribute('rx', '2');
        g.appendChild(armyBg);

        const armyText = this._el('text');
        armyText.setAttribute('x', ax); armyText.setAttribute('y', ay + 1);
        armyText.setAttribute('text-anchor', 'middle');
        armyText.setAttribute('dominant-baseline', 'middle');
        armyText.setAttribute('fill', '#3d1c02');
        armyText.setAttribute('font-size', '8');
        armyText.setAttribute('font-family', 'Cinzel, serif');
        armyText.setAttribute('font-weight', '700');
        armyText.classList.add('territory-army');
        armyText.textContent = `⚔${total}`;
        g.appendChild(armyText);
    }

    // ─── Tıklama Olayları ─────────────────────────────────────────────────────

    _bindEvents() {
        this.svg.addEventListener('click', (e) => {
            const g = e.target.closest('[data-territory-id]');
            if (!g) return;
            const tId = parseInt(g.getAttribute('data-territory-id'), 10);
            this._handleTerritoryClick(tId, e);
        });
    }

    _handleTerritoryClick(tId, e) {
        const game = this.game;
        const mode = game.actionMode;
        const activePlayer = game.getActivePlayer();
        const activeIdx = game.players.indexOf(activePlayer);

        if (!mode) {
            if (tId === activeIdx) {
                this.selectedTerritory = (this.selectedTerritory === tId) ? null : tId;
                this.render();
                this._toggleHandPanel(this.selectedTerritory !== null);
                if (this.selectedTerritory !== null && this.onTerritorySelect) {
                    this.onTerritorySelect(tId);
                }
            } else {
                this._toggleHandPanel(false);
            }
            return;
        }

        if (mode === 'attack') {
            if (!this._canAttackTerritory(activeIdx, tId)) {
                this._showMapToast('Bu bölgeye saldıramazsın — komşu değil!');
                return;
            }
            const targetPlayer = game.players[tId];
            if (!targetPlayer || targetPlayer === activePlayer) {
                this._showMapToast('Geçersiz hedef!');
                return;
            }
            if (targetPlayer.eliminated) {
                this._showMapToast('Bu krallık zaten devre dışı!');
                return;
            }

            let result = game.initiateAttack(targetPlayer.id, 0);

            if (result && result.requiresConfirmation) {
                if (!confirm(result.msg)) { this.render(); return; }
                result = game.initiateAttack(targetPlayer.id, 0, true);
            }

            if (result && result.success === false) {
                this._showMapToast(result.msg);
                return;
            }

            if (result && result.waitingForDice) {
                if (window.renderer) window.renderer.showDicePrompt();
                return;
            }

            game.clearActionMode();
            this.render();
            return;
        }

        if (mode === 'demolish') {
            if (tId !== activeIdx) {
                this._showMapToast('Yalnızca kendi bölgende yıkım yapabilirsin!');
                return;
            }
            if (this.onDemolishTerritory) this.onDemolishTerritory(tId);
            return;
        }
    }

    _isActionTarget(tId) {
        const game = this.game;
        if (game.actionMode !== 'attack') return false;
        const activePlayer = game.getActivePlayer();
        const activeIdx = game.players.indexOf(activePlayer);
        if (!this._canAttackTerritory(activeIdx, tId)) return false;
        const targetPlayer = game.players[tId];
        return targetPlayer && targetPlayer !== activePlayer && !targetPlayer.eliminated;
    }

    _canAttackTerritory(activeIdx, tId) {
        const game = this.game;
        const activePlayer = game.players[activeIdx];
        const direct = this.adjacency[activeIdx] || [];
        if (direct.includes(tId)) return true;
        for (const neighborId of direct) {
            const neighbor = game.players[neighborId];
            if (neighbor && neighbor.isVassal && neighbor.masterId === activePlayer.id) {
                if ((this.adjacency[neighborId] || []).includes(tId)) return true;
            }
        }
        return false;
    }

    // ─── El Kartı Paneli ──────────────────────────────────────────────────────

    _toggleHandPanel(show) {
        let panel = document.getElementById('map-hand-panel');

        if (!show) {
            if (panel) panel.remove();
            return;
        }

        const game = this.game;
        const player = game.getActivePlayer();
        if (player.isBot) return;

        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'map-hand-panel';
            panel.className = 'map-hand-panel';
            const container = this.svg.parentElement;
            if (container) container.appendChild(panel);
        }

        const CARD_META = {
            'Bina':         { icon: '🏗️', color: '#60a5fa' },
            'Asker':        { icon: '⚔️', color: '#f87171' },
            'Diplomasi':    { icon: '🎭', color: '#a78bfa' },
            'Teknoloji':    { icon: '🔬', color: '#34d399' },
            'Paralı Asker': { icon: '💰', color: '#c084fc' },
        };

        if (player.hand.length === 0) {
            panel.innerHTML = `<div class="mhp-title">🃏 El Kartları</div><div class="mhp-empty">Elinde kart yok</div>`;
            return;
        }

        panel.innerHTML = `<div class="mhp-title">🃏 El Kartları <span class="mhp-count">${player.hand.length}</span></div>`;
        const list = document.createElement('div');
        list.className = 'mhp-list';

        player.hand.forEach((card, idx) => {
            const meta = CARD_META[card.type] || { icon: '🃏', color: '#94a3b8' };
            const el = document.createElement('div');
            el.className = 'mhp-card';
            el.style.borderColor = meta.color + '60';
            el.innerHTML = `
                <span class="mhp-card-icon">${meta.icon}</span>
                <span class="mhp-card-name">${card.name}</span>
                <span class="mhp-card-cost">${card.cost}💰</span>
            `;
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this._useHandCardFromMap(idx, card);
            });
            list.appendChild(el);
        });

        panel.appendChild(list);
    }

    _useHandCardFromMap(handIndex, card) {
        const game = this.game;
        const renderer = window.renderer;

        if (card.type === 'Bina') {
            const result = game.buildBuilding(handIndex);
            if (result.success === false) { this._showMapToast(result.msg); return; }
        } else if (card.type === 'Asker') {
            const result = game.playAskerCard(handIndex);
            if (result.success === false) { this._showMapToast(result.msg); return; }
        } else if (card.type === 'Paralı Asker') {
            const result = game.playMercenaryCard(handIndex);
            if (result.success === false) { this._showMapToast(result.msg); return; }
        } else if (card.type === 'Teknoloji') {
            const result = game.playTechnologyCard(handIndex);
            if (result.success === false) {
                if (result.msg === 'JOKER_SELECTION_NEEDED') {
                    if (renderer) renderer.showJokerModal(result.cardIndex, result.availableTechs);
                } else {
                    this._showMapToast(result.msg);
                }
                return;
            }
        } else if (card.type === 'Diplomasi') {
            const needsTarget = card.effect && card.effect !== 'gold_boost' &&
                card.effect !== 'military_boost' && card.effect !== 'white_flag';
            if (!needsTarget) {
                const result = game.playDiplomacyCard(handIndex, null);
                if (result.success === false) { this._showMapToast(result.msg); return; }
            } else if (game.players.length === 2) {
                const opponent = game.players.find(p => p.id !== game.getActivePlayer().id);
                const result = game.playDiplomacyCard(handIndex, opponent.id);
                if (result.success === false) { this._showMapToast(result.msg); return; }
            } else {
                game.pendingDiplomacyCard = { cardIndex: handIndex, card };
                if (game.onDiplomacyTargetNeeded) game.onDiplomacyTargetNeeded(card.name);
                this._toggleHandPanel(false);
                if (renderer) renderer.render();
                return;
            }
        }

        if (renderer) renderer.render();
        this.render();
        this._toggleHandPanel(true);
    }

    // ─── Toast / Flash / Animasyon ────────────────────────────────────────────

    _showMapToast(msg) {
        let toast = document.getElementById('map-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'map-toast';
            toast.style.cssText = `
                position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
                background: rgba(0,0,0,0.85); color: #fcd34d; padding: 8px 18px;
                border-radius: 8px; font-size: 0.85rem; font-family: Cinzel, serif;
                border: 1px solid rgba(251,191,36,0.3); pointer-events: none;
                z-index: 100; opacity: 0; transition: opacity 0.2s; white-space: nowrap;
            `;
            const container = this.svg.parentElement;
            if (container) container.style.position = 'relative';
            (container || document.body).appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
    }

    getAttackCoords(attackerPlayerId, defenderPlayerId) {
        const game = this.game;
        const attackerIdx = game.players.findIndex(p => p.id === attackerPlayerId);
        const defenderIdx = game.players.findIndex(p => p.id === defenderPlayerId);
        if (attackerIdx === -1 || defenderIdx === -1) return null;
        const at = this.territories[attackerIdx];
        const dt = this.territories[defenderIdx];
        if (!at || !dt) return null;
        return { from: { x: at.cx, y: at.cy }, to: { x: dt.cx, y: dt.cy }, animLayer: this.animLayer };
    }

    flashTerritory(playerIdx, type = 'damage') {
        const g = this.territoryGroups[playerIdx];
        if (!g) return;
        const cls = type === 'damage' ? 'flash-damage' : 'flash-heal';
        g.classList.add(cls);
        setTimeout(() => g.classList.remove(cls), 600);
    }

    // ─── Yardımcılar ──────────────────────────────────────────────────────────

    _el(tag) {
        return document.createElementNS('http://www.w3.org/2000/svg', tag);
    }

    _getBuildingIcon(type) {
        const icons = {
            'Saray': '👑', 'Kışla': '🏰', 'Çarşı': '🏪', 'Çiftlik': '🌾',
            'Araştırma Merkezi': '🔬', 'Tapınak': '⛪', 'Liman': '⚓',
            'Maden': '⛏️', 'Duvar': '🧱', 'Kule': '🗼'
        };
        return icons[type] || '🏗️';
    }

    clearSelection() {
        this.selectedTerritory = null;
        this.render();
    }

    onTerritorySelect = null;
    onDemolishTerritory = null;
}
