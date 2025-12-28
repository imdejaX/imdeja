import { Game } from './core/game.js';
import { Renderer } from './core/renderer.js';
import { BotAI } from './core/bot.js';
import { soundManager } from './core/soundManager.js';

document.addEventListener('DOMContentLoaded', () => {
    // Game initialization
    const game = new Game();
    const renderer = new Renderer(game);
    const botAI = new BotAI(game);

    // Make bot, renderer, and sound manager globally accessible
    window.botAI = botAI;
    window.renderer = renderer;
    window.soundManager = soundManager;

    try {
        // Initial render
        game.initializeGame();
        renderer.render();
    } catch (e) {
        console.error("Game Initialization Error:", e);
        alert("Oyun başlatılırken hata oluştu: " + e.message);
    }

    // Resume audio context on first user interaction
    document.addEventListener('click', () => soundManager.resumeContext(), { once: true });

    // UI Event Listeners

    // Sound Toggle Button
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    if (soundToggleBtn) {
        // Set initial state
        soundToggleBtn.textContent = soundManager.isEnabled() ? '🔊' : '🔇';

        soundToggleBtn.addEventListener('click', () => {
            const enabled = soundManager.toggle();
            soundToggleBtn.textContent = enabled ? '🔊' : '🔇';
            soundToggleBtn.title = enabled ? 'Sesi Kapat' : 'Sesi Aç';

            // Play a confirmation sound if turning on
            if (enabled) {
                soundManager.playClick();
            }
        });
    }

    // Home Button
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            soundManager.playClick();
            if (confirm('Ana menüye dönmek istediğinize emin misiniz? (Oyun kaydedilmeyecek)')) {
                window.location.href = 'menu.html';
            }
        });
    }

    // Market Modal
    const marketBtn = document.getElementById('market-btn');
    const marketModal = document.getElementById('market-modal');

    // Helper: Update Refresh Button UI
    function updateRefreshButtonUI() {
        const activePlayer = game.getActivePlayer();
        const refreshBtn = document.getElementById('refresh-market-btn');
        if (!refreshBtn) return;

        // Ensure marketRefreshes is a number
        if (!activePlayer) return;
        if (typeof activePlayer.marketRefreshes !== 'number') {
            activePlayer.marketRefreshes = 0;
        }

        const count = activePlayer.marketRefreshes;
        const remaining = Math.max(0, 2 - count);

        // Update Button Content with Badge
        const badgeClass = remaining === 0 ? 'refresh-badge zero' : 'refresh-badge';
        refreshBtn.innerHTML = `
            <span>🔄 Yenile</span>
            <span class="${badgeClass}">${remaining}</span>
        `;

        refreshBtn.title = `Pazarı Yenile (Kalan Hakkınız: ${remaining})`;

        // Update Button State
        if (count >= 2) {
            refreshBtn.disabled = true;
        } else {
            refreshBtn.disabled = false;
        }
    }

    if (marketBtn && marketModal) {
        marketBtn.addEventListener('click', () => {
            soundManager.playModalOpen();

            // Update player resources display
            const activePlayer = game.getActivePlayer();
            const goldDisplay = document.getElementById('market-player-gold');
            if (goldDisplay && activePlayer) goldDisplay.textContent = activePlayer.gold;

            // Reset refresh button state
            if (activePlayer) updateRefreshButtonUI();

            // Update deck card counts for strategic planning
            const deckCounts = game.getDeckCardCounts();
            document.getElementById('deck-count-bina').textContent = deckCounts['Bina'];
            document.getElementById('deck-count-asker').textContent = deckCounts['Asker'];
            document.getElementById('deck-count-diplomasi').textContent = deckCounts['Diplomasi'];
            document.getElementById('deck-count-teknoloji').textContent = deckCounts['Teknoloji'];

            marketModal.showModal();
        });
    }

    const closeMarketBtn = document.getElementById('close-market-btn');
    if (closeMarketBtn) {
        closeMarketBtn.addEventListener('click', () => {
            soundManager.playModalClose();
            marketModal.close();
        });
    }

    // Refresh Market Button
    const refreshMarketBtn = document.getElementById('refresh-market-btn');
    if (refreshMarketBtn) {
        refreshMarketBtn.addEventListener('click', () => {
            const result = game.refreshMarket();
            if (result.success === false) {
                soundManager.playError();
                alert(result.msg);
            } else {
                soundManager.playMarketRefresh();

                // Update UI after successful refresh
                updateRefreshButtonUI();

                // Re-render market grid
                renderer.render();
            }
        });
    }

    // Close modal on outside click
    if (marketModal) {
        marketModal.addEventListener('click', (e) => {
            if (e.target === marketModal) {
                soundManager.playModalClose();
                marketModal.close();
            }
        });
    }

    // End Turn
    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
        endTurnBtn.addEventListener('click', () => {
            soundManager.playTurnEnd();
            game.endTurn();
            renderer.render();
        });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (marketModal && marketModal.open) {
                soundManager.playModalClose();
                marketModal.close();
            }
            // Close other modals if any
            game.clearActionMode();
            renderer.render();
        }
    });

    console.log("Game initialized with sound effects.");
});
