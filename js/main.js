import { Game } from './core/game.js';
import { Renderer } from './core/renderer.js';
import { MapRenderer } from './core/mapRenderer.js';
import { AttackAnimator } from './core/attackAnimator.js';
import { BotAI } from './core/bot.js';
import { soundManager } from './core/soundManager.js';

document.addEventListener('DOMContentLoaded', () => {
    // ── Oyun Başlatma ───────────────────────────────────────────────────────
    const game = new Game();
    const renderer = new Renderer(game);
    const botAI = new BotAI(game);

    // SVG harita
    const svgEl = document.getElementById('game-map');
    let mapRenderer = null;
    let attackAnimator = null;

    if (svgEl) {
        mapRenderer = new MapRenderer(game, svgEl);
        attackAnimator = new AttackAnimator(mapRenderer);

        // Bölge seçimi → oyuncu kartını vurgula
        mapRenderer.onTerritorySelect = (tId) => {
            renderer.render();
        };

        // Yıkım modu
        mapRenderer.onDemolishTerritory = (tId) => {
            renderer.render();
        };

        // AttackAnimator'ı game'e bağla — combat.js rollDiceForAttack sonrası çağrılacak
        game.onAttackAnimated = async (attackerId, defenderId, result) => {
            if (attackAnimator) await attackAnimator.playAttack(attackerId, defenderId, result);
            if (mapRenderer) mapRenderer.render();
        };
    }

    // Global erişim
    window.botAI = botAI;
    window.renderer = renderer;
    window.mapRenderer = mapRenderer;
    window.soundManager = soundManager;

    try {
        game.initializeGame();
        renderer.render();
        if (mapRenderer) mapRenderer.render();
    } catch (e) {
        console.error('Game Initialization Error:', e);
        alert('Oyun başlatılırken hata oluştu: ' + e.message);
    }

    document.addEventListener('click', () => soundManager.resumeContext(), { once: true });

    // ── Ses Butonu ─────────────────────────────────────────────────────────
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    if (soundToggleBtn) {
        soundToggleBtn.textContent = soundManager.isEnabled() ? '🔊' : '🔇';
        soundToggleBtn.addEventListener('click', () => {
            const enabled = soundManager.toggle();
            soundToggleBtn.textContent = enabled ? '🔊' : '🔇';
            if (enabled) soundManager.playClick();
        });
    }

    // ── Ana Menü ───────────────────────────────────────────────────────────
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            soundManager.playClick();
            if (confirm('Ana menüye dönmek istediğinize emin misiniz? (Oyun kaydedilmeyecek)')) {
                window.location.href = 'menu.html';
            }
        });
    }

    // ── Pazar Modalı ──────────────────────────────────────────────────────
    const marketBtn = document.getElementById('market-btn');
    const marketBackdrop = document.getElementById('market-backdrop');

    function openMarket() {
        const activePlayer = game.getActivePlayer();
        const goldDisplay = document.getElementById('market-player-gold');
        if (goldDisplay && activePlayer) goldDisplay.textContent = activePlayer.gold;

        updateRefreshButtonUI();

        const deckCounts = game.getDeckCardCounts();
        const el = (id) => document.getElementById(id);
        if (el('deck-count-bina')) el('deck-count-bina').textContent = deckCounts['Bina'] ?? 0;
        if (el('deck-count-asker')) el('deck-count-asker').textContent = deckCounts['Asker'] ?? 0;
        if (el('deck-count-diplomasi')) el('deck-count-diplomasi').textContent = deckCounts['Diplomasi'] ?? 0;
        if (el('deck-count-teknoloji')) el('deck-count-teknoloji').textContent = deckCounts['Teknoloji'] ?? 0;

        renderer.renderMarket();
        renderer.renderHand();
        if (marketBackdrop) marketBackdrop.style.display = 'flex';
        soundManager.playModalOpen();
    }

    function closeMarket() {
        if (marketBackdrop) marketBackdrop.style.display = 'none';
        soundManager.playModalClose();
    }

    function updateRefreshButtonUI() {
        const activePlayer = game.getActivePlayer();
        const refreshBtn = document.getElementById('refresh-market-btn');
        if (!refreshBtn || !activePlayer) return;

        if (typeof activePlayer.marketRefreshes !== 'number') activePlayer.marketRefreshes = 0;
        const remaining = Math.max(0, 2 - activePlayer.marketRefreshes);
        const badge = document.getElementById('refresh-badge-count');
        if (badge) badge.textContent = remaining;
        refreshBtn.disabled = remaining === 0;
    }

    if (marketBtn) marketBtn.addEventListener('click', openMarket);

    const closeMarketBtn = document.getElementById('close-market-btn');
    if (closeMarketBtn) closeMarketBtn.addEventListener('click', closeMarket);

    // Backdrop'a tıklayınca kapat
    if (marketBackdrop) {
        marketBackdrop.addEventListener('click', (e) => {
            if (e.target === marketBackdrop) closeMarket();
        });
    }

    const refreshMarketBtn = document.getElementById('refresh-market-btn');
    if (refreshMarketBtn) {
        refreshMarketBtn.addEventListener('click', () => {
            const result = game.refreshMarket();
            if (result.success === false) {
                soundManager.playError();
                alert(result.msg);
            } else {
                soundManager.playMarketRefresh();
                updateRefreshButtonUI();
                renderer.renderMarket();
            }
        });
    }

    // ── Turu Bitir ─────────────────────────────────────────────────────────
    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
        endTurnBtn.addEventListener('click', () => {
            soundManager.playTurnEnd();
            game.endTurn();
            renderer.render();
            if (mapRenderer) mapRenderer.render();
        });
    }

    // ── Eylem İptal Butonu ─────────────────────────────────────────────────
    const cancelActionBtn = document.getElementById('cancel-action-btn');
    if (cancelActionBtn) {
        cancelActionBtn.addEventListener('click', () => {
            game.clearActionMode();
            _updateActionPill(null);
            renderer.render();
            if (mapRenderer) mapRenderer.render();
        });
    }

    // ── Eylem Modu Pill Güncellemesi ───────────────────────────────────────
    const origSetActionMode = game.setActionMode.bind(game);
    game.setActionMode = function(mode) {
        origSetActionMode(mode);
        _updateActionPill(mode);
    };
    const origClearActionMode = game.clearActionMode.bind(game);
    game.clearActionMode = function() {
        origClearActionMode();
        _updateActionPill(null);
        if (mapRenderer) mapRenderer.render();
    };

    function _updateActionPill(mode, extra = '') {
        const pill = document.getElementById('action-mode-pill');
        const text = document.getElementById('action-mode-text');
        if (!pill || !text) return;
        if (!mode) {
            pill.style.display = 'none';
            pill.className = 'action-mode-pill';
            return;
        }
        pill.style.display = 'flex';
        pill.className = 'action-mode-pill ' + mode;
        const labels = {
            attack:   '⚔️ Saldırı modu — haritada hedef seç',
            demolish: '🔨 Yıkım modu — binayı seç',
            build:    `🏗️ ${extra || 'Bina'} seçildi — oyuncu panelinde boş hücreye tıkla`,
            diplo:    `🎭 ${extra || 'Diplomasi'} — oyuncu panelinde hedef oyuncuya tıkla`,
        };
        text.textContent = labels[mode] || mode;
    }

    // Diplomasi kartı hedef beklediğinde: market kapat + pill göster
    game.onDiplomacyTargetNeeded = (cardName) => {
        closeMarket();
        _updateActionPill('diplo', cardName);
    };

    // Diplomasi kartı oynandığında popup göster
    game.onDiplomacyEffect = (data) => {
        if (renderer.showDiplomacyEffect) renderer.showDiplomacyEffect(data);
    };

    // ── Klavye Kısayolları ─────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMarket();
            game.clearActionMode(); // selectedCardIndex ve pendingDiplomacyCard da sıfırlanır
            _updateActionPill(null);
            renderer.render();
            if (mapRenderer) mapRenderer.render();
        }
        if (e.key === 'Enter' && !marketModal?.style.display !== 'none') {
            // Hızlı tur bitir (Shift+Enter)
            if (e.shiftKey) {
                game.endTurn();
                renderer.render();
                if (mapRenderer) mapRenderer.render();
            }
        }
    });

    console.log(`Oyun başlatıldı — ${game.players.length} krallık, harita hazır.`);
});
