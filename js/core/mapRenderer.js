/**
 * MapRenderer — SVG dünya haritası motoru.
 * Sekiz krallık bölgesi, sahiplik renklendirmesi, yapı ikonları,
 * HP barları, ordu göstergesi ve tıklama olayları.
 */
export class MapRenderer {
    constructor(game, svgElement) {
        this.game = game;
        this.svg = svgElement;
        this.selectedTerritory = null;

        // 8 bölge: merkezi bir harita üzerinde eşit dağılım
        // viewBox: 0 0 1000 700
        this.territories = [
            {
                id: 0,
                name: 'Kuzey Krallığı',
                cx: 220, cy: 140,
                path: 'M 80,40 L 370,40 L 380,180 L 310,220 L 180,240 L 90,200 Z',
                labelOffset: { x: 0, y: -10 }
            },
            {
                id: 1,
                name: 'Doğu İmparatorluğu',
                cx: 780, cy: 140,
                path: 'M 630,40 L 920,40 L 910,200 L 820,240 L 690,220 L 620,180 Z',
                labelOffset: { x: 0, y: -10 }
            },
            {
                id: 2,
                name: 'Batı Konfederasyonu',
                cx: 140, cy: 350,
                path: 'M 30,260 L 190,240 L 230,280 L 250,420 L 210,470 L 60,440 L 20,380 Z',
                labelOffset: { x: 0, y: -10 }
            },
            {
                id: 3,
                name: 'Merkez Cumhuriyeti',
                cx: 500, cy: 300,
                path: 'M 310,220 L 460,200 L 540,200 L 690,220 L 700,360 L 610,420 L 500,440 L 390,420 L 300,360 Z',
                labelOffset: { x: 0, y: -10 }
            },
            {
                id: 4,
                name: 'Güney Sultanlığı',
                cx: 500, cy: 590,
                path: 'M 320,480 L 500,460 L 680,480 L 690,580 L 590,660 L 500,680 L 410,660 L 310,580 Z',
                labelOffset: { x: 0, y: 20 }
            },
            {
                id: 5,
                name: 'Doğu Sultanlığı',
                cx: 860, cy: 350,
                path: 'M 810,240 L 970,260 L 980,440 L 940,470 L 790,420 L 750,280 Z',
                labelOffset: { x: 10, y: -10 }
            },
            {
                id: 6,
                name: 'Güneybatı Hanedanı',
                cx: 140, cy: 560,
                path: 'M 30,460 L 200,460 L 240,480 L 250,600 L 160,660 L 40,640 L 20,540 Z',
                labelOffset: { x: 0, y: 20 }
            },
            {
                id: 7,
                name: 'Güneydoğu Hanedanı',
                cx: 860, cy: 560,
                path: 'M 800,460 L 960,480 L 980,640 L 860,660 L 750,600 L 760,480 Z',
                labelOffset: { x: 0, y: 20 }
            }
        ];

        // Bölgeler arası komşuluk (saldırı için)
        this.adjacency = {
            0: [2, 3, 1],
            1: [0, 3, 5],
            2: [0, 3, 6],
            3: [0, 1, 2, 4, 5, 6, 7],
            4: [3, 6, 7],
            5: [1, 3, 7],
            6: [2, 3, 4],
            7: [3, 4, 5]
        };

        this._buildSVG();
        this._bindEvents();
    }

    // ─── SVG Yapısını Oluştur ──────────────────────────────────────────────────

