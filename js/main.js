
import { Game } from './core/game.js';
import { Renderer } from './core/renderer.js';
import { BotAI } from './core/bot.js';

// Entry Point
document.addEventListener('DOMContentLoaded', () => {
    console.log("Krallıkların Terazisi Başlatılıyor...");

    // Initialize Core Game
    const game = new Game();
    window.game = game; // Make globally accessible for modal updates

    // Initialize Bot AI
    const botAI = new BotAI(game);
    window.botAI = botAI;

    // Initialize Renderer
    const renderer = new Renderer(game);
    window.renderer = renderer; // Make globally accessible

    // Start Interaction
    game.start();
    renderer.render();

    // Home Button
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            const confirmed = confirm('Oyunu bitirip anasayfaya dönmek istediğinize emin misiniz?');
            if (confirmed) {
                window.location.href = 'menu.html';
            }
        });
    }

    // Market Modal
    const marketModal = document.getElementById('market-modal');
    const marketBtn = document.getElementById('market-btn');
    if (marketBtn && marketModal) {
        marketBtn.addEventListener('click', () => {
            // Update player resources display
            const activePlayer = game.getActivePlayer();
            document.getElementById('market-player-gold').textContent = activePlayer.gold;

            // Calculate capacity
            const farms = activePlayer.grid.filter(c => c && c.type === 'Çiftlik').length;
            const baseCapacity = 2 + (farms * 3);
            const foodTech = activePlayer.technologies.food;
            const techMultipliers = [1, 1.5, 3, 4.5, 6];
            const capacity = Math.floor(baseCapacity * techMultipliers[foodTech]);
            const armyCount = activePlayer.grid.filter(c => c && c.isUnit).length;
            const totalPop = activePlayer.pop + armyCount;

            document.getElementById('market-player-capacity').textContent = `${totalPop}/${capacity}`;

            // Update refresh count and button state
            document.getElementById('market-refresh-count').textContent = activePlayer.marketRefreshesRemaining;

            const refreshBtn = document.getElementById('refresh-market-btn');
            if (activePlayer.marketRefreshesRemaining <= 0) {
                refreshBtn.disabled = true;
                refreshBtn.style.opacity = '0.5';
                refreshBtn.style.cursor = 'not-allowed';
            } else {
                refreshBtn.disabled = false;
                refreshBtn.style.opacity = '1';
                refreshBtn.style.cursor = 'pointer';
            }

            marketModal.showModal();
        });
    }

    document.getElementById('close-market-btn').addEventListener('click', () => {
        marketModal.close();
    });

    // Refresh Market Button
    document.getElementById('refresh-market-btn').addEventListener('click', () => {
        const result = game.refreshMarket();
        if (result.success === false) {
            alert(result.msg);
        } else {
            // Update refresh count
            const activePlayer = game.getActivePlayer();
            document.getElementById('market-refresh-count').textContent = activePlayer.marketRefreshesRemaining;

            // Disable button if no refreshes left
            const refreshBtn = document.getElementById('refresh-market-btn');
            if (activePlayer.marketRefreshesRemaining <= 0) {
                refreshBtn.disabled = true;
                refreshBtn.style.opacity = '0.5';
                refreshBtn.style.cursor = 'not-allowed';
            }

            // Re-render market
            renderer.render();
        }
    });

    // Close modal on outside click
    marketModal.addEventListener('click', (e) => {
        if (e.target === marketModal) {
            marketModal.close();
        }
    });

});
