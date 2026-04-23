// Enhanced Bot AI Module - Strategic gameplay with attacks and diplomacy
export class BotAI {
    constructor(game) {
        this.game = game;
    }

    // Main bot turn execution
    async executeTurn(player) {
        console.log(`🤖 Bot ${player.name} starting turn`);
        console.log(`  Actions: ${player.actionsRemaining}, Gold: ${player.gold}, DP: ${player.dp}`);

        try {
            this.showBotThinking(player.name);

            // Phase 0.5: Declare independence if vassal and conditions met
            if (player.isVassal) {
                console.log('⛓️ Phase 0.5: Independence check...');
                const result = this.game.declareIndependence?.();
                if (result && result.success) {
                    this.game.log(`🤖 ${player.name} bağımsızlığını ilan etti!`);
                    await this.delay(500);
                }
            }

            // Phase 1: Buy cards strategically
            console.log('🛒 Phase 1: Buying cards...');
            await this.delay(600);
            await this.buyCardsStrategic(player);

            // Phase 1.5: Food emergency — buy Çiftlik if food deficit
            console.log('🌾 Phase 1.5: Food check...');
            await this.buyFoodIfNeeded(player);

            // Phase 2: Play diplomacy cards
            console.log('🎭 Phase 2: Playing diplomacy cards...');
            await this.delay(500);
            await this.playDiplomacyCards(player);

            // Phase 3: Play buildings
            console.log('🏗️ Phase 3: Playing buildings...');
            await this.delay(500);
            await this.playBuildings(player);

            // Phase 3.5: Play technology cards
            console.log('🔬 Phase 3.5: Technology cards...');
            await this.delay(400);
            await this.playTechCards(player);

            // Phase 4: Play soldiers
            console.log('⚔️ Phase 4: Playing soldiers...');
            await this.delay(400);
            await this.playSoldiers(player);

            // Phase 5: Perform attacks (vassal olamaz)
            if (!player.isVassal) {
                console.log('⚔️ Phase 5: Attacking...');
                await this.delay(600);
                await this.performAttacks(player);
            }

            console.log(`✅ Bot ${player.name} finished turn`);
        } catch (error) {
            console.error(`❌ Bot ${player.name} error:`, error);
        } finally {
            this.hideBotThinking();
            // Important: We rely on Game execution flow to handle endTurn, but we are done here.
        }
    }