    _buildSVG() {
        this.svg.setAttribute('viewBox', '0 0 1000 700');
        this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        this.svg.innerHTML = '';

        // Arka plan gradient tanımı
        const defs = this._el('defs');
        defs.innerHTML = `
            <radialGradient id="map-bg" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stop-color="#1a2535"/>
                <stop offset="100%" stop-color="#0a0f1a"/>
            </radialGradient>
            <filter id="territory-glow">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
            <filter id="label-shadow">
                <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.8)"/>
            </filter>
        `;
        this.svg.appendChild(defs);

        // Harita arka planı
        const bg = this._el('rect');
        bg.setAttribute('width', '1000');
        bg.setAttribute('height', '700');
        bg.setAttribute('fill', 'url(#map-bg)');
        bg.setAttribute('rx', '12');
        this.svg.appendChild(bg);

        // Dekoratif ızgara
        this._buildGrid();

        // Bölge bağlantı çizgileri (komşuluk)
        this.connectionLayer = this._el('g');
        this.connectionLayer.id = 'connection-layer';
        this.svg.appendChild(this.connectionLayer);
        this._buildConnections();

        // Bölgeler katmanı
        this.territoryLayer = this._el('g');
        this.territoryLayer.id = 'territory-layer';
        this.svg.appendChild(this.territoryLayer);

        // Animasyon katmanı (projes ve patlamalar)
        this.animLayer = this._el('g');
        this.animLayer.id = 'anim-layer';
        this.svg.appendChild(this.animLayer);

        // UI overlay (HP barları, ikonlar)
        this.uiLayer = this._el('g');
        this.uiLayer.id = 'ui-layer';
        this.svg.appendChild(this.uiLayer);

        // Her bölge için grup oluştur
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

    _buildGrid() {
        const grid = this._el('g');
        grid.setAttribute('opacity', '0.04');
        grid.setAttribute('stroke', '#60a5fa');
        grid.setAttribute('stroke-width', '0.5');
        for (let x = 0; x <= 1000; x += 50) {
            const l = this._el('line');
            l.setAttribute('x1', x); l.setAttribute('y1', 0);
            l.setAttribute('x2', x); l.setAttribute('y2', 700);
            grid.appendChild(l);
        }
        for (let y = 0; y <= 700; y += 50) {
            const l = this._el('line');
            l.setAttribute('x1', 0); l.setAttribute('y1', y);
            l.setAttribute('x2', 1000); l.setAttribute('y2', y);
            grid.appendChild(l);
        }
        this.svg.appendChild(grid);
    }

    _buildConnections() {
        const drawn = new Set();
        this.territories.forEach(t => {
            (this.adjacency[t.id] || []).forEach(neighborId => {
                const key = [Math.min(t.id, neighborId), Math.max(t.id, neighborId)].join('-');
                if (drawn.has(key)) return;
                drawn.add(key);
                const neighbor = this.territories[neighborId];
                const line = this._el('line');
                line.setAttribute('x1', t.cx);
                line.setAttribute('y1', t.cy);
                line.setAttribute('x2', neighbor.cx);
                line.setAttribute('y2', neighbor.cy);
                line.setAttribute('stroke', 'rgba(148,163,184,0.15)');
                line.setAttribute('stroke-width', '1.5');
                line.setAttribute('stroke-dasharray', '6 4');
                this.connectionLayer.appendChild(line);
            });
        });
    }

    // ─── Ana Render ───────────────────────────────────────────────────────────

    render() {
        const game = this.game;
        const players = game.players;

        // Her oyuncunun hangi bölgeye sahip olduğunu hesapla
        // players[i].territoryId = i (0-7, oyuncu sayısına göre)
        const ownerMap = {}; // territoryId → player
        players.forEach((p, i) => {
            ownerMap[i] = p;
        });

        this.territories.forEach(t => {
            const owner = ownerMap[t.id];
            const g = this.territoryGroups[t.id];
            if (!g) return;
            g.innerHTML = '';

            if (!owner) {
                this._renderEmptyTerritory(g, t);
                return;
            }

            const isElim = owner.eliminated;
            const isSelected = this.selectedTerritory === t.id;
            const isActionTarget = this._isActionTarget(t.id);
            const color = isElim ? '#4b5563' : owner.color;

            this._renderTerritoryShape(g, t, color, isSelected, isActionTarget, isElim);
            this._renderTerritoryLabel(g, t, owner, color);
            this._renderBuildings(g, t, owner);
            this._renderHPBar(g, t, owner);
            this._renderArmyCount(g, t, owner);
        });
    }

    _renderEmptyTerritory(g, t) {
        const shape = this._el('path');
        shape.setAttribute('d', t.path);
        shape.setAttribute('fill', 'rgba(30,40,60,0.4)');
        shape.setAttribute('stroke', 'rgba(100,120,160,0.2)');
        shape.setAttribute('stroke-width', '1.5');
        shape.setAttribute('rx', '4');
        g.appendChild(shape);

        const label = this._el('text');
        label.setAttribute('x', t.cx);
        label.setAttribute('y', t.cy);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'middle');
        label.setAttribute('fill', 'rgba(100,120,160,0.4)');
        label.setAttribute('font-size', '11');
        label.setAttribute('font-family', 'Cinzel, serif');
        label.textContent = t.name;
        g.appendChild(label);
    }

