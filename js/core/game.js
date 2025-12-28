export class Game {
    constructor() {
        this.turn = 1;
        this.phase = "HAZIRLIK";
        this.activePlayerIndex = 0;
        this.selectedCardIndex = null;
        this.pendingAttack = null; // For manual dice rolling
        this.pendingDiplomacyCard = null; // For click-to-target diplomacy cards
        this.gameEnded = false; // Track if game has ended
        this.botTurnInProgress = false; // Prevent bot turn loops

        // Get player count and bot count from localStorage
        const playerCount = parseInt(localStorage.getItem('playerCount')) || 2;
        const botCount = parseInt(localStorage.getItem('botCount')) || 0;

        // Player colors
        const colors = ['#dc2626', '#2563eb', '#059669', '#f59e0b'];
        const names = ['Kızıl Krallık', 'Mavi Krallık', 'Yeşil Krallık', 'Altın Krallık'];

        // Setup Players dynamically
        this.players = [];
        for (let i = 0; i < playerCount; i++) {
            const player = this.createPlayer(i + 1, names[i], colors[i]);
            // Mark last N players as bots
            player.isBot = i >= (playerCount - botCount);
            this.players.push(player);
        }

        this.market = this.createDeck();
        this.openMarket = [];
        this.mercenaryPool = []; // Pool for starving units
        this.refillMarket();

        this.logs = [{ turn: 1, message: "Oyun Başladı!" }];

        // Action mode system
        this.actionMode = null; // 'demolish', 'attack', or null
        this.pendingAttack = null; // Store attack data for dice roll
    }

    initializeGame() {
        this.initializeBoard();
    }

    createPlayer(id, name, color) {
        return {
            id,
            name,
            color,
            gold: 8,
            totalGoldEarned: 8, // Track total gold earned for cap calculation
            pop: 0,
            dp: 1,
            isVassal: false,
            masterId: null,
            allianceWith: null,
            technologies: {
                food: 0,      // Level 0-4
                military: 0,  // Level 0-4
                defense: 0,   // Level 0-4
                commerce: 0   // Level 0-4 (Pazar boost)
            },
            militaryBoost: 0, // Temporary boost from Askeri Gösteri
            whiteFlagTurns: 0, // White flag protection (0 = none, 1-2 = turns remaining)
            marketRefreshes: 0, // Market refreshes used this turn (max 2)
            grid: Array(9).fill(null),
            hand: [],
            actionsRemaining: 2,
            attackedBy: [] // Track who attacked this player this turn
        };
    }

    createDeck() {
        const buildingCards = [
            { name: 'Çiftlik', cost: 3, type: 'Bina', hp: 3, power: 2 },
            { name: 'Kışla', cost: 4, type: 'Bina', hp: 3, power: 3 },
            { name: 'Duvar', cost: 2, type: 'Bina', hp: 4, power: 5 },
            { name: 'Pazar', cost: 3, type: 'Bina', hp: 3, power: 2 },
        ];

        const militaryCards = [
            { name: 'Piyade', cost: 2, type: 'Asker', power: 2 },
            { name: 'Okçu', cost: 3, type: 'Asker', power: 3 },
            { name: 'Süvari', cost: 4, type: 'Asker', power: 4 }
        ];

        const diplomacyCards = [
            { name: 'Casusluk', cost: 3, type: 'Diplomasi', dp: 2, effect: 'steal_card' },
            { name: 'Propaganda', cost: 4, type: 'Diplomasi', dp: 3, effect: 'steal_unit' },
            { name: 'Suikast', cost: 15, type: 'Diplomasi', dp: 8, effect: 'assassination' },
            { name: 'Askeri Gösteri', cost: 3, type: 'Diplomasi', dp: 2, effect: 'military_boost' },
            { name: 'Nifak Tohumu', cost: 15, type: 'Diplomasi', dp: 3, effect: 'break_alliance', minMilitary: 20 },
            { name: 'Beyaz Bayrak (1 Tur)', cost: 3, type: 'Diplomasi', dp: 1, effect: 'white_flag', duration: 1 },
            { name: 'Beyaz Bayrak (2 Tur)', cost: 5, type: 'Diplomasi', dp: 2, effect: 'white_flag', duration: 2 }
        ];

        const technologyCards = [
            // Military Technology (Attack power boost) - BALANCED
            { name: 'Silah I', cost: 5, popCost: 2, type: 'Teknoloji', techType: 'military', level: 1, multiplier: 1.2 },
            { name: 'Silah II', cost: 10, popCost: 3, type: 'Teknoloji', techType: 'military', level: 2, multiplier: 1.5 },
            { name: 'Silah III', cost: 15, popCost: 4, type: 'Teknoloji', techType: 'military', level: 3, multiplier: 2 },
            { name: 'Silah IV', cost: 25, popCost: 5, type: 'Teknoloji', techType: 'military', level: 4, multiplier: 2.5 },

            // Defense Technology (Building HP boost) - BALANCED
            { name: 'Savunma I', cost: 5, popCost: 2, type: 'Teknoloji', techType: 'defense', level: 1, multiplier: 1.2 },
            { name: 'Savunma II', cost: 10, popCost: 3, type: 'Teknoloji', techType: 'defense', level: 2, multiplier: 1.5 },
            { name: 'Savunma III', cost: 15, popCost: 4, type: 'Teknoloji', techType: 'defense', level: 3, multiplier: 2 },
            { name: 'Savunma IV', cost: 25, popCost: 5, type: 'Teknoloji', techType: 'defense', level: 4, multiplier: 2.5 },

            // Commerce Technology (Pazar boost) - NEW
            { name: 'Ticaret I', cost: 5, popCost: 2, type: 'Teknoloji', techType: 'commerce', level: 1, multiplier: 1.5 },
            { name: 'Ticaret II', cost: 10, popCost: 3, type: 'Teknoloji', techType: 'commerce', level: 2, multiplier: 2 },
            { name: 'Ticaret III', cost: 15, popCost: 4, type: 'Teknoloji', techType: 'commerce', level: 3, multiplier: 2.5 },
            { name: 'Ticaret IV', cost: 25, popCost: 5, type: 'Teknoloji', techType: 'commerce', level: 4, multiplier: 3 },

            // Joker Card - SPECIAL: Player chooses which tech to upgrade
            { name: '🃏 Joker', cost: 10, popCost: 2, type: 'Teknoloji', techType: 'joker', level: 0, isJoker: true }
        ];

        let deck = [];

        // Add 15 building cards
        for (let i = 0; i < 15; i++) {
            const template = buildingCards[Math.floor(Math.random() * buildingCards.length)];
            deck.push({ id: `card-${deck.length}`, ...template });
        }

        // Add 20 military cards
        for (let i = 0; i < 20; i++) {
            const template = militaryCards[Math.floor(Math.random() * militaryCards.length)];
            deck.push({ id: `card-${deck.length}`, ...template });
        }

        // Add 18 diplomacy cards (increased from 10 for better strategic card availability)
        for (let i = 0; i < 18; i++) {
            const template = diplomacyCards[Math.floor(Math.random() * diplomacyCards.length)];
            deck.push({ id: `card-${deck.length}`, ...template });
        }

        // Add 8 regular technology cards
        const regularTechCards = technologyCards.filter(c => !c.isJoker);
        for (let i = 0; i < 8; i++) {
            const template = regularTechCards[Math.floor(Math.random() * regularTechCards.length)];
            deck.push({ id: `card-${deck.length}`, ...template });
        }

        // Add 2 Joker cards (rare)
        const jokerCard = technologyCards.find(c => c.isJoker);
        if (jokerCard) {
            deck.push({ id: `card-${deck.length}`, ...jokerCard });
            deck.push({ id: `card-${deck.length}`, ...jokerCard });
        }

        // Shuffle deck
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        return deck;
    }

    refillMarket() {
        // Market now shows 4 cards, one from each type
        if (this.openMarket.length >= 4) return;

        const requiredTypes = ['Bina', 'Asker', 'Diplomasi', 'Teknoloji'];
        const player = this.getActivePlayer();

        // First, ensure we have one card from each type
        for (const type of requiredTypes) {
            // Skip if we already have this type
            if (this.openMarket.some(c => c.type === type)) continue;

            // Find and add a card of this type
            let cardIndex = -1;

            if (type === 'Teknoloji') {
                // For tech cards, apply player-specific filters
                cardIndex = this.market.findIndex(c => {
                    if (c.type !== 'Teknoloji') return false;
                    const currentLevel = player.technologies[c.techType];
                    if (c.level !== currentLevel + 1) return false;
                    const hasInHand = player.hand.some(h =>
                        h.type === 'Teknoloji' &&
                        h.techType === c.techType &&
                        h.level === c.level
                    );
                    return !hasInHand;
                });
            } else {
                // For other types, just find first match
                cardIndex = this.market.findIndex(c => c.type === type);
            }

            if (cardIndex !== -1) {
                const card = this.market.splice(cardIndex, 1)[0];
                this.openMarket.push(card);
            }
        }

        // Fill any remaining empty slots with any available cards
        const maxAttempts = 50;
        let attempts = 0;

        while (this.openMarket.length < 4 && attempts < maxAttempts) {
            attempts++;
            let card = null;

            // 1. Mercenary Pool
            if (this.mercenaryPool.length > 0) {
                card = this.mercenaryPool.pop();
            }
            // 2. Main Deck
            else if (this.market.length > 0) {
                card = this.market.pop();

                // Tech Filters
                if (card.type === 'Teknoloji') {
                    const currentLevel = player.technologies[card.techType];

                    if (card.level !== currentLevel + 1) {
                        this.market.unshift(card);
                        continue;
                    }

                    const hasInHand = player.hand.some(c =>
                        c.type === 'Teknoloji' &&
                        c.techType === card.techType &&
                        c.level === card.level
                    );
                    if (hasInHand) {
                        this.market.unshift(card);
                        continue;
                    }
                }
            }

            if (card) {
                this.openMarket.push(card);
            } else {
                break;
            }
        }

        // Fallback
        if (attempts >= maxAttempts && this.openMarket.length < 4 && this.market.length > 0) {
            console.warn('Market refill strict mode failed, drawing random...');
            while (this.openMarket.length < 4 && this.market.length > 0) {
                this.openMarket.push(this.market.pop());
            }
        }
    }

    refillMarketDeprecated() {
        this.openMarket = []; // Clear current market

        // Slot 1: Always a diplomacy card (reserved)
        const diplomacyCards = this.market.filter(c => c.type === 'Diplomasi');
        if (diplomacyCards.length > 0) {
            const randomDiplomacy = diplomacyCards[Math.floor(Math.random() * diplomacyCards.length)];
            this.openMarket.push({ ...randomDiplomacy }); // Copy card, don't remove from deck
        }

        // Slots 2-3: Random cards from entire deck
        const availableCards = this.market.filter(c => {
            // For technology cards, filter by player's level
            if (c.type === 'Teknoloji') {
                const player = this.getActivePlayer();
                const currentLevel = player.technologies[c.techType];

                // Only show if card level = current level + 1
                if (c.level !== currentLevel + 1) return false;

                // Don't show if already in hand
                const hasInHand = player.hand.some(h =>
                    h.type === 'Teknoloji' &&
                    h.techType === c.techType &&
                    h.level === c.level
                );
                if (hasInHand) return false;
            }
            return true;
        });

        // Add 2 more random cards
        const shuffled = [...availableCards].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 2 && i < shuffled.length; i++) {
            this.openMarket.push({ ...shuffled[i] }); // Copy card
        }

        // If we don't have enough cards, add from mercenary pool
        while (this.openMarket.length < 3 && this.mercenaryPool.length > 0) {
            const merc = this.mercenaryPool[Math.floor(Math.random() * this.mercenaryPool.length)];
            this.openMarket.push({ ...merc });
        }
    }

    refreshMarket() {
        const activePlayer = this.getActivePlayer();

        // Safe initialize
        if (typeof activePlayer.marketRefreshes !== 'number') {
            activePlayer.marketRefreshes = 0;
        }

        // Check refresh limit (2 per turn)
        if (activePlayer.marketRefreshes >= 2) {
            return { success: false, msg: 'Bu turda daha fazla yenileme yapamazsınız! (Maksimum 2)' };
        }

        // Increment refresh counter
        activePlayer.marketRefreshes++;

        // Return current cards to bottom of deck (recycle)
        if (this.openMarket.length > 0) {
            this.market.push(...this.openMarket);
            this.openMarket = [];
        }

        // Refill market with new random cards
        this.refillMarket();

        return { success: true };
    }

    initializeBoard() {
        this.players.forEach(p => {
            p.grid[0] = {
                type: 'Meclis', hp: 10, power: 5, garrison: [
                    { name: 'Sivil', type: 'Nüfus', power: 0 },
                    { name: 'Sivil', type: 'Nüfus', power: 0 },
                    { name: 'Sivil', type: 'Nüfus', power: 0 }
                ]
            }; // Meclis starts with 3 population
            p.grid[1] = { type: 'Çiftlik', hp: 5, power: 1 }; // Starting farm
            p.grid[3] = { type: 'Kışla', hp: 6, power: 2, garrison: [] }; // Military building, tougher
        });
        this.log("Krallıklar kuruldu.");
    }

    start() {
        this.initializeBoard();
    }

    getActivePlayer() {
        return this.players[this.activePlayerIndex];
    }

    getDeckCardCounts() {
        const counts = {
            'Bina': 0,
            'Asker': 0,
            'Diplomasi': 0,
            'Teknoloji': 0
        };

        this.market.forEach(card => {
            if (counts[card.type] !== undefined) {
                counts[card.type]++;
            }
        });

        return counts;
    }

    // checkAutoEndTurn() is defined later in the file (line ~762)
    // Removed duplicate function definition here

    log(msg) {
        // Add turn number to each log entry
        this.logs.unshift({ turn: this.turn, message: msg });
        // No limit - all logs are kept for scrolling
    }

    showGameTip() {
        const tips = [
            "💡 Askeri gücünü artır ve rakibi alt etmeyi dene",
            "💡 Altın kaynaklarını doğru kartlara kullan",
            "💡 Çiftlik ile nüfusunu artır, daha fazla gelir elde et",
            "💡 Kışla her tur otomatik asker üretir",
            "💡 Duvar tüm saldırıları karşılar, önce Duvar'ı yıkmalısın",
            "💡 Pazar her tur +2 altın geliri sağlar",
            "💡 Piyade + Okçu + Süvari + Kışla ile %20 saldırı bonusu kazan",
            "💡 İttifak kurarak güçlü rakiplere karşı korun",
            "💡 Diplomasi kartları strateji için çok önemlidir",
            "💡 Teknoloji kartları uzun vadede güç kazandırır",
            "💡 Meclis'teki sivil sayısını 3'te tut",
            "💡 Düşük HP'li binalara saldırarak kolay yıkım yap",
            "💡 Askeri Gösteri kartı saldırıdan önce oyna",
            "💡 Rakibin Pazar'ını yıkarak gelirini azalt",
            "💡 Rakibin Kışla'sını yıkarak asker üretimini durdur",
            "💡 Vassal olmak yerine direnmek bazen daha iyidir",
            "💡 Altın havuzu doluysa gelir alamazsın, harca!",
            "💡 Nifak Tohumu ile güçlü ittifakları boz",
            "💡 Casusluk ile rakibin kartlarını çal",
            "💡 Propaganda ile rakibin askerlerini ele geçir"
        ];

        const randomTip = tips[Math.floor(Math.random() * tips.length)];
        this.logs.unshift({ turn: this.turn, message: randomTip, isTip: true });
    }

    // Action Mode System
    setActionMode(mode) {
        if (mode === 'attack') {
            // Check for military units before activating attack mode
            const attacker = this.getActivePlayer();
            const attackerMilitary = this.calculateMilitary(attacker);
            if (attackerMilitary === 0) {
                this.log('❌ Saldırı için en az bir asker birimine ihtiyacın var!');
                return { success: false, msg: "Saldırı için en az bir asker birimine ihtiyacın var!" };
            }
        }

        this.actionMode = mode;
        if (mode === 'demolish') {
            this.log('🔨 Yıkma modu aktif - Yıkılacak binayı seç');
        } else if (mode === 'attack') {
            this.log('⚔️ Saldırı modu aktif - Hedef binayı seç');
        }
        return { success: true };
    }

    clearActionMode() {
        this.actionMode = null;
    }


    // --- ACTIONS ---

    buyCard(marketSlotIndex) {
        const player = this.getActivePlayer();

        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };
        if (marketSlotIndex >= this.openMarket.length) return { success: false, msg: "Geçersiz kart." };

        const card = this.openMarket[marketSlotIndex];
        if (player.gold < card.cost) return { success: false, msg: "Yetersiz Altın!" };

        // Execute Transaction
        player.gold -= card.cost;
        player.actionsRemaining -= 1;
        player.hand.push(card);

        // Remove from market and refill
        this.openMarket.splice(marketSlotIndex, 1);
        this.refillMarket();

        this.log(`${player.name}, ${card.name} aldı.`);
        this.checkAutoEndTurn();
        return { success: true };
    }

    selectHandCard(index) {
        if (this.selectedCardIndex === index) {
            this.selectedCardIndex = null; // Deselect
        } else {
            this.selectedCardIndex = index;
        }
    }

    buildOnSlot(slotIndex) {
        const player = this.getActivePlayer();

        if (this.selectedCardIndex === null) return { success: false, msg: "Önce bir kart seçin." };
        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const card = player.hand[this.selectedCardIndex];
        const currentSlot = player.grid[slotIndex];

        // Diplomacy cards are played differently
        if (card.type === 'Diplomasi') {
            // Gain DP
            player.dp += card.dp || 0;
            player.actionsRemaining -= 1;
            player.hand.splice(this.selectedCardIndex, 1);
            this.selectedCardIndex = null;
            this.log(`${player.name}, ${card.name} oynadı! +${card.dp} DP`);

            // TODO: Implement special effects (steal_card, gold_boost, etc.)
            this.checkAutoEndTurn();
            return { success: true };
        }

        // Basic Rules for buildings/units
        if (currentSlot && currentSlot.type !== 'Boş') {
            return { success: false, msg: "Alan dolu!" };
        }

        // Place functionality
        player.grid[slotIndex] = { type: card.name, hp: card.hp || 3, power: card.power || 0, isUnit: card.type === 'Asker' };
        player.actionsRemaining -= 1;

        // Remove card from hand
        player.hand.splice(this.selectedCardIndex, 1);
        this.selectedCardIndex = null;

        this.log(`${player.name}, ${card.name} inşa etti.`);
        this.checkAutoEndTurn();
        return { success: true };
    }

    demolishBuilding(slotIndex) {
        const player = this.getActivePlayer();

        if (player.actionsRemaining < 1) {
            return { success: false, msg: "Aksiyon kalmadı!" };
        }

        const cell = player.grid[slotIndex];

        if (!cell) {
            return { success: false, msg: "Bu konumda bina yok!" };
        }

        if (cell.type === 'Meclis') {
            return { success: false, msg: "Meclis yıkılamaz!" };
        }

        if (cell.isUnit) {
            return { success: false, msg: "Askerler yıkılamaz!" };
        }

        const buildingName = cell.type;
        player.grid[slotIndex] = null;
        player.actionsRemaining -= 1;

        this.log(`🔨 ${player.name}, ${buildingName} binasını yıktı!`);
        this.clearActionMode(); // Clear mode after action
        this.checkAutoEndTurn();
        return { success: true };
    }

    // COMBAT - Two Phase System for Manual Dice Rolling

    // Phase 1: Initiate Attack (Validation only, no dice yet)
    initiateAttack(targetPlayerId, targetSlotIndex) {
        const attacker = this.getActivePlayer();
        const defender = this.players.find(p => p.id === targetPlayerId);

        if (attacker.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };
        if (attacker.id === defender.id) return { success: false, msg: "Kendine saldıramazsın!" };

        // Military check is now done in setActionMode when activating attack mode

        // GLOBAL PEACE: First 3 turns - no attacks allowed
        if (this.turn <= 3) {
            return { success: false, msg: `🏳️ İlk 3 tur barış dönemi! Saldırı yapılamaz. (Tur: ${this.turn}/3)` };
        }

        // WHITE FLAG: Global no-war period - if ANY player has white flag, NO attacks allowed
        const whiteFlagPlayer = this.players.find(p => p.whiteFlagTurns > 0);
        if (whiteFlagPlayer) {
            return { success: false, msg: `🏳️ ${whiteFlagPlayer.name} beyaz bayrak çekti! Kimse saldırı yapamaz. (${whiteFlagPlayer.whiteFlagTurns} tur kaldı)` };
        }


        // Rule: Vassal cannot attack Master
        if (attacker.isVassal && attacker.masterId === defender.id) {
            return { success: false, msg: "Efendine saldıramazsın!" };
        }
        // Rule: Master cannot attack Vassal (Protection)
        if (defender.isVassal && defender.masterId === attacker.id) {
            return { success: false, msg: "Vasalını korumalısın, saldıramazsın!" };
        }

        // NEW RULE: Attacking a vassal = Attacking their master
        // This redirects the attack to the master's kingdom for strategic depth
        if (defender.isVassal && defender.masterId !== attacker.id) {
            const master = this.players.find(p => p.id === defender.masterId);
            if (master) {
                // Find valid targets on master's grid (buildings only, not units)
                const validTargets = master.grid
                    .map((cell, idx) => ({ cell, idx }))
                    .filter(item => item.cell && !item.cell.isUnit);

                if (validTargets.length === 0) {
                    return { success: false, msg: `${defender.name} efendisi ${master.name} tarafından korunuyor, ama hedef bulunamadı!` };
                }

                // Prioritize non-Meclis targets to avoid instant game over
                const nonMeclis = validTargets.filter(t => t.cell.type !== 'Meclis');
                const targetList = nonMeclis.length > 0 ? nonMeclis : validTargets;

                // Select a random building from available targets
                const selectedTarget = targetList[Math.floor(Math.random() * targetList.length)];

                this.log(`⛓️ ${defender.name} bir vassal! Saldırı efendisi ${master.name}'e yönlendirildi!`);

                // Recursively call with master as new target
                return this.initiateAttack(master.id, selectedTarget.idx);
            }
        }

        const targetCell = defender.grid[targetSlotIndex];
        if (!targetCell) return { success: false, msg: "Boş alana saldırılmaz." };

        // Wall Shield System: All attacks automatically redirected to wall first
        const wall = defender.grid.find(c => c && c.type === 'Duvar');
        if (wall && targetCell.type !== 'Duvar') {
            // Auto-redirect to wall
            const wallIndex = defender.grid.findIndex(c => c && c.type === 'Duvar');
            this.log(`🛡️ Duvar tüm saldırıları karşılıyor! Saldırı otomatik olarak Duvar'a yönlendirildi.`);
            // Recursively call with wall as target
            return this.initiateAttack(targetPlayerId, wallIndex);
        }


        // Rule: Cannot attack Meclis if defender has defensive structures
        if (targetCell.type === 'Meclis') {
            const hasDefenses = defender.grid.some(cell =>
                cell && (cell.isUnit || cell.type === 'Duvar' || cell.type === 'Kışla')
            );
            if (hasDefenses) {
                return { success: false, msg: "Önce savunma yapılarını yıkmalısın! (Asker/Duvar/Kışla)" };
            }
        }

        // Calculate military for attack (check already done in setActionMode)
        const attackerMilitary = this.calculateMilitary(attacker);

        // Store pending attack data
        this.pendingAttack = {
            attackerId: attacker.id,
            targetPlayerId,
            targetSlotIndex,
            attackerMilitary
        };

        this.log(`⚔️ ${attacker.name}, ${defender.name}'e saldırı başlattı!`);
        this.log(`🎲 Zar atmak için butona bas...`);

        return { success: true, waitingForDice: true };
    }

    // Phase 2: Roll Dice and Complete Attack
    async rollDiceForAttack() {
        if (!this.pendingAttack) {
            return { success: false, msg: "Bekleyen saldırı yok!" };
        }

        const attacker = this.players.find(p => p.id === this.pendingAttack.attackerId);
        const defender = this.players.find(p => p.id === this.pendingAttack.targetPlayerId);
        const targetSlotIndex = this.pendingAttack.targetSlotIndex;
        const attackerMilitary = this.pendingAttack.attackerMilitary;

        // Consume action
        attacker.actionsRemaining -= 1;

        // Track attack for notification
        if (!defender.attackedBy) defender.attackedBy = []; // Safety check
        // Store attack info with both attacker and defender names AND colors
        const attackInfo = {
            text: `${attacker.name} → ${defender.name}`,
            attackerColor: attacker.color,
            defenderColor: defender.color
        };
        // Check if this attack is already tracked (compare by text)
        if (!defender.attackedBy.some(a => typeof a === 'object' ? a.text === attackInfo.text : a === attackInfo.text)) {
            defender.attackedBy.push(attackInfo);
        }

        // Combat Power Calculation - BALANCED
        const totalMilitaryPower = attackerMilitary;
        const maxAttackPower = Math.ceil(totalMilitaryPower * 0.25); // 25% of total military

        const attackRoll = Math.floor(Math.random() * 6) + 1;
        const defenseRoll = Math.floor(Math.random() * 6) + 1;

        // Store dice results for animation
        this.lastDiceRoll = {
            attacker: attackRoll,
            defender: defenseRoll,
            attackerName: attacker.name,
            defenderName: defender.name
        };

        // Apply military boost if available
        const militaryBonus = attacker.militaryBoost || 0;
        if (militaryBonus > 0) {
            this.log(`✨ Askeri Gösteri bonusu: +${militaryBonus}`);
            attacker.militaryBoost = 0; // Reset after use
        }

        const targetCell = defender.grid[targetSlotIndex];

        // Calculate defender's military power
        const defenderMilitary = this.calculateMilitary(defender);
        const defenderMilitaryBonus = Math.ceil(defenderMilitary * 0.20); // 20% of defender's military

        // Apply Military Technology to attack power
        const militaryTech = attacker.technologies.military;
        const militaryMultipliers = [1, 1.2, 1.5, 2, 2.5]; // Level 0-4
        const techBoostedAttack = Math.floor(maxAttackPower * militaryMultipliers[militaryTech]);

        // Apply Defense Technology to building defense
        const defenseTech = defender.technologies.defense;
        const defenseMultipliers = [1, 1.2, 1.5, 2, 2.5]; // Level 0-4
        const techBoostedDefense = Math.floor((targetCell.power || 0) * defenseMultipliers[defenseTech]);

        const attackPower = techBoostedAttack + attackRoll + militaryBonus;
        const defensePower = techBoostedDefense + defenderMilitaryBonus + defenseRoll;


        // Check for diversity bonus
        const soldierTypes = new Set();
        let hasBarracksForBonus = false;

        attacker.grid.forEach(cell => {
            if (cell && cell.isUnit && cell.name) {
                soldierTypes.add(cell.name);
            }
            if (cell && cell.type === 'Kışla') {
                hasBarracksForBonus = true;
            }
        });

        const hasDiversityBonus = soldierTypes.has('Piyade') &&
            soldierTypes.has('Okçu') &&
            soldierTypes.has('Süvari') &&
            hasBarracksForBonus;

        // Prepare combat calculation data for display
        const attackerBaseCalc = [
            { text: `⚔️ Askeri Güç (%25): ${maxAttackPower}`, color: '#a8dadc' }
        ];

        if (militaryTech > 0) {
            const techBonus = techBoostedAttack - maxAttackPower;
            attackerBaseCalc.push({
                text: `🔬 Silah Teknolojisi Lv${militaryTech} (×${militaryMultipliers[militaryTech]}): +${techBonus}`,
                color: '#4ecdc4'
            });
        }

        if (militaryBonus > 0) {
            attackerBaseCalc.push({
                text: `✨ Askeri Gösteri Bonusu: +${militaryBonus}`,
                color: '#fbbf24'
            });
        }

        if (hasDiversityBonus) {
            attackerBaseCalc.push({
                text: `🎖️ Çeşitlilik Bonusu: +20%`,
                color: '#10b981'
            });
        }

        const defenderBaseCalc = [
            { text: `🏰 Bina Savunması: ${targetCell.power || 0}`, color: '#a8dadc' }
        ];

        if (defenseTech > 0) {
            const techBonus = techBoostedDefense - (targetCell.power || 0);
            defenderBaseCalc.push({
                text: `🛡️ Savunma Teknolojisi Lv${defenseTech} (×${defenseMultipliers[defenseTech]}): +${techBonus}`,
                color: '#4ecdc4'
            });
        }

        defenderBaseCalc.push({
            text: `⚔️ Askeri Bonus (%20): ${defenderMilitaryBonus}`,
            color: '#a8dadc'
        });

        const combatSuccess = attackPower > defensePower;
        const damageDealt = combatSuccess ? (attackPower - defensePower) : 0;

        const combatData = {
            attackerName: attacker.name,
            attackerColor: attacker.color,
            defenderName: defender.name,
            defenderColor: defender.color,
            attackerBaseCalc,
            defenderBaseCalc,
            attackRoll,
            defenseRoll,
            totalAttack: attackPower,
            totalDefense: defensePower,
            result: combatSuccess ? {
                text: `✅ SALDIRI BAŞARILI! (${damageDealt} Hasar)`,
                color: '#10b981',
                success: true
            } : {
                text: `🛡️ SAVUNMA BAŞARILI!`,
                color: '#ef4444',
                success: false
            }
        };

        // Show combat calculation modal and WAIT for it to complete
        await this.showCombatCalculation(combatData);

        this.log(`⚔️ ZAR ATILDI! ${attacker.name} -> ${defender.name}`);
        if (hasDiversityBonus) {
            this.log(`🎖️ Çeşitlilik Bonusu: +20% (Piyade, Okçu, Süvari, Kışla)`);
        }
        if (militaryTech > 0) {
            this.log(`🔬 Silah Teknolojisi Lv${militaryTech}: ×${militaryMultipliers[militaryTech]}`);
        }
        if (defenseTech > 0) {
            this.log(`🛡️ Savunma Teknolojisi Lv${defenseTech}: ×${defenseMultipliers[defenseTech]}`);
        }
        this.log(`Saldırı: ${attackPower} (Askeri %25: ${maxAttackPower}, Tek Bonus: ${techBoostedAttack - maxAttackPower}, Zar: ${attackRoll})`);
        this.log(`Savunma: ${defensePower} (Bina: ${targetCell.power || 0}, Tek Bonus: ${techBoostedDefense - (targetCell.power || 0)}, Askeri %20: ${defenderMilitaryBonus}, Zar: ${defenseRoll})`);

        if (attackPower > defensePower) {
            const damage = attackPower - defensePower;
            targetCell.hp -= damage;

            // Store result for notification (shown after dice animation)
            this.lastAttackResult = {
                success: true,
                damage: damage,
                targetType: targetCell.type,
                destroyed: targetCell.hp <= 0
            };

            if (targetCell.hp <= 0) {
                // Handle building destruction
                // Evacuate garrison soldiers if barracks is destroyed
                if (targetCell.type === 'Kışla' && targetCell.garrison && targetCell.garrison.length > 0) {
                    const garrisonSoldiers = [...targetCell.garrison]; // Copy array
                    this.log(`⚠️ Kışla yıkıldı! ${garrisonSoldiers.length} asker tahliye ediliyor...`);

                    // Step 1: Try to move soldiers to other barracks
                    const otherBarracks = defender.grid.filter(c =>
                        c && c.type === 'Kışla' && c !== targetCell
                    );

                    let evacuatedToBarracks = 0;
                    const remainingSoldiers = [];

                    for (const soldier of garrisonSoldiers) {
                        let placed = false;

                        // Try to place in another barracks
                        for (const barracks of otherBarracks) {
                            if (!barracks.garrison) barracks.garrison = [];
                            if (barracks.garrison.length < 20) { // Max 20 soldiers per barracks
                                barracks.garrison.push(soldier);
                                evacuatedToBarracks++;
                                placed = true;
                                break;
                            }
                        }

                        if (!placed) {
                            remainingSoldiers.push(soldier);
                        }
                    }

                    if (evacuatedToBarracks > 0) {
                        this.log(`✅ ${evacuatedToBarracks} asker diğer Kışla'lara taşındı!`);
                    }

                    // Step 2: Distribute remaining soldiers to attacker (garrison priority)
                    if (remainingSoldiers.length > 0) {
                        const halfCount = Math.ceil(remainingSoldiers.length / 2);
                        const toAttacker = remainingSoldiers.slice(0, halfCount);
                        const toMercenary = remainingSoldiers.slice(halfCount);

                        // Give half to attacker - prioritize garrisons
                        let addedToAttacker = 0;

                        for (const soldier of toAttacker) {
                            let placed = false;

                            // Priority 1: Add to barracks garrison (flexible capacity)
                            const attackerBarracks = attacker.grid.find(c => c && c.type === 'Kışla');
                            if (attackerBarracks) {
                                if (!attackerBarracks.garrison) attackerBarracks.garrison = [];
                                attackerBarracks.garrison.push(soldier);
                                addedToAttacker++;
                                placed = true;
                            }

                            // Priority 2: Add to Piyade unit garrison
                            if (!placed) {
                                const piyadeUnit = attacker.grid.find(c => c && c.isUnit && c.name === 'Piyade');
                                if (piyadeUnit) {
                                    if (!piyadeUnit.garrison) piyadeUnit.garrison = [];
                                    piyadeUnit.garrison.push(soldier);
                                    addedToAttacker++;
                                    placed = true;
                                }
                            }

                            // Priority 3: Add to Okçu unit garrison
                            if (!placed) {
                                const archerUnit = attacker.grid.find(c => c && c.isUnit && c.name === 'Okçu');
                                if (archerUnit) {
                                    if (!archerUnit.garrison) archerUnit.garrison = [];
                                    archerUnit.garrison.push(soldier);
                                    addedToAttacker++;
                                    placed = true;
                                }
                            }

                            // Priority 4: Add to Süvari unit garrison
                            if (!placed) {
                                const cavalryUnit = attacker.grid.find(c => c && c.isUnit && c.name === 'Süvari');
                                if (cavalryUnit) {
                                    if (!cavalryUnit.garrison) cavalryUnit.garrison = [];
                                    cavalryUnit.garrison.push(soldier);
                                    addedToAttacker++;
                                    placed = true;
                                }
                            }

                            // If no garrison available, add to mercenary pool
                            if (!placed) {
                                toMercenary.push(soldier);
                            }
                        }

                        if (addedToAttacker > 0) {
                            this.log(`⚔️ ${addedToAttacker} asker ${attacker.name}'in garnizonuna eklendi!`);
                        }

                        // Send rest to mercenary pool
                        if (toMercenary.length > 0) {
                            for (const soldier of toMercenary) {
                                const mercCard = {
                                    id: `merc-${Date.now()}-${Math.random()}`,
                                    name: soldier.name || 'Okçu',
                                    cost: soldier.cost || 3,
                                    type: 'Asker',
                                    power: soldier.power || 3,
                                    hp: soldier.hp || 4,
                                    isUnit: true
                                };
                                this.mercenaryPool.push(mercCard);
                            }
                            this.log(`🎖️ ${toMercenary.length} asker Pazar'a (serbest asker) döndü!`);
                        }
                    }
                }
                // Check if it was Meclis
                if (targetCell.type === 'Meclis') {
                    defender.grid[targetSlotIndex] = null;
                    this.makeVassal(defender, attacker);
                } else if (targetCell.type === 'Kışla') {
                    // Kışla already handled above (soldier distribution)
                    defender.grid[targetSlotIndex] = null;
                } else {
                    // Other buildings: give 1 gold reward
                    defender.grid[targetSlotIndex] = null;
                    attacker.gold += 1;
                    attacker.totalGoldEarned += 1;
                    this.log(`💰 ${attacker.name} yıkımdan 1 Altın kazandı!`);
                }
            }
        } else {
            // Store result for notification (shown after dice animation)
            this.lastAttackResult = {
                success: false,
                targetType: targetCell.type
            };
        }

        // Clear pending attack
        this.pendingAttack = null;
        this.clearActionMode(); // Clear mode after action

        // Notifications will be shown by renderer after dice animation (2s)
        // Stage 1: Attack start notification (after dice)
        // Stage 2: Attack result notification (after 3s more)

        this.checkAutoEndTurn();
        return { success: true, showDice: true };
    }

    showAttackResultNotification(attackData) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'attack-result-notification';

        // Build gradient background
        const gradient = `linear-gradient(90deg, ${attackData.attackerColor} 0%, ${attackData.attackerColor} 20%, 
                         color-mix(in srgb, ${attackData.attackerColor} 50%, ${attackData.defenderColor} 50%) 50%, 
                         ${attackData.defenderColor} 80%, ${attackData.defenderColor} 100%)`;

        // Build notification content
        const successIcon = attackData.success ? '💥' : '🛡️';
        const resultText = attackData.success ? 'BAŞARILI!' : 'BAŞARISIZ!';
        const destroyedText = attackData.destroyed ? '<div>💀 Yıkıldı!</div>' : '';

        notification.innerHTML = `
            <div class="attack-result-content" style="background: ${gradient}">
                <div class="attack-result-header">
                    ⚔️ ${attackData.attacker} → ${attackData.defender}
                </div>
                <div class="attack-result-details">
                    <div>🎯 Hedef: ${attackData.target}</div>
                    <div>${successIcon} ${resultText} - ${attackData.damage} Hasar</div>
                    <div>🎲 Zar: ${attackData.attackRoll} vs ${attackData.defenseRoll}</div>
                    ${destroyedText}
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showAttackStartNotification(attackData) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'attack-start-notification';

        // Build gradient background
        const gradient = `linear-gradient(90deg, ${attackData.attackerColor} 0%, ${attackData.attackerColor} 20%, 
                         color-mix(in srgb, ${attackData.attackerColor} 50%, ${attackData.defenderColor} 50%) 50%, 
                         ${attackData.defenderColor} 80%, ${attackData.defenderColor} 100%)`;

        notification.innerHTML = `
            <div class="attack-start-content" style="background: ${gradient}">
                <div class="attack-start-header">
                    ⚔️ SALDIRI BAŞLADI!
                </div>
                <div class="attack-start-details">
                    <div>${attackData.attacker} → ${attackData.defender}</div>
                    <div>🎯 Hedef: ${attackData.target}</div>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    async showCombatCalculation(combatData) {
        // Dynamically import combat calculator
        try {
            const { combatCalculator } = await import('./combatCalculator.js');
            await combatCalculator.showCombatCalculation(combatData);
        } catch (error) {
            console.error('Failed to load combat calculator:', error);
        }
    }

    showPropagandaNotification(data) {
        const notification = document.createElement('div');
        notification.className = 'propaganda-notification';

        const gradient = `linear-gradient(90deg, ${data.attackerColor} 0%, ${data.attackerColor} 20%, 
                         color-mix(in srgb, ${data.attackerColor} 50%, ${data.defenderColor} 50%) 50%, 
                         ${data.defenderColor} 80%, ${data.defenderColor} 100%)`;

        notification.innerHTML = `
            <div class="propaganda-content" style="background: ${gradient}">
                <div class="propaganda-header">
                    📢 PROPAGANDA BAŞARILI!
                </div>
                <div class="propaganda-details">
                    <div>${data.attacker} propaganda ile</div>
                    <div>${data.defender}'den ${data.unitName} aldı!</div>
                </div>
            </div>
        `;

        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    makeVassal(vassal, master) {
        vassal.isVassal = true;
        vassal.masterId = master.id;
        vassal.grid[0] = { type: 'Meclis', hp: 5 }; // Rebuild Meclis for them (weakened?) or kept destroyed? 
        // Rule: Rebuild Meclis at 2 HP for Rebellion chance
        vassal.grid[0].hp = 2;

        this.log(`👑 ${vassal.name}, ${master.name} KRALLIĞINA BOYUN EĞDİ!`);
        this.checkWinCondition();
    }

    checkWinCondition() {
        const independentPlayers = this.players.filter(p => !p.isVassal);
        if (independentPlayers.length === 1) {
            const winner = independentPlayers[0];
            // Check if others are their vassals or just dead? (Since no elimination, they must be vassals)
            // But if we have 3 players, 1 is vassal, 2 are free. 
            // Win only if ALL OTHERS are vassals of THIS winner.

            const totalPlayers = this.players.length;
            const myVassals = this.players.filter(p => p.masterId === winner.id);

            if (myVassals.length === totalPlayers - 1) {
                this.log(`🏆 OYUN BİTTİ! ${winner.name} MUTLAK HAKİM!`);
                alert(`${winner.name} KAZANDI!`);
                this.phase = 'SONUÇ'; // End Game State
                this.gameEnded = true;
            }
        }
    }

    checkAutoEndTurn() {
        const player = this.getActivePlayer();
        // Auto-end turn for ALL players when actions reach 0
        if (player.actionsRemaining <= 0) {
            // Clear any existing timer first
            if (this.autoEndTimer) {
                clearTimeout(this.autoEndTimer);
            }
            // Set new timer
            this.autoEndTimer = setTimeout(() => {
                this.autoEndTimer = null;
                this.endTurn();
                window.renderer.render();
            }, 6000); // Wait for dice animation (2s) + attack result notification (3s) + buffer
        }
    }

    endTurn() {
        if (this.phase === 'SONUÇ') return; // Game Over
        if (this.botTurnInProgress) return; // Prevent bot turn loops

        // CRITICAL: Clear any pending auto-end timer
        if (this.autoEndTimer) {
            clearTimeout(this.autoEndTimer);
            this.autoEndTimer = null;
        }

        // Close market modal if open
        const marketModal = document.getElementById('market-modal');
        if (marketModal && marketModal.open) {
            marketModal.close();
        }

        this.selectedCardIndex = null;
        this.clearActionMode(); // Clear action mode on turn end
        this.activePlayerIndex++;
        if (this.activePlayerIndex >= this.players.length) {
            this.activePlayerIndex = 0;
            this.turn++;
            this.distributeIncome();
        }

        // Reset Actions and Refreshes
        const nextPlayer = this.getActivePlayer();

        // DEBUG: Log turn sequence for debugging turn skip issues
        console.log(`🎯 Turn ${this.turn}, Player Index ${this.activePlayerIndex}: ${nextPlayer.name} (Bot: ${nextPlayer.isBot}, Vassal: ${nextPlayer.isVassal})`);

        // VASSAL SYSTEM: If next player is vassal, they get no actions
        if (nextPlayer.isVassal) {
            nextPlayer.actionsRemaining = 0; // Vassals cannot act
            // Vassals cannot buy cards (no refresh limit property needed)

            const master = this.players.find(p => p.id === nextPlayer.masterId);
            if (master && nextPlayer.gold > 0) {
                const transferAmount = nextPlayer.gold;
                master.gold += transferAmount;
                master.totalGoldEarned += transferAmount;
                nextPlayer.gold = 0;
                this.log(`⛓️ ${nextPlayer.name} (Vassal): ${transferAmount} Altın ${master.name}'e aktarıldı.`);
            } else {
                this.log(`⛓️ ${nextPlayer.name} (Vassal): Sıra pas geçildi.`);
            }

            // CRITICAL FIX: Automatically end vassal's turn to continue to next player
            setTimeout(() => {
                this.endTurn();
                window.renderer.render();
            }, 1500); // Short delay to show vassal turn notification
            return; // Exit early to prevent bot check
        } else {
            // Independent players get normal actions
            nextPlayer.actionsRemaining = 2;
            // No refresh limit to reset
        }

        // White flag countdown
        if (nextPlayer.whiteFlagTurns > 0) {
            nextPlayer.whiteFlagTurns--;
            if (nextPlayer.whiteFlagTurns === 0) {
                this.log(`🏳️ ${nextPlayer.name}'in beyaz bayrağı sona erdi!`);
            }
        }

        // Attack notifications now show immediately after each attack (removed turn-end batch system)

        this.log(`${nextPlayer.name} sırası.`);
        this.showGameTip();
        this.showTurnNotification(nextPlayer);

        // If next player is a bot, execute bot turn automatically
        if (nextPlayer.isBot && window.botAI && !this.botTurnInProgress) {
            this.botTurnInProgress = true;

            // Disable end turn button during bot turn
            const endTurnBtn = document.getElementById('end-turn-btn');
            if (endTurnBtn) endTurnBtn.disabled = true;

            // Safety timeout - force end if bot takes too long
            const safetyTimeout = setTimeout(() => {
                console.warn('⚠️ Bot timeout - forcing end');
                this.botTurnInProgress = false;
                if (endTurnBtn) endTurnBtn.disabled = false;
                if (window.botAI) window.botAI.hideBotThinking();
                this.endTurn();
            }, 10000);

            setTimeout(async () => {
                try {
                    await window.botAI.executeTurn(nextPlayer);

                    // Render to show bot's actions
                    window.renderer.render();

                    // Wait before ending bot turn
                    await new Promise(resolve => setTimeout(resolve, 800));

                    // Clear safety timeout
                    clearTimeout(safetyTimeout);

                    // CRITICAL: Reset bot flag BEFORE calling endTurn
                    // This allows consecutive bot turns to work properly
                    this.botTurnInProgress = false;

                    // Re-enable button
                    if (endTurnBtn) endTurnBtn.disabled = false;

                    // End bot turn - this will advance to next player and trigger bot logic if needed
                    this.endTurn();

                    // Render to show new active player
                    window.renderer.render();

                } catch (error) {
                    console.error('Bot turn error:', error);
                    clearTimeout(safetyTimeout);
                    this.botTurnInProgress = false;
                    if (endTurnBtn) endTurnBtn.disabled = false;
                    window.renderer.render();
                }
            }, 1200);
        }
    }

    showTurnNotification(player) {
        // Play turn notification sound
        if (window.soundManager) {
            window.soundManager.playTurnStart();
        }

        // Create notification element if it doesn't exist
        let notification = document.getElementById('turn-notification-popup');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'turn-notification-popup';
            notification.className = 'turn-notification';
            document.body.appendChild(notification);
        }

        // Set notification content with player color
        const playerIcon = player.isBot ? '🤖' : '👑';
        notification.innerHTML = `
            <h2 style="color: ${player.color}; text-shadow: 0 0 20px ${player.color};">
                ${playerIcon} ${player.name}
            </h2>
            <p>Sıra Sizde!</p>
        `;

        // Show notification
        notification.style.display = 'block';
        notification.classList.remove('fade-out');

        // Hide after 2 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.style.display = 'none';
            }, 300);
        }, 2000);
    }

    distributeIncome() {
        this.log("---------------");
        this.log(`TUR ${this.turn} BAŞLADI`);

        this.players.forEach(p => {
            // Reset market refreshes at start of turn
            p.marketRefreshes = 0;

            // 1. Base Income & Farms
            const farms = p.grid.filter(c => c && c.type === 'Çiftlik').length;
            let income = 1 + farms;

            // 1.5. Market Bonus (+1 per Market) × Commerce Tech Multiplier
            const markets = p.grid.filter(c => c && c.type === 'Pazar').length;
            const commerceTech = p.technologies.commerce;
            const commerceMultipliers = [1, 1.5, 2, 2.5, 3]; // Level 0-4
            const marketIncome = Math.floor(markets * commerceMultipliers[commerceTech]);
            income += marketIncome;

            // 2. Vassal Taxes (Master gets +1 from each Vassal)
            const vassals = this.players.filter(v => v.masterId === p.id);
            income += vassals.length;

            // NOTE: Alliance bonus removed - no passive gold from alliances

            // 3. Pay Tax (If Vassal, give 1 to Master)
            // This continues even when gold cap is near limit
            if (p.isVassal && p.gold > 0) {
                p.gold -= 1;
                const master = this.players.find(m => m.id === p.masterId);
                if (master) {
                    master.gold += 1;
                    master.totalGoldEarned += 1; // Track tax as earned gold
                    this.log(`${p.name}, Efendisine vergi ödedi.`);
                }
            }

            // 4. Check GLOBAL gold cap threshold (75% = 25% remaining)
            const totalGoldEarned = this.getTotalGold();
            const goldCapPerPlayer = this.getGoldCap(); // 65 per player
            const totalGoldCap = goldCapPerPlayer * this.players.length;
            const goldThreshold = totalGoldCap * 0.75; // 75% threshold

            if (totalGoldEarned >= goldThreshold) {
                // Stop passive income when 75% of total cap is reached
                this.log(`⚠️ Altın tavanına yaklaşıldı! (${totalGoldEarned}/${totalGoldCap}) Pasif gelir kesildi.`);
                income = 0;
            } else {
                // 5. Check Per-Player Gold Cap for capping income
                const currentGold = p.gold;
                const availableGold = goldCapPerPlayer - currentGold;

                if (availableGold <= 0) {
                    this.log(`🚫 ${p.name} altın limitinde! Gelir alamadı. (${currentGold}/${goldCapPerPlayer})`);
                    income = 0;
                } else if (income > availableGold) {
                    income = availableGold;
                    this.log(`⚠️ ${p.name} kısmi gelir aldı: ${income} Altın (Limit: ${goldCapPerPlayer})`);
                }
            }

            p.gold += income;
            p.totalGoldEarned += income; // Track total earned for statistics

            // 5. Barracks Bonus (Each Kışla spawns 1 soldier in garrison)
            p.grid.forEach((cell, idx) => {
                if (cell && cell.type === 'Kışla') {
                    // Initialize garrison if not exists
                    if (!cell.garrison) {
                        cell.garrison = [];
                    }

                    const soldierTypes = [
                        { name: 'Piyade', cost: 2, type: 'Asker', power: 2, hp: 3, isUnit: true },
                        { name: 'Okçu', cost: 3, type: 'Asker', power: 3, hp: 4, isUnit: true },
                        { name: 'Süvari', cost: 4, type: 'Asker', power: 4, hp: 5, isUnit: true }
                    ];

                    // Check capacity (max 15 soldiers - BALANCED)
                    if (cell.garrison.length < 15) {
                        const randomSoldier = soldierTypes[Math.floor(Math.random() * soldierTypes.length)];
                        cell.garrison.push({ ...randomSoldier });
                        this.log(`🏰 ${p.name}, Kışla'ya ${randomSoldier.name} eklendi! (Garnizon: ${cell.garrison.length}/15)`);
                    } else {
                        this.log(`⚠️ ${p.name}'in Kışla'sı dolu! (15/15)`);
                    }
                }
            });

            // 5.5. Farm Civilian Production (if farm exists)
            const hasFarm = p.grid.some(c => c && c.type === 'Çiftlik');
            const meclis = p.grid[0];
            if (hasFarm && meclis && meclis.garrison && meclis.garrison.length < 3) {
                meclis.garrison.push({ name: 'Sivil', type: 'Nüfus', power: 0 });
                this.log(`🌾 ${p.name}, Çiftlik 1 sivil üretti! (Meclis: ${meclis.garrison.length}/3)`);
            }


            // 5.6. Meclis Auto-Repair System
            if (meclis && meclis.garrison) {
                const civilCount = meclis.garrison.length;
                const missingCivils = 3 - civilCount;

                if (missingCivils > 0) {
                    let restored = 0;
                    let usedDP = 0;
                    let usedGold = 0;

                    for (let i = 0; i < missingCivils; i++) {
                        // Try to use DP first (1 DP per civilian)
                        if (p.dp > 1) {
                            p.dp -= 1;
                            usedDP++;
                            meclis.garrison.push({ name: 'Sivil', type: 'Nüfus', power: 0 });
                            restored++;
                        }
                        // If no DP, use gold (2 gold per civilian)
                        else if (p.gold >= 2) {
                            p.gold -= 2;
                            usedGold++;
                            meclis.garrison.push({ name: 'Sivil', type: 'Nüfus', power: 0 });
                            restored++;
                        }
                        // Cannot afford restoration
                        else {
                            break;
                        }
                    }

                    // Log restoration
                    if (restored > 0) {
                        let costMsg = '';
                        if (usedDP > 0 && usedGold > 0) {
                            costMsg = `(-${usedDP} DP, -${usedGold * 2} Altın)`;
                        } else if (usedDP > 0) {
                            costMsg = `(-${usedDP} DP)`;
                        } else if (usedGold > 0) {
                            costMsg = `(-${usedGold * 2} Altın)`;
                        }
                        this.log(`🏛️ ${p.name} Meclisi onarıldı! +${restored} sivil ${costMsg}`);
                    }

                    // Warn if still missing civilians
                    const stillMissing = 3 - meclis.garrison.length;
                    if (stillMissing > 0) {
                        this.log(`⚠️ ${p.name} Meclisi zayıf! ${stillMissing} sivil eksik (DP veya Altın yetersiz)`);
                    }
                }

                // Game over check
                if (meclis.garrison.length === 0) {
                    this.log(`☠️ ${p.name} KRAL ÖLDÜ! Meclis savunmasız!`);
                }
            }

            // 6. Capacity Check (Food Limit)
            this.checkCapacity(p);
        });

        this.log(`Toplam Altın: ${this.getTotalGold()}/${this.getGoldCap()}`);
        this.log("Yeni Tur: Gelirler dağıtıldı ve Nüfus kontrolü yapıldı.");
    }

    getTotalGold() {
        // Return total earned gold (starting + all income), not current gold
        return this.players.reduce((sum, p) => sum + p.totalGoldEarned, 0);
    }

    getGoldCap() {
        // Per-player gold cap (not global pool)
        return 65;
    }

    checkCapacity(player) {
        // Base Capacity = 4 + (Barracks * 1) + (Farms * 5) + (Barracks Garrison Soldiers * 1)
        const barracks = player.grid.filter(c => c && c.type === 'Kışla').length;
        const farms = player.grid.filter(c => c && c.type === 'Çiftlik').length;
        // Only count soldiers in Kışla garrison, not Meclis civilians
        const garrisonSoldiers = player.grid.reduce((sum, c) => {
            if (c && c.type === 'Kışla' && c.garrison) {
                return sum + c.garrison.length;
            }
            return sum;
        }, 0);
        let baseCapacity = 4 + barracks + (farms * 5) + garrisonSoldiers;

        // Apply Food Technology Multiplier
        const foodTech = player.technologies.food;
        const techMultipliers = [1, 1.5, 3, 4.5, 6];
        const capacity = Math.floor(baseCapacity * techMultipliers[foodTech]);

        // Total Units = Pop (3 fixed) + Army Units on Grid
        let armyCount = player.grid.filter(c => c && c.isUnit).length;
        let totalPop = player.pop + armyCount;

        if (totalPop > capacity) {
            const excess = totalPop - capacity;
            this.log(`🛑 ${player.name} GIDA KITLIĞI! Kapasite: ${capacity}, Nüfus: ${totalPop}`);

            // Return soldiers to mercenary pool instead of killing them
            let returned = 0;
            for (let i = 0; i < player.grid.length; i++) {
                if (returned >= excess) break;
                if (player.grid[i] && player.grid[i].isUnit) {
                    const soldier = player.grid[i];
                    this.log(`🔄 Havuza döndü: ${soldier.type}`);

                    // Add to mercenary pool with original card properties
                    this.mercenaryPool.push({
                        id: `merc-${Date.now()}-${i}`,
                        name: soldier.type,
                        cost: soldier.type === 'Piyade' ? 2 : soldier.type === 'Okçu' ? 3 : 4,
                        type: 'Asker',
                        power: soldier.power || (soldier.type === 'Piyade' ? 2 : soldier.type === 'Okçu' ? 3 : 4),
                        isPoolSoldier: true
                    });

                    player.grid[i] = null;
                    returned++;
                }
            }

            if (returned > 0) {
                this.log(`♻️ ${returned} asker havuza eklendi. Pazarda satılacak.`);
            }
        }
    }

    // DIPLOMACY
    playDiplomacyCard(handIndex, targetPlayerId = null) {
        const player = this.getActivePlayer();
        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const card = player.hand[handIndex];
        if (!card || card.type !== 'Diplomasi') return { success: false, msg: "Geçersiz kart!" };

        // Validate target BEFORE consuming action (for cards that need target)
        if (card.effect && card.effect !== 'gold_boost' && card.effect !== 'military_boost' && card.effect !== 'white_flag') {
            if (!targetPlayerId) return { success: false, msg: "Bu kart için bir hedef seçmelisin!" };
            const target = this.players.find(p => p.id === targetPlayerId);
            if (!target) return { success: false, msg: "Hedef bulunamadı!" };
        }

        // NOW consume action (after validation)
        player.actionsRemaining -= 1;

        // Gain DP
        player.dp += card.dp || 0;

        this.log(`${player.name}, ${card.name} oynadı! +${card.dp} DP`);

        // Remove card from hand
        player.hand.splice(handIndex, 1);

        // Apply special effects
        if (card.effect) {
            if (card.effect === 'gold_boost') {
                player.gold += 3;
                player.totalGoldEarned += 3;
                this.log(`💰 ${player.name}, +3 Altın kazandı!`);
            } else if (card.effect === 'military_boost') {
                player.militaryBoost = 3;
                this.log(`⚔️ ${player.name}, **sonraki saldırısında** +3 güç bonusu kazandı!`);
            } else {
                // Target already validated above
                const target = this.players.find(p => p.id === targetPlayerId);

                switch (card.effect) {
                    case 'steal_card': // Casusluk
                        if (target.hand.length > 0) {
                            const randomIndex = Math.floor(Math.random() * target.hand.length);
                            const stolenCard = target.hand.splice(randomIndex, 1)[0];
                            player.hand.push(stolenCard);
                            this.log(`🕵️ CASUSLUK BAŞARILI! ${player.name}, ${target.name}'den "${stolenCard.name}" kartını çaldı!`);
                        } else {
                            this.log(`⚠️ CASUSLUK BAŞARISIZ! ${target.name}'in elinde kart yok!`);
                        }
                        break;

                    case 'steal_unit': // Propaganda
                        const units = target.grid.map((cell, idx) => ({ cell, idx })).filter(item => item.cell && item.cell.isUnit);
                        if (units.length > 0) {
                            const randomUnit = units[Math.floor(Math.random() * units.length)];
                            const emptySlots = player.grid.map((cell, idx) => ({ cell, idx })).filter(item => !item.cell);

                            if (emptySlots.length > 0) {
                                const targetSlot = emptySlots[0];
                                const stolenUnitType = target.grid[randomUnit.idx].type;
                                player.grid[targetSlot.idx] = target.grid[randomUnit.idx];
                                target.grid[randomUnit.idx] = null;
                                this.log(`🎭 PROPAGANDA BAŞARILI! ${player.name}, ${target.name}'den ${stolenUnitType} çaldı ve kendi ordusuna kattı!`);

                                // Show propaganda success notification
                                this.showPropagandaNotification({
                                    attacker: player.name,
                                    attackerColor: player.color,
                                    defender: target.name,
                                    defenderColor: target.color,
                                    unitName: stolenUnitType
                                });
                            } else {
                                this.log(`⚠️ PROPAGANDA BAŞARISIZ! ${player.name}'in boş alanı yok, birim çalınamadı!`);
                            }
                        } else {
                            this.log(`⚠️ PROPAGANDA BAŞARISIZ! ${target.name}'in askeri birimi yok!`);
                        }
                        break;

                    case 'break_alliance': // Nifak Tohumu - Break target's alliance
                        // Check military requirement
                        const playerMilitary = this.calculateMilitary(player);
                        if (playerMilitary < (card.minMilitary || 20)) {
                            this.log(`❌ NİFAK TOHUMU BAŞARISIZ! ${player.name} yeterli askeri güce sahip değil! (${playerMilitary}/20)`);
                            player.hand.push(card);
                            player.actionsRemaining += 1;
                            player.dp -= card.dp || 0;
                            return { success: false, msg: `En az 20 askeri güç gerekli! (Mevcut: ${playerMilitary})` };
                        }

                        // Check if target has an alliance
                        if (!target.allianceWith) {
                            this.log(`❌ NİFAK TOHUMU BAŞARISIZ! ${target.name}'in ittifakı yok!`);
                            player.hand.push(card);
                            player.actionsRemaining += 1;
                            player.dp -= card.dp || 0;
                            return { success: false, msg: `${target.name}'in ittifakı yok!` };
                        }

                        // Calculate success based on military power + DP
                        const targetAlly = this.players.find(p => p.id === target.allianceWith);
                        const attackerPower = playerMilitary + player.dp;
                        const targetMilitary = this.calculateMilitary(target);
                        const allyMilitary = this.calculateMilitary(targetAlly);
                        const defenderPower = targetMilitary + target.dp + allyMilitary + targetAlly.dp;

                        this.log(`⚔️ NİFAK TOHUMU: ${player.name} (Güç: ${attackerPower}) vs ${target.name}+${targetAlly.name} (Güç: ${defenderPower})`);

                        if (attackerPower > defenderPower) {
                            // Success - Break the alliance
                            target.allianceWith = null;
                            targetAlly.allianceWith = null;

                            this.log(`✅ NİFAK TOHUMU BAŞARILI! ${player.name}, ${target.name} ile ${targetAlly.name} arasındaki ittifakı bozdu!`);
                            this.log(`${target.name} ve ${targetAlly.name} artık müttefik değil!`);
                        } else {
                            // Failure - Card wasted, penalties
                            player.dp = Math.max(1, player.dp - 2);
                            target.dp += 1;
                            targetAlly.dp += 1;

                            this.log(`❌ NİFAK TOHUMU BAŞARISIZ! İttifak çok güçlü!`);
                            this.log(`${player.name}: -2 DP | ${target.name}: +1 DP | ${targetAlly.name}: +1 DP`);
                        }
                        break;

                    case 'white_flag': // Beyaz Bayrak - Peace protection
                        const duration = card.duration || 1;
                        player.whiteFlagTurns = duration;
                        this.log(`🏳️ BEYAZ BAYRAK! ${player.name}, ${duration} tur boyunca saldırıya karşı korunuyor!`);
                        break;

                    case 'assassination': // Suikast - End-game card
                        // Requirement checks
                        const totalSoldiers = player.grid.filter(c => c && c.isUnit).length +
                            player.grid.reduce((sum, c) => sum + (c?.garrison?.length || 0), 0);

                        if (totalSoldiers <= 20) {
                            this.log(`❌ SUIKAST BAŞARISIZ! ${player.name} yeterli askere sahip değil! (${totalSoldiers}/20)`);
                            player.hand.push(card);
                            player.actionsRemaining += 1;
                            player.dp -= card.dp || 0;
                            return { success: false, msg: `En az 20 asker gerekli! (Mevcut: ${totalSoldiers})` };
                        }

                        if (player.technologies.military < 3) {
                            this.log(`❌ SUIKAST BAŞARISIZ! ${player.name} yeterli askeri teknolojiye sahip değil!`);
                            player.hand.push(card);
                            player.actionsRemaining += 1;
                            player.dp -= card.dp || 0;
                            return { success: false, msg: 'Silah III veya IV teknolojisi gerekli!' };
                        }

                        const hasHighTech = Object.values(player.technologies).some(level => level >= 3);
                        if (!hasHighTech) {
                            this.log(`❌ SUIKAST BAŞARISIZ! ${player.name} yeterli teknolojiye sahip değil!`);
                            player.hand.push(card);
                            player.actionsRemaining += 1;
                            player.dp -= card.dp || 0;
                            return { success: false, msg: 'En az bir Lv3 veya Lv4 teknoloji gerekli!' };
                        }

                        // Dice roll for assassination attempt
                        const attackerMilitaryPower = this.calculateMilitary(player);
                        const attackerRoll = Math.floor(Math.random() * 6) + 1;
                        const defenderRoll = Math.floor(Math.random() * 6) + 1;

                        const targetMeclis = target.grid[0];
                        const garrisonBonus = targetMeclis?.garrison?.length || 0;

                        const attackerScore = attackerRoll + player.dp + Math.floor(attackerMilitaryPower / 5);
                        const defenderScore = defenderRoll + target.dp + (garrisonBonus * 2) + 6;

                        this.log(`🗡️ SUİKAST GİRİŞİMİ! ${player.name} → ${target.name}`);
                        this.log(`Saldırı: ${attackerScore} (Zar:${attackerRoll} + DP:${player.dp} + Güç:${Math.floor(attackerMilitaryPower / 5)})`);
                        this.log(`Savunma: ${defenderScore} (Zar:${defenderRoll} + DP:${target.dp} + Garnizon:${garrisonBonus * 2} + Bonus:6)`);

                        if (attackerScore > defenderScore) {
                            // Success - kill 2 civilians from Meclis
                            if (targetMeclis && targetMeclis.garrison) {
                                const killed = Math.min(2, targetMeclis.garrison.length);
                                targetMeclis.garrison.splice(0, killed);

                                target.dp = Math.max(1, target.dp - 5);
                                player.dp += 3;

                                this.log(`✅ SUİKAST BAŞARILI! ${killed} sivil öldürüldü!`);
                                this.log(`${target.name}: -5 DP, ${player.name}: +3 DP`);

                                // Check Meclis health
                                this.checkMeclisHealth(target);
                            }
                        } else {
                            // Failure - penalties
                            player.dp = Math.max(1, player.dp - 6);
                            player.gold = Math.max(0, player.gold - 10);
                            target.dp += 2;

                            this.log(`❌ SUİKAST BAŞARISIZ! Suikastçı yakalandı!`);
                            this.log(`${player.name}: -6 DP, -10 Altın | ${target.name}: +2 DP`);
                        }
                        break;
                }
            }
        }

        this.checkAutoEndTurn();
        return { success: true, needsTarget: card.effect && card.effect !== 'gold_boost' && card.effect !== 'military_boost' };
    }

    // TECHNOLOGY
    playTechnologyCard(handIndex) {
        const player = this.getActivePlayer();

        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const card = player.hand[handIndex];
        if (!card || card.type !== 'Teknoloji') return { success: false, msg: "Geçersiz kart!" };

        // Calculate total population (Meclis civilians + grid soldiers + garrison soldiers)
        const totalPop = player.pop +
            player.grid.filter(c => c && c.isUnit).length +
            player.grid.reduce((sum, c) => sum + (c?.garrison?.length || 0), 0);

        // Check if player has enough population
        if (totalPop < card.popCost) {
            return { success: false, msg: `Yetersiz nüfus! ${card.popCost} nüfus gerekli. (Mevcut: ${totalPop})` };
        }

        let targetTechType = card.techType;
        let targetLevel = card.level;

        // Special handling for Joker card
        if (card.isJoker) {
            // Ask player which technology to upgrade
            const techOptions = [
                { type: 'military', name: 'Silah (Askeri Güç)', currentLevel: player.technologies.military },
                { type: 'defense', name: 'Savunma (Bina HP)', currentLevel: player.technologies.defense },
                { type: 'commerce', name: 'Ticaret (Pazar Geliri)', currentLevel: player.technologies.commerce }
            ];

            // Filter out maxed techs (level 4)
            const availableTechs = techOptions.filter(t => t.currentLevel < 4);

            if (availableTechs.length === 0) {
                return { success: false, msg: "Tüm teknolojilerin maksimum seviyede!" };
            }

            // Build prompt message
            let promptMsg = "Joker kartı ile hangi teknolojiyi geliştirmek istiyorsun?\n\n";
            availableTechs.forEach((tech, idx) => {
                promptMsg += `${idx + 1}. ${tech.name} (Şu an: Lv${tech.currentLevel} → Lv${tech.currentLevel + 1})\n`;
            });
            promptMsg += "\nNumara seç (1-" + availableTechs.length + "):";

            const choice = window.prompt(promptMsg);
            const choiceNum = parseInt(choice);

            if (!choiceNum || choiceNum < 1 || choiceNum > availableTechs.length) {
                return { success: false, msg: "Geçersiz seçim!" };
            }

            const selectedTech = availableTechs[choiceNum - 1];
            targetTechType = selectedTech.type;
            targetLevel = selectedTech.currentLevel + 1;
        } else {
            // Regular tech card - check if player already has this level or higher
            const currentLevel = player.technologies[card.techType];
            if (currentLevel >= card.level) {
                return { success: false, msg: "Bu teknolojiye zaten sahipsin!" };
            }
        }

        // Consume population from Meclis civilians first, then garrison
        let remaining = card.popCost;
        const meclis = player.grid[0];

        // Remove from Meclis civilians first
        if (meclis && meclis.garrison) {
            const civilsToRemove = Math.min(remaining, meclis.garrison.length);
            meclis.garrison.splice(0, civilsToRemove);
            remaining -= civilsToRemove;
        }

        // If still need to remove, take from Kışla garrisons
        if (remaining > 0) {
            for (let cell of player.grid) {
                if (remaining <= 0) break;
                if (cell && cell.type === 'Kışla' && cell.garrison && cell.garrison.length > 0) {
                    const soldiersToRemove = Math.min(remaining, cell.garrison.length);
                    cell.garrison.splice(0, soldiersToRemove);
                    remaining -= soldiersToRemove;
                }
            }
        }

        player.actionsRemaining -= 1;

        // Apply technology
        player.technologies[targetTechType] = targetLevel;

        // Remove card from hand
        player.hand.splice(handIndex, 1);

        const techName = card.isJoker ? `${targetTechType} Lv${targetLevel}` : card.name;
        this.log(`${player.name}, ${techName} araştırdı!`);
        this.checkAutoEndTurn();
        return { success: true };
    }

    proposeAlliance(targetPlayerId) {
        const proposer = this.getActivePlayer();
        const target = this.players.find(p => p.id === targetPlayerId);
        if (proposer.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };
        if (proposer.id === target.id) return { success: false, msg: "Kendinle ittifak kuramazsın!" };
        if (proposer.allianceWith !== null) return { success: false, msg: "Zaten bir ittifakın var!" };
        if (target.allianceWith !== null) return { success: false, msg: "Hedefin zaten müttefiki var!" };

        // Rule: Cannot propose if DP is equal
        if (proposer.dp === target.dp) return { success: false, msg: "Eşit DP ile teklif edilemez!" };

        // Rule: Vassals cannot form alliances
        if (proposer.isVassal || target.isVassal) return { success: false, msg: "Vasallar ittifak kuramaz!" };

        // Rule: Last two independent players cannot form alliance
        const independentPlayers = this.players.filter(p => !p.isVassal);
        if (independentPlayers.length === 2 && independentPlayers.includes(proposer) && independentPlayers.includes(target)) {
            return { success: false, msg: "Son iki bağımsız krallık ittifak kuramaz! Biri kazanmalı!" };
        }


        // Rule: Only higher DP can propose
        if (proposer.dp < target.dp) {
            return { success: false, msg: `❌ Sadece daha yüksek DP'li oyuncular ittifak teklif edebilir!\n\nSenin DP'n: ${proposer.dp}\n${target.name} DP: ${target.dp}\n\nİpucu: Diplomasi kartları oynayarak DP'ni artır.` };
        }

        proposer.actionsRemaining -= 1;

        // High DP proposes to Low DP
        // Target can refuse ONLY if militarily superior (3x stronger)
        const proposerMilitary = this.calculateMilitary(proposer);
        const targetMilitary = this.calculateMilitary(target);

        if (targetMilitary >= proposerMilitary * 3) {
            // Target is militarily superior - can refuse
            this.log(`❌ ${target.name}, ${proposer.name}'in teklifini REDDETTİ! (Askeri üstünlük: ${targetMilitary} vs ${proposerMilitary})`);
            return { success: true, msg: `Teklif reddedildi! ${target.name} askeri olarak çok güçlü.` };
        } else {
            // Must accept
            proposer.allianceWith = target.id;
            target.allianceWith = proposer.id;
            this.log(`🤝 İTTİFAK! ${proposer.name} ⇄ ${target.name} (DP: ${proposer.dp} > ${target.dp})`);
        }

        this.checkAutoEndTurn();
        return { success: true };
    }

    calculateMilitary(player) {
        // Sum of all unit power on grid
        let basePower = player.grid.reduce((sum, cell) => {
            if (cell && cell.isUnit) {
                let cellPower = cell.power || 0;

                // Add garrison power (soldiers in unit garrisons)
                if (cell.garrison && cell.garrison.length > 0) {
                    const garrisonPower = cell.garrison.reduce((gSum, soldier) =>
                        gSum + (soldier.power || 0), 0
                    );
                    cellPower += garrisonPower;
                }

                return sum + cellPower;
            }
            return sum;
        }, 0);

        // Add barracks garrison power
        player.grid.forEach(cell => {
            if (cell && cell.type === 'Kışla' && cell.garrison && cell.garrison.length > 0) {
                const barracksGarrisonPower = cell.garrison.reduce((gSum, soldier) =>
                    gSum + (soldier.power || 0), 0
                );
                basePower += barracksGarrisonPower;
            }
        });

        // STEP 1: Diversity Bonus FIRST (+20% if has all 3 soldier types + barracks)
        const soldierTypes = new Set();
        let hasBarracks = false;

        player.grid.forEach(cell => {
            if (cell && cell.isUnit && cell.name) {
                soldierTypes.add(cell.name);
            }
            if (cell && cell.type === 'Kışla') {
                hasBarracks = true;
            }
        });

        const hasAllTypes = soldierTypes.has('Piyade') &&
            soldierTypes.has('Okçu') &&
            soldierTypes.has('Süvari') &&
            hasBarracks;

        if (hasAllTypes) {
            basePower = Math.floor(basePower * 1.2); // +20% bonus BEFORE tech
        }

        // STEP 2: Apply Military Technology Multiplier (BALANCED)
        const militaryTech = player.technologies.military;
        const techMultipliers = [1, 1.2, 1.5, 2, 2.5]; // Balanced multipliers
        basePower = Math.floor(basePower * techMultipliers[militaryTech]);

        return basePower;
    }

    checkMeclisHealth(player) {
        const meclis = player.grid[0];
        if (!meclis || !meclis.garrison) return;

        const civilCount = meclis.garrison.length;

        if (civilCount === 2) {
            meclis.hp = 7; // Reduced HP
            this.log(`⚠️ ${player.name} Meclisi zayıfladı! (2 sivil kaldı)`);
        } else if (civilCount === 1) {
            meclis.hp = 5; // Critical HP
            this.log(`🚨 ${player.name} KRİZ DURUMUNDA! (1 sivil kaldı)`);
        } else if (civilCount === 0) {
            meclis.hp = 3; // Defenseless
            this.log(`☠️ ${player.name} KRAL ÖLDÜ! Meclis savunmasız!`);
        }
    }

    breakAlliance() {
        const player = this.getActivePlayer();
        if (player.allianceWith === null) return { success: false, msg: "İttifakın yok!" };
        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const ally = this.players.find(p => p.id === player.allianceWith);

        // Penalty
        player.dp = Math.max(1, player.dp - 2);
        player.actionsRemaining -= 1;

        // Bonus to loyal ally
        ally.gold += 3;
        ally.totalGoldEarned += 3; // Track total earned

        // Break the alliance
        player.allianceWith = null;
        ally.allianceWith = null;

        this.log(`💔 ${player.name}, ${ally.name} ile ittifakı bozdu! (-2 DP, ${ally.name} +3 Altın)`);
        this.checkAutoEndTurn();
        return { success: true };
    }

    // TECHNOLOGY

    donateToVassal(targetPlayerId, donationType, amount) {
        const player = this.getActivePlayer();
        const target = this.players.find(p => p.id === targetPlayerId);

        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };
        if (!target) return { success: false, msg: "Hedef bulunamadı!" };
        if (!target.isVassal) return { success: false, msg: "Hedef vasal değil!" };
        if (player.isVassal) return { success: false, msg: "Vasallar bağış yapamaz!" };
        if (target.masterId === player.id) return { success: false, msg: "Kendi vasalına bağış yapamazsın!" };

        player.actionsRemaining -= 1;

        if (donationType === 'gold') {
            if (player.gold < amount) return { success: false, msg: "Yetersiz altın!" };
            player.gold -= amount;
            target.gold += amount;
            this.log(`🎁 ${player.name}, ${target.name}'e ${amount} Altın bağışladı!`);
        } else if (donationType === 'unit') {
            // Transfer a unit from player's grid to target's grid
            const units = player.grid.map((cell, idx) => ({ cell, idx })).filter(item => item.cell && item.cell.isUnit);
            if (units.length === 0) return { success: false, msg: "Bağışlanacak asker yok!" };

            const emptySlots = target.grid.map((cell, idx) => ({ cell, idx })).filter(item => !item.cell);
            if (emptySlots.length === 0) return { success: false, msg: "Hedefin boş alanı yok!" };

            // Transfer first unit
            const unitToTransfer = units[0];
            const targetSlot = emptySlots[0];

            target.grid[targetSlot.idx] = player.grid[unitToTransfer.idx];
            player.grid[unitToTransfer.idx] = null;

            this.log(`🎁 ${player.name}, ${target.name}'e ${target.grid[targetSlot.idx].type} bağışladı!`);
        }

        this.checkAutoEndTurn();
        return { success: true };
    }
}
