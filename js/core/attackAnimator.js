/**
 * AttackAnimator — SVG harita üzerinde saldırı animasyonları.
 * Mermi yolu, patlama parçacıkları, yüzen hasar sayıları ve ekran sarsıntısı.
 */
export class AttackAnimator {
    constructor(mapRenderer) {
        this.mapRenderer = mapRenderer;
        this.svg = mapRenderer.svg;
        this.animLayer = mapRenderer.animLayer;
    }

    /**
     * Tam saldırı animasyonu sekansını çalıştır.
     * @param {string} attackerPlayerId
     * @param {string} defenderPlayerId
     * @param {object} result  { success, damage, critical, blocked }
     * @returns {Promise} — animasyon bitince resolve
     */
    async playAttack(attackerPlayerId, defenderPlayerId, result = {}) {
        const coords = this.mapRenderer.getAttackCoords(attackerPlayerId, defenderPlayerId);
        if (!coords) return;

        const { from, to } = coords;

        // 1. Mermi
        await this._animateProjectile(from, to);

        // 2. Patlama
        this._animateExplosion(to);

        // 3. Hasar sayısı
        const defIdx = this.mapRenderer.game.players.findIndex(p => p.id === defenderPlayerId);
        if (result.damage || result.blocked) {
            this._animateFloatingDamage(to, result);
        }

        // 4. Hedef bölge flash
        if (defIdx !== -1) {
            const flashType = result.blocked ? 'heal' : 'damage';
            this.mapRenderer.flashTerritory(defIdx, flashType);
        }

        // 5. Ekran sarsıntısı (başarılı saldırıda)
        if (!result.blocked) {
            this._triggerScreenShake();
        }

        await this._wait(600);
    }

    // ─── Mermi Animasyonu ──────────────────────────────────────────────────────