    _renderTerritoryShape(g, t, color, isSelected, isActionTarget, isElim) {
        // Glow halka (seçili veya hedef ise)
        if (isSelected || isActionTarget) {
            const glow = this._el('path');
            glow.setAttribute('d', t.path);
            glow.setAttribute('fill', 'none');
            glow.setAttribute('stroke', isActionTarget ? '#ef4444' : '#facc15');
            glow.setAttribute('stroke-width', '4');
            glow.setAttribute('opacity', '0.7');
            glow.classList.add('territory-shape');
            if (isActionTarget) glow.classList.add('attack-target-pulse');
            g.appendChild(glow);
        }

        // Ana alan
        const shape = this._el('path');
        shape.setAttribute('d', t.path);
        shape.classList.add('territory-shape');
        if (isActionTarget) shape.classList.add('attack-target');
        if (isSelected) shape.classList.add('selected');

        const alpha = isElim ? '0.15' : '0.25';
        shape.setAttribute('fill', this._hexToRgba(color, parseFloat(alpha)));
        shape.setAttribute('stroke', color);
        shape.setAttribute('stroke-width', isSelected ? '3' : '2');
        shape.setAttribute('filter', 'url(#territory-glow)');
        g.appendChild(shape);

        // İç doku overlay
        const overlay = this._el('path');
        overlay.setAttribute('d', t.path);
        overlay.setAttribute('fill', `url(#map-bg)`);
        overlay.setAttribute('opacity', '0.1');
        overlay.setAttribute('pointer-events', 'none');
        g.appendChild(overlay);
    }

    _renderTerritoryLabel(g, t, owner, color) {
        const labelY = t.cy + t.labelOffset.y - 18;

        // Oyuncu adı
        const name = this._el('text');
        name.setAttribute('x', t.cx + t.labelOffset.x);
        name.setAttribute('y', labelY);
        name.setAttribute('text-anchor', 'middle');
        name.setAttribute('dominant-baseline', 'middle');
        name.setAttribute('fill', color);
        name.setAttribute('font-size', '11');
        name.setAttribute('font-weight', '700');
        name.setAttribute('font-family', 'Cinzel, serif');
        name.setAttribute('filter', 'url(#label-shadow)');
        name.textContent = owner.eliminated ? `✝ ${owner.name}` : owner.name;
        g.appendChild(name);

        // Bölge adı (daha küçük)
        const regionName = this._el('text');
        regionName.setAttribute('x', t.cx + t.labelOffset.x);
        regionName.setAttribute('y', labelY - 14);
        regionName.setAttribute('text-anchor', 'middle');
        regionName.setAttribute('dominant-baseline', 'middle');
        regionName.setAttribute('fill', 'rgba(200,210,230,0.5)');
        regionName.setAttribute('font-size', '8');
        regionName.setAttribute('font-family', 'sans-serif');
        regionName.textContent = t.name.toUpperCase();
        g.appendChild(regionName);
    }