    // Strategic card buying
    async buyCardsStrategic(player) {
        try {
            const market = this.game.openMarket;
            if (!market || market.length === 0) return;

            const military = this.game.calculateMilitary(player);
            const emptySlots = player.grid.filter(c => c === null).length;

            // Determine strategy based on game state
            let priorities = [];
            if (emptySlots > 3) {
                priorities = ['Bina', 'Asker', 'Diplomasi', 'Teknoloji'];
            } else if (military < 10) {
                priorities = ['Asker', 'Bina', 'Diplomasi', 'Teknoloji'];
            } else {
                priorities = ['Diplomasi', 'Asker', 'Bina', 'Teknoloji'];
            }

            for (const type of priorities) {
                if (player.hand.length >= 5) break;

                for (let i = 0; i < market.length; i++) {
                    const card = market[i];
                    if (!card || card.type !== type) continue;

                    // Don't overspend
                    if (player.gold >= card.cost && player.gold - card.cost >= 2) {
                        try {
                            const result = this.game.buyCard(i);
                            if (result && result.success !== false) {
                                this.game.log(`🤖 ${player.name} ${card.name} satın aldı`);
                                await this.delay(300);
                                break;
                            }
                        } catch (err) {
                            console.error('Buy card error:', err);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('buyCardsStrategic error:', error);
        }
    }

    // Play diplomacy cards
    async playDiplomacyCards(player) {
        try {
            const dipCards = [];
            for (let i = 0; i < player.hand.length; i++) {
                if (player.hand[i] && player.hand[i].type === 'Diplomasi') {
                    dipCards.push({ card: player.hand[i], index: i });
                }
            }

            for (const { card, index } of dipCards) {
                if (player.actionsRemaining < 1) break;

                // Select card
                this.game.selectedCardIndex = index;

                // Determine if card needs target
                // Cards that DON'T need target: gold_boost, military_boost, white_flag
                const needsTarget = card.effect && !['gold_boost', 'military_boost', 'white_flag'].includes(card.effect);

                if (needsTarget) {
                    // Find best target
                    const target = this.selectDiplomacyTarget(player, card.effect);
                    if (target) {
                        try {
                            const result = this.game.playDiplomacyCard(index, target.id);
                            if (result && result.success !== false) {
                                this.game.log(`🤖 ${player.name} ${card.name} oynadı`);
                                await this.delay(500);
                            }
                        } catch (err) {
                            console.error('Play diplomacy card error:', err);
                        }
                    }
                } else {
                    // Cards that don't need target (gold_boost, military_boost)
                    try {
                        const result = this.game.playDiplomacyCard(index, null);
                        if (result && result.success !== false) {
                            this.game.log(`🤖 ${player.name} ${card.name} oynadı`);
                            await this.delay(500);
                        }
                    } catch (err) {
                        console.error('Play diplomacy card error:', err);
                    }
                }
            }

            // Clear selection after playing cards
            this.game.selectedCardIndex = null;
        } catch (error) {
            console.error('playDiplomacyCards error:', error);
            this.game.selectedCardIndex = null;
        }
    }

    // Select target for diplomacy card
    selectDiplomacyTarget(player, effect) {
        const enemies = this.game.players.filter(p =>
            p.id !== player.id &&
            !p.isVassal &&
            p.allianceWith !== player.id
        );

        if (enemies.length === 0) return null;

        switch (effect) {
            case 'steal_card':
                // Target player with most cards
                return enemies.reduce((best, p) =>
                    p.hand.length > best.hand.length ? p : best
                );

            case 'steal_unit':
                // Target player with strongest military
                return enemies.reduce((best, p) => {
                    const pMil = this.game.calculateMilitary(p);
                    const bestMil = this.game.calculateMilitary(best);
                    return pMil > bestMil ? p : best;
                });

            case 'break_alliance':
                // Target strongest alliance
                const alliances = enemies.filter(p => p.allianceWith);
                if (alliances.length === 0) return null;
                return alliances.reduce((best, p) => p.dp > best.dp ? p : best);

            case 'assassination':
                // Target highest DP player
                return enemies.reduce((best, p) => p.dp > best.dp ? p : best);

            default:
                return enemies[0];
        }
    }

    // Play buildings from hand
    async playBuildings(player) {
        try {
            let attempts = 0;
            while (player.actionsRemaining > 0 && attempts < 10) {
                attempts++;

                // Find a building in hand
                let buildingIndex = -1;
                for (let i = 0; i < player.hand.length; i++) {
                    const card = player.hand[i];
                    if (card && card.type === 'Bina') {
                        buildingIndex = i;
                        break;
                    }
                }

                if (buildingIndex === -1) break;

                // Find empty slot
                const emptySlot = player.grid.findIndex(c => c === null);
                if (emptySlot === -1) break;

                try {
                    const cardName = player.hand[buildingIndex].name;
                    this.game.selectedCardIndex = buildingIndex;
                    const result = this.game.buildOnSlot(emptySlot);

                    if (result && result.success !== false) {
                        this.game.log(`🤖 ${player.name} ${cardName} inşa etti`);
                        await this.delay(400);
                    } else {
                        break;
                    }
                } catch (err) {
                    console.error('Place building error:', err);
                    break;
                }
            }
        } catch (error) {
            console.error('playBuildings error:', error);
        }
    }

    // Play soldiers from hand
    async playSoldiers(player) {
        try {
            const hasBarracks = player.grid.some(c => c && c.type === 'Kışla');
            if (!hasBarracks) return;

            let attempts = 0;
            while (player.actionsRemaining > 0 && attempts < 10) {
                attempts++;

                let soldierIndex = -1;
                for (let i = 0; i < player.hand.length; i++) {
                    if (player.hand[i] && player.hand[i].type === 'Asker') {
                        soldierIndex = i;
                        break;
                    }
                }
                if (soldierIndex === -1) break;

                try {
                    const cardName = player.hand[soldierIndex].name;
                    const result = this.game.playAskerCard(soldierIndex);
                    if (result && result.success !== false) {
                        this.game.log(`🤖 ${player.name} ${cardName} konuşlandırdı`);
                        await this.delay(400);
                    } else {
                        break;
                    }
                } catch (err) {
                    console.error('Place soldier error:', err);
                    break;
                }
            }
        } catch (error) {
            console.error('playSoldiers error:', error);
        }
    }

    // Perform attacks on enemies
    async performAttacks(player) {
        try {
            const military = this.game.calculateMilitary(player);

            // Don't attack if too weak
            if (military < 8) {
                console.log('  Bot too weak to attack');
                return;
            }

            // Find potential targets
            const enemies = this.game.players.filter(p =>
                p.id !== player.id &&
                !p.isVassal &&
                p.allianceWith !== player.id
            );

            if (enemies.length === 0) return;

            // Select weakest enemy
            const target = enemies.reduce((weakest, p) => {
                const pMil = this.game.calculateMilitary(p);
                const weakestMil = this.game.calculateMilitary(weakest);
                return pMil < weakestMil ? p : weakest;
            });

            // Find best building to attack
            const targetBuilding = this.selectAttackTarget(target);
            if (!targetBuilding) return;

            // Perform attack while we have actions
            let attackAttempts = 0;
            while (player.actionsRemaining > 0 && attackAttempts < 2) {
                attackAttempts++;

                try {
                    // Activate attack mode
                    this.game.setActionMode('attack');

                    // Initiate attack
                    const attackResult = this.game.initiateAttack(target.id, targetBuilding.index);

                    if (attackResult && attackResult.waitingForDice) {
                        // Wait for dice animation
                        await this.delay(500);

                        // Roll dice and WAIT for calculation
                        const diceResult = await this.game.rollDiceForAttack();

                        if (diceResult && diceResult.success) {
                            this.game.log(`🤖 ${player.name} saldırdı!`);
                            await this.delay(2000); // Wait for result display
                        }
                    }

                    // Clear action mode
                    this.game.clearActionMode();

                } catch (err) {
                    console.error('Attack error:', err);
                    this.game.clearActionMode();
                    break;
                }
            }
        } catch (error) {
            console.error('performAttacks error:', error);
        }
    }

    // Select best building to attack
    selectAttackTarget(enemy) {
        const buildings = [];

        enemy.grid.forEach((cell, index) => {
            if (cell && !cell.isUnit) {
                buildings.push({ cell, index });
            }
        });

        if (buildings.length === 0) return null;

        // Priority: Low HP > High value > Random
        // Avoid Saray unless it's the only option
        const nonSaray = buildings.filter(b => b.cell.type !== 'Saray');
        const targets = nonSaray.length > 0 ? nonSaray : buildings;

        // Find lowest HP building
        return targets.reduce((best, b) => {
            if (!best || b.cell.hp < best.cell.hp) return b;
            return best;
        });
    }

    // Show bot thinking (LOG ONLY - no overlay)
    showBotThinking(botName) {
        // Only log to console and game log, no UI overlay
        this.game.log(`🤖 ${botName} düşünüyor...`);
        console.log(`🤖 ${botName} is thinking...`);
    }

    hideBotThinking() {
        // No overlay to hide anymore
        console.log(`🤖 Bot finished thinking`);
    }

    async playTechCards(player) {
        try {
            const hasSciCenter = player.grid.some(c => c && c.type === 'Bilim Merkezi');
            if (!hasSciCenter) return;

            const scientists = player.grid.reduce((sum, c) => {
                if (c && c.type === 'Bilim Merkezi' && c.garrison) return sum + c.garrison.length;
                return sum;
            }, 0);
            if (scientists < 1) return;

            // Öncelik sırası: yüksek huzursuzlukta gıda, zayıf orduda askeri, yoksa savunma/ticaret
            const unrest = player.unrest || 0;
            const military = this.game.calculateMilitary(player);
            let priority;
            if (unrest >= 4) priority = 'food';
            else if (military < 15) priority = 'military';
            else if (player.technologies.defense < player.technologies.military) priority = 'defense';
            else priority = 'commerce';

            // El kartlarında uygun tech kartını bul
            const techCards = player.hand
                .map((card, index) => ({ card, index }))
                .filter(({ card }) => card.type === 'Teknoloji' && !card.isJoker);

            if (techCards.length === 0) return;

            // Önce öncelikli techType, yoksa herhangi biri
            let target = techCards.find(({ card }) => card.techType === priority);
            if (!target) target = techCards[0];

            if (!target || player.actionsRemaining < 1) return;
            if (scientists < target.card.popCost) return;

            const result = this.game.playTechnologyCard(target.index);
            if (result && result.success !== false) {
                this.game.log(`🤖 ${player.name} ${target.card.name} Lv${target.card.level} araştırdı`);
                await this.delay(400);
            }
        } catch (error) {
            console.error('playTechCards error:', error);
        }
    }

    async buyFoodIfNeeded(player) {
        try {
            if (!this.game.calculateFoodBalance) return;
            const { balance } = this.game.calculateFoodBalance(player);
            const unrest = player.unrest || 0;
            if (balance >= 0 && unrest < 4) return;

            const market = this.game.openMarket;
            for (let i = 0; i < market.length; i++) {
                const card = market[i];
                if (!card || card.name !== 'Çiftlik') continue;
                if (player.gold >= card.cost && player.gold - card.cost >= 1) {
                    const result = this.game.buyCard(i);
                    if (result && result.success !== false) {
                        this.game.log(`🤖 ${player.name} gıda açığı için Çiftlik satın aldı`);
                        await this.delay(300);
                    }
                    break;
                }
            }
        } catch (error) {
            console.error('buyFoodIfNeeded error:', error);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
