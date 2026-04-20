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

        // 8 bölge — antika harita stili, organik şekiller
        // viewBox: 0 0 1000 700
        this.territories = [
            {
                id: 0,
                name: 'Kuzey Krallığı',
                cx: 205, cy: 128,
                path: 'M 52,30 L 148,22 L 248,18 L 338,26 L 382,50 L 392,88 L 378,132 L 348,168 L 295,194 L 238,205 L 178,202 L 122,184 L 75,155 L 46,116 L 40,72 Z',
                labelOffset: { x: 0, y: -8 }
            },
            {
                id: 1,
                name: 'Doğu İmparatorluğu',
                cx: 788, cy: 128,
                path: 'M 618,26 L 718,18 L 818,18 L 905,28 L 948,55 L 958,96 L 946,140 L 914,174 L 862,200 L 800,208 L 736,205 L 678,188 L 642,154 L 624,112 L 618,68 Z',
                labelOffset: { x: 0, y: -8 }
            },
            {
                id: 2,
                name: 'Batı Konfederasyonu',
                cx: 130, cy: 360,
                path: 'M 30,225 L 95,216 L 162,218 L 212,238 L 238,275 L 245,322 L 238,372 L 220,420 L 196,458 L 158,478 L 110,482 L 62,468 L 26,440 L 14,395 L 16,346 L 20,292 Z',
                labelOffset: { x: 0, y: -8 }
            },
            {
                id: 3,
                name: 'Merkez Cumhuriyeti',
                cx: 500, cy: 322,
                path: 'M 305,218 L 392,205 L 462,198 L 538,198 L 608,205 L 690,218 L 728,250 L 738,292 L 732,342 L 715,385 L 688,418 L 644,442 L 582,456 L 500,460 L 418,456 L 356,442 L 312,418 L 284,385 L 265,342 L 260,292 L 270,250 Z',
                labelOffset: { x: 0, y: -8 }
            },
            {
                id: 4,
                name: 'Güney Sultanlığı',
                cx: 500, cy: 572,
                path: 'M 305,475 L 392,465 L 465,460 L 535,460 L 608,465 L 692,475 L 728,506 L 740,548 L 730,592 L 706,628 L 660,652 L 612,666 L 558,672 L 500,674 L 442,672 L 388,666 L 340,652 L 295,628 L 272,592 L 262,548 L 272,506 Z',
                labelOffset: { x: 0, y: 18 }
            },
            {
                id: 5,
                name: 'Doğu Sultanlığı',
                cx: 862, cy: 352,
                path: 'M 752,218 L 835,210 L 910,222 L 956,260 L 974,308 L 975,360 L 960,410 L 934,450 L 895,472 L 844,480 L 794,466 L 756,436 L 738,395 L 735,345 L 740,295 Z',
                labelOffset: { x: 8, y: -8 }
            },
            {
                id: 6,
                name: 'Güneybatı Hanedanı',
                cx: 130, cy: 570,
                path: 'M 26,490 L 96,482 L 162,486 L 218,508 L 242,548 L 240,592 L 218,630 L 178,655 L 128,664 L 75,652 L 32,624 L 14,588 L 16,544 Z',
                labelOffset: { x: 0, y: 18 }
            },
            {
                id: 7,
                name: 'Güneydoğu Hanedanı',
                cx: 858, cy: 568,
                path: 'M 748,482 L 828,474 L 896,482 L 944,510 L 962,552 L 958,596 L 930,634 L 882,658 L 828,668 L 772,656 L 730,628 L 714,590 L 716,548 L 730,512 Z',
                labelOffset: { x: 0, y: 18 }
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

        const defs = this._el('defs');
        defs.innerHTML = `
            <linearGradient id="parchment-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stop-color="#eddcb0"/>
                <stop offset="45%"  stop-color="#e2ce9a"/>
                <stop offset="100%" stop-color="#c9a86c"/>
            </linearGradient>
            <radialGradient id="sea-bg" cx="50%" cy="50%" r="70%">
                <stop offset="0%"   stop-color="#7aafc2"/>
                <stop offset="100%" stop-color="#5a8fa5"/>
            </radialGradient>
            <radialGradient id="vignette" cx="50%" cy="50%" r="72%">
                <stop offset="55%" stop-color="rgba(0,0,0,0)"/>
                <stop offset="100%" stop-color="rgba(60,30,5,0.45)"/>
            </radialGradient>
            <pattern id="sea-lines" x="0" y="0" width="50" height="50"
                     patternUnits="userSpaceOnUse" patternTransform="rotate(25)">
                <line x1="0" y1="0" x2="50" y2="0" stroke="rgba(255,255,255,0.14)" stroke-width="0.6"/>
            </pattern>
            <filter id="label-shadow">
                <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="rgba(255,230,160,0.6)"/>
            </filter>
            <filter id="territory-glow">
                <feGaussianBlur stdDeviation="4" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
        `;
        this.svg.appendChild(defs);

        // Deniz arka planı
        const seaBg = this._el('rect');
        seaBg.setAttribute('width', '1000'); seaBg.setAttribute('height', '700');
        seaBg.setAttribute('fill', 'url(#sea-bg)');
        this.svg.appendChild(seaBg);

        // Deniz çizgi deseni (rhumb lines)
        this._buildGrid();

        // Bölge bağlantı çizgileri
        this.connectionLayer = this._el('g');
        this.connectionLayer.id = 'connection-layer';
        this.svg.appendChild(this.connectionLayer);
        this._buildConnections();

        // Bölgeler katmanı
        this.territoryLayer = this._el('g');
        this.territoryLayer.id = 'territory-layer';
        this.svg.appendChild(this.territoryLayer);

        // Animasyon katmanı
        this.animLayer = this._el('g');
        this.animLayer.id = 'anim-layer';
        this.svg.appendChild(this.animLayer);

        // UI katmanı
        this.uiLayer = this._el('g');
        this.uiLayer.id = 'ui-layer';
        this.svg.appendChild(this.uiLayer);

        // Vignette overlay (üste çizilir, pointer-events yok)
        const vig = this._el('rect');
        vig.setAttribute('width', '1000'); vig.setAttribute('height', '700');
        vig.setAttribute('fill', 'url(#vignette)');
        vig.setAttribute('pointer-events', 'none');
        this.svg.appendChild(vig);

        // Çerçeve
        this._buildBorderFrame();

        // Pusula
        this._buildCompassRose();

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

    _buildGrid() {
        const g = this._el('g');
        g.setAttribute('pointer-events', 'none');
        const r = this._el('rect');
        r.setAttribute('width', '1000'); r.setAttribute('height', '700');
        r.setAttribute('fill', 'url(#sea-lines)');
        g.appendChild(r);
        this.svg.appendChild(g);
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
                line.setAttribute('x1', t.cx); line.setAttribute('y1', t.cy);
                line.setAttribute('x2', neighbor.cx); line.setAttribute('y2', neighbor.cy);
                line.setAttribute('stroke', 'rgba(92,48,18,0.22)');
                line.setAttribute('stroke-width', '1');
                line.setAttribute('stroke-dasharray', '5 7');
                this.connectionLayer.appendChild(line);
            });
        });
    }

    _buildBorderFrame() {
        // Dış çerçeve
        const outer = this._el('rect');
        outer.setAttribute('x', '7'); outer.setAttribute('y', '7');
        outer.setAttribute('width', '986'); outer.setAttribute('height', '686');
        outer.setAttribute('fill', 'none');
        outer.setAttribute('stroke', '#4a2c0a');
        outer.setAttribute('stroke-width', '3');
        outer.setAttribute('pointer-events', 'none');
        this.svg.appendChild(outer);
        // İç çerçeve
        const inner = this._el('rect');
        inner.setAttribute('x', '14'); inner.setAttribute('y', '14');
        inner.setAttribute('width', '972'); inner.setAttribute('height', '672');
        inner.setAttribute('fill', 'none');
        inner.setAttribute('stroke', '#4a2c0a');
        inner.setAttribute('stroke-width', '1');
        inner.setAttribute('opacity', '0.5');
        inner.setAttribute('pointer-events', 'none');
        this.svg.appendChild(inner);
        // Köşe süsleri
        [[7,7],[993,7],[7,693],[993,693]].forEach(([x,y]) => {
            const sq = this._el('rect');
            sq.setAttribute('x', x-4); sq.setAttribute('y', y-4);
            sq.setAttribute('width', '8'); sq.setAttribute('height', '8');
            sq.setAttribute('fill', '#4a2c0a');
            sq.setAttribute('pointer-events', 'none');
            this.svg.appendChild(sq);
        });
    }

    _buildCompassRose() {
        const g = this._el('g');
        g.setAttribute('transform', 'translate(72, 625)');
        g.setAttribute('pointer-events', 'none');
        g.setAttribute('opacity', '0.65');

        // 8 kollu yıldız
        const star = this._el('polygon');
        star.setAttribute('points', '0,-26 4,-4 26,0 4,4 0,26 -4,4 -26,0 -4,-4');
        star.setAttribute('fill', '#4a2c0a');
        g.appendChild(star);

        const inner = this._el('polygon');
        inner.setAttribute('points', '0,-14 2.5,-2.5 14,0 2.5,2.5 0,14 -2.5,2.5 -14,0 -2.5,-2.5');
        inner.setAttribute('fill', '#c9a86c');
        g.appendChild(inner);

        const circle = this._el('circle');
        circle.setAttribute('r', '4'); circle.setAttribute('cx', '0'); circle.setAttribute('cy', '0');
        circle.setAttribute('fill', '#4a2c0a');
        g.appendChild(circle);

        // N etiketi
        const n = this._el('text');
        n.setAttribute('x', '0'); n.setAttribute('y', '-31');
        n.setAttribute('text-anchor', 'middle'); n.setAttribute('font-size', '9');
        n.setAttribute('font-family', 'Cinzel, serif'); n.setAttribute('fill', '#2c1600');
        n.setAttribute('font-weight', '700'); n.textContent = 'N';
        g.appendChild(n);

        this.svg.appendChild(g);
    }

    // ─── Ana Render ───────────────────────────────────────────────────────────

    render() {
        const game = this.game;
        const players = game.players;

        // Saldırı / demolish modundaysa hand panelini kapat
        if (game.actionMode && game.actionMode !== 'build') {
            this._toggleHandPanel(false);
            this.selectedTerritory = null;
        }

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
        shape.setAttribute('fill', '#c4a870');
        shape.setAttribute('stroke', '#7a5028');
        shape.setAttribute('stroke-width', '1.4');
        shape.setAttribute('opacity', '0.45');
        g.appendChild(shape);

        const label = this._el('text');
        label.setAttribute('x', t.cx); label.setAttribute('y', t.cy);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'middle');
        label.setAttribute('fill', '#5c3820');
        label.setAttribute('font-size', '9');
        label.setAttribute('font-family', 'Cinzel, serif');
        label.setAttribute('font-style', 'italic');
        label.setAttribute('opacity', '0.55');
        label.textContent = t.name;
        g.appendChild(label);
    }

    _renderTerritoryShape(g, t, color, isSelected, isActionTarget, isElim) {
        // Seçili / hedef halka
        if (isSelected || isActionTarget) {
            const glow = this._el('path');
            glow.setAttribute('d', t.path);
            glow.setAttribute('fill', 'none');
            glow.setAttribute('stroke', isActionTarget ? '#8b1a1a' : '#5c3012');
            glow.setAttribute('stroke-width', '5');
            glow.setAttribute('opacity', '0.65');
            glow.classList.add('territory-shape');
            if (isActionTarget) glow.classList.add('attack-target-pulse');
            g.appendChild(glow);
        }

        // Parşömen zemin dolgusu
        const base = this._el('path');
        base.setAttribute('d', t.path);
        base.setAttribute('fill', '#dcc898');
        base.setAttribute('stroke', 'none');
        g.appendChild(base);

        // Oyuncu renk tonu (hafif overlay)
        if (color && !isElim) {
            const tint = this._el('path');
            tint.setAttribute('d', t.path);
            tint.setAttribute('fill', color);
            tint.setAttribute('opacity', '0.20');
            tint.setAttribute('pointer-events', 'none');
            g.appendChild(tint);
        }

        // Ana şekil (şeffaf, sadece event yakalamak için)
        const shape = this._el('path');
        shape.setAttribute('d', t.path);
        shape.classList.add('territory-shape');
        if (isActionTarget) shape.classList.add('attack-target');
        if (isSelected) shape.classList.add('selected');
        shape.setAttribute('fill', 'transparent');
        shape.setAttribute('stroke', isElim ? '#8b7355' : '#3d1c02');
        shape.setAttribute('stroke-width', isSelected ? '2.8' : '1.8');
        g.appendChild(shape);
    }

    _renderTerritoryLabel(g, t, owner, color) {
        const lx = t.cx + t.labelOffset.x;
        const ly = t.cy + t.labelOffset.y - 14;

        // Bölge adı — küçük, italic, koyu sepya
        const regionName = this._el('text');
        regionName.setAttribute('x', lx); regionName.setAttribute('y', ly - 12);
        regionName.setAttribute('text-anchor', 'middle');
        regionName.setAttribute('dominant-baseline', 'middle');
        regionName.setAttribute('fill', '#5c3820');
        regionName.setAttribute('font-size', '7.5');
        regionName.setAttribute('font-family', 'Cinzel, serif');
        regionName.setAttribute('font-style', 'italic');
        regionName.setAttribute('opacity', '0.65');
        regionName.textContent = t.name.toUpperCase();
        g.appendChild(regionName);

        // Oyuncu adı — kalın, Cinzel, oyuncu rengi (koyu ton)
        const name = this._el('text');
        name.setAttribute('x', lx); name.setAttribute('y', ly);
        name.setAttribute('text-anchor', 'middle');
        name.setAttribute('dominant-baseline', 'middle');
        name.setAttribute('fill', owner.eliminated ? '#8b7355' : color);
        name.setAttribute('font-size', '10.5');
        name.setAttribute('font-weight', '700');
        name.setAttribute('font-family', 'Cinzel, serif');
        name.setAttribute('filter', 'url(#label-shadow)');
        name.textContent = owner.eliminated ? `✝ ${owner.name}` : owner.name;
        g.appendChild(name);
    }

    _renderBuildings(g, t, owner) {
        if (!owner.grid) return;

        // Saray (index 0) — büyük, ayrı satır
        const saray = owner.grid[0];
        if (saray) {
            const palaceY = t.cy + 4;
            const palaceTxt = this._el('text');
            palaceTxt.setAttribute('x', t.cx);
            palaceTxt.setAttribute('y', palaceY);
            palaceTxt.setAttribute('text-anchor', 'middle');
            palaceTxt.setAttribute('dominant-baseline', 'middle');
            palaceTxt.setAttribute('font-size', '26');
            palaceTxt.textContent = '🏰';
            g.appendChild(palaceTxt);
        }

        // Diğer binalar (index 1+) — küçük, alt satır
        const others = owner.grid.slice(1).filter(Boolean);
        if (others.length === 0) return;

        const icons = others.slice(0, 12).map(b => this._getBuildingIcon(b.type));
        const cols = 4;
        const iconSize = 11;
        const gap = 15;
        const startX = t.cx - ((Math.min(icons.length, cols) - 1) * gap) / 2;
        const startY = t.cy + 20;  // below palace icon

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

        if (others.length > 12) {
            const more = this._el('text');
            more.setAttribute('x', t.cx + 48);
            more.setAttribute('y', t.cy + 20);
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
        const by = t.cy + 20 + (rows > 0 ? rows * 14 : 0);

        // Çerçeve (antika stil)
        const bgRect = this._el('rect');
        bgRect.setAttribute('x', bx - 1); bgRect.setAttribute('y', by - 1);
        bgRect.setAttribute('width', barW + 2); bgRect.setAttribute('height', barH + 2);
        bgRect.setAttribute('fill', 'rgba(60,30,5,0.35)');
        bgRect.setAttribute('rx', '2');
        g.appendChild(bgRect);

        // HP dolgu
        const hpColor = pct > 0.6 ? '#4a7c3f' : pct > 0.3 ? '#8b6e14' : '#8b1a1a';
        const fillRect = this._el('rect');
        fillRect.setAttribute('x', bx); fillRect.setAttribute('y', by);
        fillRect.setAttribute('width', Math.max(0, barW * pct));
        fillRect.setAttribute('height', barH);
        fillRect.setAttribute('fill', hpColor);
        fillRect.setAttribute('rx', '2');
        fillRect.classList.add('territory-hp-bar-fill');
        g.appendChild(fillRect);

        // HP metni (antika koyu)
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
                if (!cell) return;
                if (cell.garrison) total += cell.garrison.length;
            });
        }
        if (total === 0) return;

        const ax = t.cx + 40;
        const ay = t.cy - 8;

        // Parşömen rozet arka planı
        const armyBg = this._el('rect');
        armyBg.setAttribute('x', ax - 15); armyBg.setAttribute('y', ay - 9);
        armyBg.setAttribute('width', '30'); armyBg.setAttribute('height', '14');
        armyBg.setAttribute('fill', '#dcc898');
        armyBg.setAttribute('stroke', '#4a2c0a');
        armyBg.setAttribute('stroke-width', '0.8');
        armyBg.setAttribute('rx', '2');
        g.appendChild(armyBg);

        const armyText = this._el('text');
        armyText.setAttribute('x', ax);
        armyText.setAttribute('y', ay + 1);
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

        // Aktif oyuncunun bölge id'si (index bazlı)
        const activeIdx = game.players.indexOf(activePlayer);

        if (!mode) {
            // Seçim modu — kendi bölgeni seç
            if (tId === activeIdx) {
                this.selectedTerritory = (this.selectedTerritory === tId) ? null : tId;
                this.render();
                // Kendi bölgesine tıklayınca el kartı panelini göster/gizle
                this._toggleHandPanel(this.selectedTerritory !== null);
                if (this.selectedTerritory !== null && this.onTerritorySelect) {
                    this.onTerritorySelect(tId);
                }
            } else {
                // Başka bölgeye tıkladıysa hand panelini kapat
                this._toggleHandPanel(false);
            }
            return;
        }

        if (mode === 'attack') {
            // Saldırı hedefi seç — komşu veya vasal geçiş ile erişilebilir olmalı
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
        if (!this._canAttackTerritory(activeIdx, tId)) return false;
        const targetPlayer = game.players[tId];
        return targetPlayer && targetPlayer !== activePlayer && !targetPlayer.eliminated;
    }

    /**
     * Aktif oyuncunun tId bölgesine saldırıp saldıramayacağını kontrol eder.
     * Doğrudan komşu olduğunda TRUE.
     * Aralarında aktif oyuncunun vasalı varsa da TRUE (vasal geçiş saldırısı).
     */
    _canAttackTerritory(activeIdx, tId) {
        const game = this.game;
        const activePlayer = game.players[activeIdx];
        const direct = this.adjacency[activeIdx] || [];

        // Doğrudan komşu
        if (direct.includes(tId)) return true;

        // Vasal geçiş: komşu bölge aktif oyuncunun vasalıysa, o vasalın komşuları da erişilebilir
        for (const neighborId of direct) {
            const neighbor = game.players[neighborId];
            if (neighbor && neighbor.isVassal && neighbor.masterId === activePlayer.id) {
                const vassalNeighbors = this.adjacency[neighborId] || [];
                if (vassalNeighbors.includes(tId)) return true;
            }
        }

        return false;
    }

    // ─── El Kartı Paneli (harita üzeri) ──────────────────────────────────────

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
            'Bina':        { icon: '🏗️', color: '#60a5fa' },
            'Asker':       { icon: '⚔️', color: '#f87171' },
            'Diplomasi':   { icon: '🎭', color: '#a78bfa' },
            'Teknoloji':   { icon: '🔬', color: '#34d399' },
            'Paralı Asker':{ icon: '💰', color: '#c084fc' },
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
                // Hedef seçimi gerekli
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