    _renderBuildings(g, t, owner) {
        if (!owner.grid) return;
        const buildings = owner.grid.filter(Boolean);
        if (buildings.length === 0) return;

        // Maksimum 12 ikon göster, 4'er sütun
        const icons = buildings.slice(0, 12).map(b => this._getBuildingIcon(b.type));
        const cols = 4;
        const iconSize = 12;
        const gap = 16;
        const startX = t.cx - ((Math.min(icons.length, cols) - 1) * gap) / 2;
        const startY = t.cy + 8;

        icons.forEach((icon, i) => {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const x = startX + col * gap;
            const y = startY + row * gap;

            const txt = this._el('text');
            txt.setAttribute('x', x);
            txt.setAttribute('y', y);
            txt.setAttribute('text-anchor', 'middle');
            txt.setAttribute('dominant-baseline', 'middle');
            txt.setAttribute('font-size', iconSize);
            txt.textContent = icon;
            g.appendChild(txt);
        });

        // Toplam bina sayısı (> 12 ise)
        if (buildings.length > 12) {
            const more = this._el('text');
            more.setAttribute('x', t.cx + 46);
            more.setAttribute('y', t.cy + 8);
            more.setAttribute('text-anchor', 'middle');
            more.setAttribute('fill', 'rgba(200,210,230,0.6)');
            more.setAttribute('font-size', '9');
            more.textContent = `+${buildings.length - 12}`;
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
        const barW = 80;
        const barH = 6;
        const bx = t.cx - barW / 2;
        const by = t.cy + (owner.grid.filter(Boolean).length > 0 ? 44 : 20);

        // Arka plan
        const bgRect = this._el('rect');
        bgRect.setAttribute('x', bx);
        bgRect.setAttribute('y', by);
        bgRect.setAttribute('width', barW);
        bgRect.setAttribute('height', barH);
        bgRect.setAttribute('fill', 'rgba(0,0,0,0.5)');
        bgRect.setAttribute('rx', '3');
        g.appendChild(bgRect);

        // HP dolgu
        const hpColor = pct > 0.6 ? '#22c55e' : pct > 0.3 ? '#f59e0b' : '#ef4444';
        const fillRect = this._el('rect');
        fillRect.setAttribute('x', bx);
        fillRect.setAttribute('y', by);
        fillRect.setAttribute('width', barW * pct);
        fillRect.setAttribute('height', barH);
        fillRect.setAttribute('fill', hpColor);
        fillRect.setAttribute('rx', '3');
        fillRect.classList.add('territory-hp-bar-fill');
        g.appendChild(fillRect);

        // HP metni
        const hpText = this._el('text');
        hpText.setAttribute('x', t.cx);
        hpText.setAttribute('y', by + barH + 10);
        hpText.setAttribute('text-anchor', 'middle');
        hpText.setAttribute('fill', 'rgba(200,220,255,0.7)');
        hpText.setAttribute('font-size', '8');
        hpText.setAttribute('font-family', 'sans-serif');
        hpText.textContent = `❤️ ${hp}/${maxHp}`;
        g.appendChild(hpText);
    }

    _renderArmyCount(g, t, owner) {
        // Toplam asker sayısı
        let total = 0;
        if (owner.grid) {
            owner.grid.forEach(cell => {
                if (!cell) return;
                if (cell.garrison) total += cell.garrison.length;
            });
        }
        if (total === 0) return;

        const ax = t.cx + 36;
        const ay = t.cy - 6;

        const armyBg = this._el('rect');
        armyBg.setAttribute('x', ax - 14);
        armyBg.setAttribute('y', ay - 10);
        armyBg.setAttribute('width', '28');
        armyBg.setAttribute('height', '16');
        armyBg.setAttribute('fill', 'rgba(0,0,0,0.6)');
        armyBg.setAttribute('rx', '4');
        armyBg.setAttribute('stroke', 'rgba(200,200,200,0.2)');
        armyBg.setAttribute('stroke-width', '0.5');
        g.appendChild(armyBg);

        const armyText = this._el('text');
        armyText.setAttribute('x', ax);
        armyText.setAttribute('y', ay + 1);
        armyText.setAttribute('text-anchor', 'middle');
        armyText.setAttribute('dominant-baseline', 'middle');
        armyText.setAttribute('fill', '#fbbf24');
        armyText.setAttribute('font-size', '9');
        armyText.setAttribute('font-family', 'sans-serif');
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

        // Aktif oyuncunun bölge id'si (index bazlı)
        const activeIdx = game.players.indexOf(activePlayer);

        if (!mode) {
            // Seçim modu — kendi bölgeni seç
            if (tId === activeIdx) {
                this.selectedTerritory = (this.selectedTerritory === tId) ? null : tId;
                this.render();
                // Bina inşaatı için panel aç
                if (this.selectedTerritory !== null && this.onTerritorySelect) {
                    this.onTerritorySelect(tId);
                }
            }
            return;
        }

        if (mode === 'attack') {
            // Saldırı hedefi seç — komşu ve düşman olmalı
            const neighbors = this.adjacency[activeIdx] || [];
            if (!neighbors.includes(tId)) {
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

            // Saldırıyı başlat — targetPlayer.id ve Saray slotu (0)
            let result = game.initiateAttack(targetPlayer.id, 0);

            // İttifak ihaneti onayı
            if (result && result.requiresConfirmation) {
                if (!confirm(result.msg)) {
                    this.render();
                    return;
                }
                result = game.initiateAttack(targetPlayer.id, 0, true);
            }

            if (result && result.success === false) {
                this._showMapToast(result.msg);
                return;
            }

            // Zar atma ekranını aç (window.renderer üzerinden)
            if (result && result.waitingForDice) {
                if (window.renderer) window.renderer.showDicePrompt();
                return;
            }

            game.clearActionMode();
            this.render();
            return;
        }

        if (mode === 'demolish') {
            // Sadece kendi bölgeni yık
            if (tId !== activeIdx) {
                this._showMapToast('Yalnızca kendi bölgende yıkım yapabilirsin!');
                return;
            }
            // Yıkım için bina seçim paneli aç
            if (this.onDemolishTerritory) this.onDemolishTerritory(tId);
            return;
        }
    }

    _isActionTarget(tId) {
        const game = this.game;
        if (game.actionMode !== 'attack') return false;
        const activePlayer = game.getActivePlayer();
        const activeIdx = game.players.indexOf(activePlayer);
        const neighbors = this.adjacency[activeIdx] || [];
        if (!neighbors.includes(tId)) return false;
        const targetPlayer = game.players[tId];
        return targetPlayer && targetPlayer !== activePlayer && !targetPlayer.eliminated;
    }

    // ─── Harita Bildirimi ─────────────────────────────────────────────────────

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
                z-index: 100; opacity: 0; transition: opacity 0.2s;
                white-space: nowrap;
            `;
            // SVG parent'ın içindeki overlay container'a ekle
            const container = this.svg.parentElement;
            if (container) container.style.position = 'relative';
            (container || document.body).appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
    }

    // ─── Animasyon Noktaları ──────────────────────────────────────────────────

    /**
     * Saldırı animasyonu için kaynak ve hedef koordinatları döndür.
     * AttackAnimator tarafından kullanılır.
     */
    getAttackCoords(attackerPlayerId, defenderPlayerId) {
        const game = this.game;
        const attackerIdx = game.players.findIndex(p => p.id === attackerPlayerId);
        const defenderIdx = game.players.findIndex(p => p.id === defenderPlayerId);
        if (attackerIdx === -1 || defenderIdx === -1) return null;

        const at = this.territories[attackerIdx];
        const dt = this.territories[defenderIdx];
        if (!at || !dt) return null;

        // SVG viewBox koordinatları
        return {
            from: { x: at.cx, y: at.cy },
            to: { x: dt.cx, y: dt.cy },
            animLayer: this.animLayer
        };
    }

    /**
     * Kısa süre için bölgeyi flash yap (hasar aldığında).
     */
    flashTerritory(playerIdx, type = 'damage') {
        const g = this.territoryGroups[playerIdx];
        if (!g) return;
        const shape = g.querySelector('.territory-shape');
        if (!shape) return;

        const cls = type === 'damage' ? 'flash-damage' : 'flash-heal';
        shape.classList.add(cls);
        setTimeout(() => shape.classList.remove(cls), 600);
    }

    // ─── Yardımcılar ──────────────────────────────────────────────────────────

    _el(tag) {
        return document.createElementNS('http://www.w3.org/2000/svg', tag);
    }

    _hexToRgba(hex, alpha) {
        if (!hex || !hex.startsWith('#')) return `rgba(100,100,150,${alpha})`;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    _getBuildingIcon(type) {
        const icons = {
            'Saray': '👑', 'Kışla': '🏰', 'Çarşı': '🏪', 'Çiftlik': '🌾',
            'Araştırma Merkezi': '🔬', 'Tapınak': '⛪', 'Liman': '⚓',
            'Maden': '⛏️', 'Duvar': '🧱', 'Kule': '🗼'
        };
        return icons[type] || '🏗️';
    }

    // ─── Dış API ──────────────────────────────────────────────────────────────

    /**
     * Seçili bölgeyi temizle ve yeniden render et.
     */
    clearSelection() {
        this.selectedTerritory = null;
        this.render();
    }

    /**
     * Bölge seçim callback'i.
     * renderer.js tarafından atanır: mapRenderer.onTerritorySelect = (id) => { ... }
     */
    onTerritorySelect = null;
    onDemolishTerritory = null;
}
