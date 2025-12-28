/**
 * Sound Integration Helper
 * Provides simple wrapper functions for adding sounds to renderer
 */

// Add sound effects to renderer prototypes
export function integrateSounds() {
    // This function patches the renderer to add sounds
    // Called after renderer is loaded

    // Store original methods
    const originalBuyCard = window.renderer.game.buyCard.bind(window.renderer.game);
    const originalBuildOnSlot = window.renderer.game.buildOnSlot.bind(window.renderer.game);
    const originalDemolishBuilding = window.renderer.game.demolish Building.bind(window.renderer.game);
    const originalInitiateAttack = window.renderer.game.initiateAttack.bind(window.renderer.game);
    const originalProposeAlliance = window.renderer.game.proposeAlliance.bind(window.renderer.game);
    const originalBreakAlliance = window.renderer.game.breakAlliance.bind(window.renderer.game);
    const originalPlayDiplomacyCard = window.renderer.game.playDiplomacyCard.bind(window.renderer.game);
    const originalPlayTechnologyCard = window.renderer.game.playTechnologyCard.bind(window.renderer.game);

    // Wrap buyCard with sound
    window.renderer.game.buyCard = function (...args) {
        const result = originalBuyCard(...args);
        if (result.success !== false && window.soundManager) {
            window.soundManager.playCardPlay();
        } else if (window.soundManager) {
            window.soundManager.playError();
        }
        return result;
    };

    // Wrap buildOnSlot with sound
    window.renderer.game.buildOnSlot = function (...args) {
        const result = originalBuildOnSlot(...args);
        if (result.success !== false && window.soundManager) {
            window.soundManager.playBuildingPlace();
        }
        return result;
    };

    // Wrap demolishBuilding with sound
    window.renderer.game.demolishBuilding = function (...args) {
        const result = originalDemolishBuilding(...args);
        if (result.success !== false && window.soundManager) {
            window.soundManager.playDemolish();
        } else if (window.soundManager) {
            window.soundManager.playError();
        }
        return result;
    };

    // Wrap initiateAttack with sound
    window.renderer.game.initiateAttack = function (...args) {
        const result = originalInitiateAttack(...args);
        if (result.success !== false && window.soundManager) {
            window.soundManager.playClick();
        } else if (window.soundManager) {
            window.soundManager.playError();
        }
        return result;
    };

    // Wrap proposeAlliance with sound
    window.renderer.game.proposeAlliance = function (...args) {
        const result = originalProposeAlliance(...args);
        if (result.success !== false && window.soundManager) {
            window.soundManager.playAlliance();
        } else if (window.soundManager) {
            window.soundManager.playError();
        }
        return result;
    };

    // Wrap breakAlliance with sound
    window.renderer.game.breakAlliance = function (...args) {
        const result = originalBreakAlliance(...args);
        if (window.soundManager) {
            window.soundManager.playError();
        }
        return result;
    };

    // Wrap playDiplomacyCard with sound
    window.renderer.game.playDiplomacyCard = function (...args) {
        const result = originalPlayDiplomacyCard(...args);
        if (result.success !== false && window.soundManager) {
            window.soundManager.playCardPlay();
        } else if (window.soundManager) {
            window.soundManager.playError();
        }
        return result;
    };

    // Wrap playTechnologyCard with sound
    window.renderer.game.playTechnologyCard = function (...args) {
        const result = originalPlayTechnologyCard(...args);
        if (result.success !== false && window.soundManager) {
            window.soundManager.playSuccess();
        } else if (window.soundManager) {
            window.soundManager.playError();
        }
        return result;
    };

    console.log('Sound effects integrated into game actions');
}