    _animateProjectile(from, to) {
        return new Promise(resolve => {
            const ns = 'http://www.w3.org/2000/svg';

            // Merkezi yay kontrol noktası (eğri yay için)
            const mx = (from.x + to.x) / 2 + (to.y - from.y) * 0.2;
            const my = (from.y + to.y) / 2 - Math.abs(to.x - from.x) * 0.15;

            // İz çizgisi (soluklaşan)
            const trail = document.createElementNS(ns, 'path');
            const pathD = `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
            trail.setAttribute('d', pathD);
            trail.setAttribute('fill', 'none');
            trail.setAttribute('stroke', 'rgba(251,191,36,0.3)');
            trail.setAttribute('stroke-width', '1.5');
            trail.setAttribute('stroke-dasharray', '4 4');
            trail.classList.add('attack-trail');
            this.animLayer.appendChild(trail);

            // Mermi noktası
            const bullet = document.createElementNS(ns, 'circle');
            bullet.setAttribute('r', '5');
            bullet.setAttribute('fill', '#f59e0b');
            bullet.setAttribute('filter', 'drop-shadow(0 0 6px #fbbf24)');
            bullet.classList.add('attack-projectile');
            this.animLayer.appendChild(bullet);

            // SMIL animasyonu (CSS animation ile uyumlu değil — SVG path üzerinde hareket)
            const anim = document.createElementNS(ns, 'animateMotion');
            anim.setAttribute('dur', '0.7s');
            anim.setAttribute('fill', 'freeze');
            anim.setAttribute('calcMode', 'spline');
            anim.setAttribute('keySplines', '0.4 0 0.6 1');

            const mPath = document.createElementNS(ns, 'mpath');
            // path element'e link (href ile)
            const pathEl = document.createElementNS(ns, 'path');
            pathEl.setAttribute('d', pathD);
            pathEl.id = `proj-path-${Date.now()}`;
            this.animLayer.appendChild(pathEl);

            mPath.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${pathEl.id}`);
            anim.appendChild(mPath);
            bullet.appendChild(anim);

            anim.addEventListener('endEvent', () => {
                bullet.remove();
                trail.remove();
                pathEl.remove();
                resolve();
            }, { once: true });

            // Fallback (SMIL desteklenmiyorsa)
            setTimeout(() => {
                bullet.remove();
                trail.remove();
                pathEl.remove();
                resolve();
            }, 800);
        });
    }

    // ─── Patlama Animasyonu ────────────────────────────────────────────────────

    _animateExplosion(pos) {
        const ns = 'http://www.w3.org/2000/svg';

        // Ana patlama dairesi
        const circle = document.createElementNS(ns, 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);
        circle.setAttribute('r', '6');
        circle.setAttribute('fill', 'rgba(239,68,68,0.9)');
        circle.classList.add('explosion');
        this.animLayer.appendChild(circle);

        // Halka dalgası
        const ring = document.createElementNS(ns, 'circle');
        ring.setAttribute('cx', pos.x);
        ring.setAttribute('cy', pos.y);
        ring.setAttribute('r', '8');
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', 'rgba(251,191,36,0.7)');
        ring.setAttribute('stroke-width', '2');
        ring.classList.add('explosion-ring');
        this.animLayer.appendChild(ring);

        // Parçacıklar
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dist = 20 + Math.random() * 15;
            const px = pos.x + Math.cos(angle) * dist;
            const py = pos.y + Math.sin(angle) * dist;

            const spark = document.createElementNS(ns, 'circle');
            spark.setAttribute('cx', pos.x);
            spark.setAttribute('cy', pos.y);
            spark.setAttribute('r', '2');
            spark.setAttribute('fill', i % 2 === 0 ? '#fbbf24' : '#ef4444');

            const moveAnim = document.createElementNS(ns, 'animate');
            moveAnim.setAttribute('attributeName', 'cx');
            moveAnim.setAttribute('values', `${pos.x};${px}`);
            moveAnim.setAttribute('dur', '0.4s');
            moveAnim.setAttribute('fill', 'freeze');

            const moveAnimY = document.createElementNS(ns, 'animate');
            moveAnimY.setAttribute('attributeName', 'cy');
            moveAnimY.setAttribute('values', `${pos.y};${py}`);
            moveAnimY.setAttribute('dur', '0.4s');
            moveAnimY.setAttribute('fill', 'freeze');

            const fade = document.createElementNS(ns, 'animate');
            fade.setAttribute('attributeName', 'opacity');
            fade.setAttribute('values', '1;0');
            fade.setAttribute('dur', '0.4s');
            fade.setAttribute('fill', 'freeze');

            spark.appendChild(moveAnim);
            spark.appendChild(moveAnimY);
            spark.appendChild(fade);
            this.animLayer.appendChild(spark);
            setTimeout(() => spark.remove(), 450);
        }

        setTimeout(() => {
            circle.remove();
            ring.remove();
        }, 600);
    }

    // ─── Yüzen Hasar Sayısı ────────────────────────────────────────────────────

    _animateFloatingDamage(pos, result) {
        // DOM üzerinde absolute element kullan (SVG foreignObject yerine)
        const svgRect = this.svg.getBoundingClientRect();
        const vb = this.svg.viewBox.baseVal;
        const scaleX = svgRect.width / vb.width;
        const scaleY = svgRect.height / vb.height;

        const screenX = svgRect.left + pos.x * scaleX;
        const screenY = svgRect.top + pos.y * scaleY;

        const el = document.createElement('div');
        el.classList.add('damage-float');

        if (result.blocked) {
            el.classList.add('blocked');
            el.textContent = '🛡️ Bloke!';
        } else if (result.critical) {
            el.classList.add('critical');
            el.textContent = `💥 KRİTİK!`;
        } else if (result.damage) {
            el.classList.add('success');
            el.textContent = `-${result.damage} HP`;
        }

        el.style.left = `${screenX}px`;
        el.style.top = `${screenY}px`;
        document.body.appendChild(el);

        setTimeout(() => el.remove(), 1200);
    }

    // ─── Ekran Sarsıntısı ─────────────────────────────────────────────────────

    _triggerScreenShake() {
        const mapEl = this.svg.closest('#map-container') || document.getElementById('map-container');
        if (!mapEl) return;
        mapEl.classList.add('screen-shake');
        setTimeout(() => mapEl.classList.remove('screen-shake'), 500);
    }

    // ─── Yardımcı ──────────────────────────────────────────────────────────────

    _wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
