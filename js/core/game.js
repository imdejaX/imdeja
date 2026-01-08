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
        this.isCalculatingCombat = false; // Flag to wait for combat animation

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
        const playerCount = this.players.length;

        // Dynamic Deck Scaling
        // Ensure enough key buildings for everyone (3 Barracks, 2 Farms per player minimum)
        const baseAndCount = Math.max(1, playerCount);

        const buildingCards = [];
        // Add Guaranteed Cards
        for (let i = 0; i < baseAndCount * 2; i++) buildingCards.push({ name: 'Çiftlik', cost: 3, type: 'Bina', hp: 5, power: 8 });
        for (let i = 0; i < baseAndCount * 3; i++) buildingCards.push({ name: 'Kışla', cost: 4, type: 'Bina', hp: 6, power: 12 });
        for (let i = 0; i < baseAndCount * 1; i++) buildingCards.push({ name: 'Duvar', cost: 5, type: 'Bina', hp: 6, power: 20 });
        for (let i = 0; i < baseAndCount * 1; i++) buildingCards.push({ name: 'Pazar', cost: 3, type: 'Bina', hp: 3, power: 8 });
        for (let i = 0; i < baseAndCount * 1; i++) buildingCards.push({ name: 'Bilim Merkezi', cost: 5, type: 'Bina', hp: 4, power: 5 });

        // Add Random Extra Buildings (pool of 5 per player)
        const extraBuildingTypes = [
            { name: 'Çiftlik', cost: 3, type: 'Bina', hp: 5, power: 8 },
            { name: 'Kışla', cost: 4, type: 'Bina', hp: 6, power: 12 },
            { name: 'Duvar', cost: 5, type: 'Bina', hp: 6, power: 20 },
            { name: 'Pazar', cost: 3, type: 'Bina', hp: 3, power: 8 },
            { name: 'Bilim Merkezi', cost: 5, type: 'Bina', hp: 4, power: 5 }
        ];
        for (let i = 0; i < playerCount * 4; i++) {
            buildingCards.push(extraBuildingTypes[Math.floor(Math.random() * extraBuildingTypes.length)]);
        }

        const militaryCards = [
            { name: 'Piyade', cost: 2, type: 'Asker', power: 2 },
            { name: 'Okçu', cost: 3, type: 'Asker', power: 3 },
            { name: 'Süvari', cost: 4, type: 'Asker', power: 4 }
        ];

        const diplomacyCards = [
            { name: 'Casusluk', cost: 4, type: 'Diplomasi', dp: 1, effect: 'steal_card' },
            { name: 'Propaganda', cost: 6, type: 'Diplomasi', dp: 2, effect: 'steal_unit' },
            { name: 'Askeri Gösteri', cost: 3, type: 'Diplomasi', dp: 1, effect: 'military_boost' },
            { name: 'Nifak Tohumu', cost: 7, type: 'Diplomasi', dp: 3, effect: 'break_alliance' },
            { name: 'Beyaz Bayrak', cost: 5, type: 'Diplomasi', dp: 1, effect: 'white_flag', duration: 1 },
            { name: 'Mimari Onarım', cost: 4, type: 'Diplomasi', dp: 2, effect: 'repair_building' }, // New Card
            { name: 'Terör Jokeri', cost: 20, type: 'Diplomasi', dp: 0, effect: 'terror_joker' } // New Card
        ];

        const technologyCards = [
            // Military Technology (Attack power boost) - BALANCED
            { name: 'Silah', cost: 5, popCost: 2, type: 'Teknoloji', techType: 'military', level: 1, multiplier: 1.2 },
            { name: 'Silah', cost: 10, popCost: 3, type: 'Teknoloji', techType: 'military', level: 2, multiplier: 1.5 },
            { name: 'Silah', cost: 15, popCost: 4, type: 'Teknoloji', techType: 'military', level: 3, multiplier: 2 },
            { name: 'Silah', cost: 25, popCost: 5, type: 'Teknoloji', techType: 'military', level: 4, multiplier: 2.5 },

            // Defense Technology (Building HP boost) - BALANCED
            { name: 'Savunma', cost: 5, popCost: 2, type: 'Teknoloji', techType: 'defense', level: 1, multiplier: 1.2 },
            { name: 'Savunma', cost: 10, popCost: 3, type: 'Teknoloji', techType: 'defense', level: 2, multiplier: 1.5 },
            { name: 'Savunma', cost: 15, popCost: 4, type: 'Teknoloji', techType: 'defense', level: 3, multiplier: 2 },
            { name: 'Savunma', cost: 25, popCost: 5, type: 'Teknoloji', techType: 'defense', level: 4, multiplier: 2.5 },

            // Commerce Technology (Pazar boost) - NEW
            { name: 'Ticaret', cost: 5, popCost: 2, type: 'Teknoloji', techType: 'commerce', level: 1, multiplier: 1.5 },
            { name: 'Ticaret', cost: 10, popCost: 3, type: 'Teknoloji', techType: 'commerce', level: 2, multiplier: 2 },
            { name: 'Ticaret', cost: 15, popCost: 4, type: 'Teknoloji', techType: 'commerce', level: 3, multiplier: 2.5 },
            { name: 'Ticaret', cost: 25, popCost: 5, type: 'Teknoloji', techType: 'commerce', level: 4, multiplier: 3 },

            // Joker Card - SPECIAL: Player chooses which tech to upgrade
            { name: 'Joker', cost: 10, popCost: 2, type: 'Teknoloji', techType: 'joker', level: 0, isJoker: true }
        ];

        let deck = [];

        // Add Building Cards (Already Scaled)
        buildingCards.forEach(c => deck.push({ id: `card-${deck.length}`, ...c }));

        // Add Military Cards (Scale: 15 per player)
        const militaryCount = playerCount * 15;
        for (let i = 0; i < militaryCount; i++) {
            const template = militaryCards[Math.floor(Math.random() * militaryCards.length)];
            deck.push({ id: `card-${deck.length}`, ...template });
        }

        // Add Diplomacy Cards (Scale: 8 per player)
        const dipCount = playerCount * 8;
        for (let i = 0; i < dipCount; i++) {
            const template = diplomacyCards[Math.floor(Math.random() * diplomacyCards.length)];
            deck.push({ id: `card-${deck.length}`, ...template });
        }

        // Add Technology Cards (Base set + duplicates based on player count)
        const regularTechCards = technologyCards.filter(c => !c.isJoker);
        // Add 1 full set per 2 players approx, but ensure random distribution
        const techCount = playerCount * 6;
        for (let i = 0; i < techCount; i++) {
            const template = regularTechCards[Math.floor(Math.random() * regularTechCards.length)];
            deck.push({ id: `card-${deck.length}`, ...template });
        }

        // Add Joker cards (1 per player)
        const jokerCard = technologyCards.find(c => c.isJoker);
        if (jokerCard) {
            for (let i = 0; i < playerCount; i++) {
                deck.push({ id: `card-${deck.length}`, ...jokerCard });
            }
        }

        // Shuffle deck
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        console.log(`Deck created with ${deck.length} cards for ${playerCount} players.`);
        return deck;
    }

    refillMarket() {
        // Market enforces 4 cards: One of each type
        if (this.openMarket.length >= 4) return;

        const requiredTypes = ['Bina', 'Asker', 'Diplomasi', 'Teknoloji'];
        const player = this.getActivePlayer();

        // Iterate through each required type and try to find a card
        requiredTypes.forEach(type => {
            // If we already have this type in the open market, skip
            if (this.openMarket.some(c => c.type === type)) return;

            // 1. Check Mercenary Pool first (Only for Soldiers)
            if (type === 'Asker' && this.mercenaryPool.length > 0) {
                // Find first soldier in pool
                const mercIndex = this.mercenaryPool.findIndex(c => c.type === 'Asker');
                if (mercIndex !== -1) {
                    this.openMarket.push(this.mercenaryPool.splice(mercIndex, 1)[0]);
                    return; // Move to next type
                }
            }

            // 2. Search in Main Deck
            if (type === 'Teknoloji') {
                // Special handling for Technology: Find valid NEXT level card
                // Search deck for a valid tech card
                for (let i = 0; i < this.market.length; i++) {
                    const card = this.market[i];
                    if (card.type !== 'Teknoloji') continue;

                    if (card.isJoker) {
                        this.openMarket.push(this.market.splice(i, 1)[0]);
                        break; // Found tech slot
                    }

                    const currentLevel = player.technologies[card.techType];

                    if (card.level === currentLevel + 1) {
                        // Valid next level - check if in hand
                        const hasInHand = player.hand.some(h =>
                            h.type === 'Teknoloji' &&
                            h.techType === card.techType &&
                            h.level === card.level
                        );
                        if (!hasInHand) {
                            this.openMarket.push(this.market.splice(i, 1)[0]);
                            break; // Found and added
                        }
                    } else if (card.level <= currentLevel) {
                        // Obsolete card - remove from deck and continue searching
                        this.market.splice(i, 1);
                        i--;
                    }
                    // If future tech (level > current + 1), just skip
                }
            } else {
                // Standard types (Bina, Asker, Diplomasi)
                const cardIndex = this.market.findIndex(c => c.type === type);
                if (cardIndex !== -1) {
                    this.openMarket.push(this.market.splice(cardIndex, 1)[0]);
                }
            }
        });
    }

    refillMarketOld() {
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

                    // Joker is always valid as a tech slot
                    if (c.isJoker) return true;

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
                const card = this.market.pop();

                // Still apply absolute tech level check even in fallback
                if (card.type === 'Teknoloji' && !card.isJoker) {
                    const currentLevel = player.technologies[card.techType];
                    if (card.level <= currentLevel) continue; // Skip obsolete tech
                }

                this.openMarket.push(card);
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

        // Return current cards to bottom of deck (recycle), BUT keep Mercenaries
        if (this.openMarket.length > 0) {
            const mercenaries = this.openMarket.filter(c => c.type === 'Paralı Asker');
            const others = this.openMarket.filter(c => c.type !== 'Paralı Asker');

            if (others.length > 0) {
                this.market.push(...others);
            }
            // Keep mercenaries in market logic (effectively "fixed")
            this.openMarket = [...mercenaries];
        }

        // Refill market with new random cards
        this.refillMarket();

        return { success: true };
    }

    initializeBoard() {
        this.players.forEach(p => {
            p.grid[0] = {
                type: 'Meclis', hp: 10, power: 20, garrison: [
                    { name: 'Sivil', type: 'Nüfus', power: 0 },
                    { name: 'Sivil', type: 'Nüfus', power: 0 },
                    { name: 'Sivil', type: 'Nüfus', power: 0 }
                ]
            }; // Meclis starts with 3 population
            p.grid[1] = { type: 'Çiftlik', hp: 5, power: 4 }; // Starting farm

            // Starting Barracks with 5 soldiers
            const startingSoldiers = [];
            const soldierTypes = [
                { name: 'Piyade', cost: 2, type: 'Asker', power: 2, hp: 3, isUnit: true },
                { name: 'Okçu', cost: 3, type: 'Asker', power: 3, hp: 4, isUnit: true }
            ];
            for (let i = 0; i < 5; i++) {
                startingSoldiers.push(soldierTypes[Math.floor(Math.random() * soldierTypes.length)]);
            }

            p.grid[3] = { type: 'Kışla', hp: 6, power: 12, garrison: startingSoldiers }; // Military building, starts with 5 soldiers
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

        // Show as subtitle instead of log
        if (window.renderer && window.renderer.showSubtitle) {
            window.renderer.showSubtitle(randomTip);
        }
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

        // New Rule: Technology Requires Science Center
        if (card.type === 'Teknoloji') {
            const hasScienceCenter = player.grid.some(cell => cell && cell.type === 'Bilim Merkezi');
            if (!hasScienceCenter) {
                return { success: false, msg: "Teknoloji geliştirmek için 'Bilim Merkezi' binasına sahip olmalısınız!" };
            }
        }

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
            // Create new building
            player.grid[slotIndex] = {
                type: card.name,
                hp: card.hp,
                power: card.power
            };

            // SCENARIO: Bilim Merkezi starts with 1 Scientist and max 5 capacity
            if (card.name === 'Bilim Merkezi') {
                player.grid[slotIndex].garrison = [
                    { name: 'Bilim İnsanı', type: 'Nüfus', power: 0 }
                ];
                player.grid[slotIndex].capacity = 5;
                this.log(`🧪 Bilim Merkezi kuruldu! 1 Bilim İnsanı göreve başladı.`);
            }

            player.actionsRemaining -= 1;
            player.hand.splice(this.selectedCardIndex, 1);
            this.selectedCardIndex = null;
            this.log(`${player.name}, ${card.name} inşa etti.`);
            // TODO: Implement special effects (steal_card, gold_boost, etc.)
            this.checkAutoEndTurn();
            return { success: true };
        }

        // Basic Rules for buildings/units
        if (currentSlot && currentSlot.type !== 'Boş') {
            return { success: false, msg: "Alan dolu!" };
        }

        // Check Population Limit for Units
        if (card.type === 'Asker') {
            const { capacity, totalPop } = this.getCapacityInfo(player);
            if (totalPop + 1 > capacity) {
                return { success: false, msg: `Nüfus limiti aşıldı! (Mevcut: ${totalPop}/${capacity})` };
            }
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
    initiateAttack(targetPlayerId, targetSlotIndex, confirmed = false) {
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

        // RULE: BETRAYAL - Attacking an ally breaks the alliance + Penalty
        if (attacker.allianceWith === defender.id) {
            // CONFIRMATION CHECK
            if (!confirmed) {
                return {
                    success: false,
                    requiresConfirmation: true,
                    msg: `⚠️ DİKKAT!\n\nMüttefiğin ${defender.name}'e saldırmak üzeresin!\n\nBunu yaparsan:\n1. İttifak BOZULACAK.\n2. İhanet bedeli olarak 2 DP kaybedeceksin.\n3. ${defender.name} tazminat olarak 3 Altın kazanacak.\n\nSaldırıya devam etmek istiyor musun?`
                };
            }

            // Log the betrayal
            this.log(`😱 İHANET! ${attacker.name}, müttefiği ${defender.name}'e saldırdı!`);

            // Apply Penalty (Attacker loses DP, Defender gains Gold)
            attacker.dp = Math.max(1, attacker.dp - 2);
            defender.gold += 3;
            defender.totalGoldEarned += 3;

            // Break the alliance
            attacker.allianceWith = null;
            defender.allianceWith = null;

            this.log(`💔 İttifak bozuldu. ${attacker.name}: -2 DP, ${defender.name}: +3 Altın (Tazminat)`);
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

        // Clear any old dice roll data
        this.lastDiceRoll = null;

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

    /**
     * Pre-rolls dice for the pending attack so renderer can show animation
     */
    prepareAttackDice() {
        if (!this.pendingAttack) return null;

        const attacker = this.players.find(p => p.id === this.pendingAttack.attackerId);
        const defender = this.players.find(p => p.id === this.pendingAttack.targetPlayerId);

        const attackRoll = Math.floor(Math.random() * 6) + 1;
        const defenseRoll = Math.floor(Math.random() * 6) + 1;

        this.lastDiceRoll = {
            attacker: attackRoll,
            defender: defenseRoll,
            attackerName: attacker.name,
            defenderName: defender.name
        };

        return this.lastDiceRoll;
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

        // Use prepared dice if available, otherwise roll new ones
        let attackRoll, defenseRoll;
        if (this.lastDiceRoll) {
            attackRoll = this.lastDiceRoll.attacker;
            defenseRoll = this.lastDiceRoll.defender;
            this.lastDiceRoll = null; // Clear so it's only used once
        } else {
            attackRoll = Math.floor(Math.random() * 6) + 1;
            defenseRoll = Math.floor(Math.random() * 6) + 1;
        }

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
        let techBoostedDefense = Math.floor((targetCell.power || 0) * defenseMultipliers[defenseTech]);

        // Apply Wall Bonus (Global +5 if any Wall exists)
        const hasWall = defender.grid.some(c => c && c.type === 'Duvar');
        const wallBonus = hasWall ? 5 : 0;
        techBoostedDefense += wallBonus;

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
            // Recalculate pure tech bonus without wall for display
            const rawTechVal = Math.floor((targetCell.power || 0) * defenseMultipliers[defenseTech]);
            const techBonus = rawTechVal - (targetCell.power || 0);
            defenderBaseCalc.push({
                text: `🛡️ Savunma Teknolojisi Lv${defenseTech} (×${defenseMultipliers[defenseTech]}): +${techBonus}`,
                color: '#4ecdc4'
            });
        }

        if (hasWall) {
            defenderBaseCalc.push({
                text: `🧱 Duvar Bonusu: +5`,
                color: '#fbbf24'
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
        // Skip animation for bots to prevent turn hanging
        await this.showCombatCalculation({
            ...combatData,
            skipAnimation: attacker.isBot
        });

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
            const diff = attackPower - defensePower;
            let damage = 0;

            // Tiered Damage Logic (Close battles = Partial Damage)
            if (diff <= 5) {
                damage = 1; // Minor damage for close calls
                this.log(`📉 KISMİ HASAR: Yakın mücadele! Sadece 1 hasar verildi.`);
            } else if (diff <= 15) {
                damage = 2; // Moderate damage
                this.log(`💥 CİDDİ HASAR: Üstün saldırı! 2 hasar verildi.`);
            } else {
                damage = diff; // Overwhelming victory -> Full damage (likely destroys building)
                this.log(`🔥 YIKICI SALDIRI! Fark çok büyük! ${damage} hasar verildi.`);
            }

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
                    const destroyedBuildingName = targetCell.type;
                    const destroyedGarrison = targetCell.garrison ? [...targetCell.garrison] : []; // Capture garrison

                    defender.grid[targetSlotIndex] = null;
                    this.log(`💥 ${defender.name}'in ${destroyedBuildingName} binası yıkıldı!`);

                    // BARRACKS DESTRUCTION LOGIC (Salvage & Mercenary)
                    if (destroyedBuildingName === 'Kışla' && destroyedGarrison.length > 0) {
                        this.log(`🏚️ Kışla yıkıldı! ${destroyedGarrison.length} asker ortada kaldı.`);
                        this.handleBarracksDestruction(attacker, defender, destroyedGarrison);
                    }

                    // Check Game Over (Meclis destroyed)
                    if (destroyedBuildingName === 'Meclis') {
                        this.log(`👑 ${defender.name} MECLİSİ DÜŞTÜ!`);
                        this.eliminatePlayer(defender.id, attacker.id); // Assuming eliminatePlayer exists and takes player ID and attacker ID
                    } else {
                        // Other buildings: give 1 gold reward
                        attacker.gold += 1;
                        attacker.totalGoldEarned += 1;
                        this.log(`💰 ${attacker.name} yıkımdan 1 Altın kazandı!`);
                    }
                } else {
                    this.log(`🛡️ ${defender.name}, ${targetCell.type} hasar aldı. Kalan HP: ${targetCell.hp}`);

                    // Check if destroyed
                    if (targetCell.hp <= 0) {
                        const destroyedBuildingName = targetCell.type;
                        const destroyedGarrison = targetCell.garrison ? [...targetCell.garrison] : [];

                        defender.grid[targetSlotIndex] = null;
                        this.log(`💥 ${defender.name}'in ${destroyedBuildingName} binası yıkıldı!`);

                        // BARRACKS DESTRUCTION LOGIC
                        if (destroyedBuildingName === 'Kışla' && destroyedGarrison.length > 0) {
                            this.log(`🏚️ Kışla yıkıldı! ${destroyedGarrison.length} asker ortada kaldı.`);
                            this.handleBarracksDestruction(attacker, defender, destroyedGarrison);
                        }

                        // Gold Reward
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
            this.isCalculatingCombat = true;
            const { combatCalculator } = await import('./combatCalculator.js');
            await combatCalculator.showCombatCalculation(combatData);
        } catch (error) {
            console.error('Failed to load combat calculator:', error);
        } finally {
            this.isCalculatingCombat = false;
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
                if (window.renderer && window.renderer.showGameOver) {
                    window.renderer.showGameOver(winner);
                } else {
                    alert(`${winner.name} KAZANDI!`);
                }
                this.phase = 'SONUÇ'; // End Game State
                this.gameEnded = true;
            }
        }
    }

    checkAutoEndTurn() {
        if (this.isTurnTransitioning) return; // Locked during transition
        if (this.botTurnInProgress) return; // Bots handle their own turn end

        const player = this.getActivePlayer();
        // Auto-end turn for ALL players when actions reach 0
        if (player.actionsRemaining <= 0) {

            // SECURITY CHECK: Ensure we are checking the ACTIVE player
            if (player.id !== this.getActivePlayer().id) return;

            // Wait for combat calculation to finish
            if (this.isCalculatingCombat) {
                if (this.combatWaitTimer) clearTimeout(this.combatWaitTimer);
                this.combatWaitTimer = setTimeout(() => {
                    this.combatWaitTimer = null;
                    this.checkAutoEndTurn();
                }, 1000);
                return;
            }

            // Clear any existing timer first
            if (this.autoEndTimer) {
                clearTimeout(this.autoEndTimer);
            }

            // FORCE CLEAR ACTION MODE if no actions left
            // This prevents the game from getting stuck in attack mode with 0 actions
            if (this.actionMode) {
                this.clearActionMode();
            }

            // Set new timer
            console.log('⏳ Auto-end turn timer started (1.5s)');
            this.autoEndTimer = setTimeout(() => {
                console.log('⌛ Auto-ending turn now...');
                this.autoEndTimer = null;
                this.endTurn();
                window.renderer.render();
            }, 1500); // Reduced to 1.5s for better responsiveness
        }
    }

    endTurn() {
        if (this.phase === 'SONUÇ') return; // Game Over
        if (this.isTurnTransitioning) return; // Prevent double-execution
        if (this.isCalculatingCombat) return; // Wait for calculation to finish

        // Note: We check botTurnInProgress logic below, but we must allow the bot to call endTurn 
        // IF the bot clears the flag first. If called from button, we respect flag.

        // START TRANSACTION LOCK
        this.isTurnTransitioning = true;

        // CRITICAL: Clear ALL pending timers
        if (this.autoEndTimer) {
            clearTimeout(this.autoEndTimer);
            this.autoEndTimer = null;
        }
        if (this.combatWaitTimer) {
            clearTimeout(this.combatWaitTimer);
            this.combatWaitTimer = null;
        }
        if (this.botSafetyTimer) {
            clearTimeout(this.botSafetyTimer);
            this.botSafetyTimer = null;
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
            this.log("---------------");
            this.log(`TUR ${this.turn} BAŞLADI`);
        }

        // Reset Actions and Refreshes
        const nextPlayer = this.getActivePlayer();

        // DEBUG: Log turn sequence for debugging turn skip issues
        console.log(`🎯 Turn ${this.turn}, Player Index ${this.activePlayerIndex}: ${nextPlayer.name} (Bot: ${nextPlayer.isBot}, Vassal: ${nextPlayer.isVassal})`);

        // VASSAL SYSTEM: If next player is vassal, they get no actions
        if (nextPlayer.isVassal) {
            // Vassals might still need to pay taxes, so we run income logic
            // But they have no actions
            this.calculatePlayerIncome(nextPlayer);
            nextPlayer.actionsRemaining = 0; // Vassals cannot act
            // Vassals cannot buy cards (no refresh limit property needed)

            const master = this.players.find(p => p.id === nextPlayer.masterId);
            if (master && nextPlayer.gold > 0) {
                // ... (Tax transfer logic is handled in calculatePlayerIncome or here?)
                // Wait, calculatePlayerIncome handles "3. Pay Tax".
                // So we don't need to duplicate it here, BUT the original code had tax logic inside EndTurn for Vassals specifically?
                // Actually, my new calculatePlayerIncome INCLUDES "Pay Tax".
                // So I should let it run.
                // BUT, the original code had extra logic to LOG the transfer in endTurn block.
                // Let's rely on calculatePlayerIncome's internal tax logic to keep it DRY.
                // However, the original block also CLEARED gold: "nextPlayer.gold = 0;".
                // The new function decrements 1 by 1. 
                // The original logic completely emptied Vassal gold?
                // "master.gold += transferAmount; nextPlayer.gold = 0;" 
                // This looks like ALL gold is transferred.
                // My calculatePlayerIncome only takes 1 gold.
                // I should stick to the robust 'calculatePlayerIncome' approach of 1 gold tax, 
                // OR restore the "All Gold Transfer" if that was the game rule.
                // Given "Vassal" usually means "Owned", maybe all gold is correct?
                // Let's stick to the new standardized function which takes 1 gold tax.
                // If the user wants full tribute, we can adjust later.
            }

            // ... The block below handles skipping the turn visually/mechanically
            this.log(`⛓️ ${nextPlayer.name} (Vassal): Sıra pas geçildi.`);

            // Release lock shortly before triggering next turn to allow recursion
            setTimeout(() => {
                this.isTurnTransitioning = false;
                this.endTurn(); // Recursive call for next player
                window.renderer.render();
            }, 1500);
            return;
        } else {
            // Independent players get normal actions
            nextPlayer.actionsRemaining = 2;

            // CALCULATE INCOME for the independent player NOW
            this.calculatePlayerIncome(nextPlayer);
        }

        // White flag countdown
        if (nextPlayer.whiteFlagTurns > 0) {
            nextPlayer.whiteFlagTurns--;
            if (nextPlayer.whiteFlagTurns === 0) {
                this.log(`🏳️ ${nextPlayer.name}'in beyaz bayrağı sona erdi!`);
            }
        }

        this.log(`${nextPlayer.name} sırası.`);
        this.showGameTip();
        this.showTurnNotification(nextPlayer);

        // RELEASE LOCK after short delay to prevent double-clicks
        setTimeout(() => {
            this.isTurnTransitioning = false;
        }, 500);

        // If next player is a bot, execute bot turn automatically
        if (nextPlayer.isBot && window.botAI && !this.botTurnInProgress) {
            this.botTurnInProgress = true;
            const currentTurnIndex = this.activePlayerIndex; // Capture index

            // Disable end turn button during bot turn
            const endTurnBtn = document.getElementById('end-turn-btn');
            if (endTurnBtn) endTurnBtn.disabled = true;

            // Safety timeout - force end if bot takes too long
            const safetyTimeout = setTimeout(() => {
                // Verify we are still in the same turn before forcing end
                if (this.activePlayerIndex !== currentTurnIndex) return;

                console.warn('⚠️ Bot timeout - forcing end');
                this.botTurnInProgress = false;
                this.isTurnTransitioning = false; // Force unlock
                if (endTurnBtn) endTurnBtn.disabled = false;
                if (window.botAI) window.botAI.hideBotThinking();
                this.endTurn();
            }, 10000);

            // Note: Bot logic must handle safetyTimeout clearing if possible, or just ignore
            // We can store it to clear it later? 
            this.botSafetyTimer = safetyTimeout;

            // Trigger Bot Logic with delay
            setTimeout(async () => {
                // Guard: If turn already changed (e.g. by safety timer), abort
                if (this.activePlayerIndex !== currentTurnIndex) return;

                try {
                    await window.botAI.executeTurn(nextPlayer);

                    // Render to show bot's actions
                    window.renderer.render();

                    // Wait before ending bot turn
                    await new Promise(resolve => setTimeout(resolve, 800));

                    // Clear safety timeout
                    if (this.botSafetyTimer) clearTimeout(this.botSafetyTimer);
                    this.botSafetyTimer = null;

                    // CRITICAL: Reset bot flag BEFORE calling endTurn
                    // This allows consecutive bot turns to work properly
                    this.botTurnInProgress = false;

                    // Release transition lock if it was held (though endTurn does it)
                    this.isTurnTransitioning = false; // Force clear lock for next turn call

                    // Re-enable button
                    if (endTurnBtn) endTurnBtn.disabled = false;

                    // Guard again: Ensure turn didn't change while we waited
                    if (this.activePlayerIndex !== currentTurnIndex) return;

                    // End bot turn - this will advance to next player and trigger bot logic if needed
                    this.endTurn();

                    // Render to show new active player
                    window.renderer.render();

                } catch (error) {
                    console.error('Bot turn error:', error);
                    if (this.botSafetyTimer) clearTimeout(this.botSafetyTimer);
                    this.botTurnInProgress = false;
                    this.isTurnTransitioning = false;
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

        // Build Turn Report HTML
        let reportHtml = '';
        if (player.turnReport) {
            const r = player.turnReport;

            // Income Section
            if (r.income > 0) {
                reportHtml += `<div class="turn-report-item item-gold">💰 +${r.income} Altın</div>`;
            } else {
                reportHtml += `<div class="turn-report-item item-gold" style="color: #ef4444;">💰 Gelir Yok</div>`;
            }

            // Units Section
            if (r.newUnits.length > 0) {
                // Count unit types
                const unitCounts = {};
                r.newUnits.forEach(u => unitCounts[u] = (unitCounts[u] || 0) + 1);
                Object.entries(unitCounts).forEach(([name, count]) => {
                    reportHtml += `<div class="turn-report-item item-unit">⚔️ +${count} ${name} (Kışla)</div>`;
                });
            }

            // Population Section
            if (r.newCivilians > 0) {
                reportHtml += `<div class="turn-report-item item-pop">👥 +${r.newCivilians} Nüfus</div>`;
            }

            // Taxes
            if (r.taxPaid > 0) {
                reportHtml += `<div class="turn-report-item item-tax-paid">💸 -${r.taxPaid} Vergi Ödendi</div>`;
            }
            if (r.taxReceived > 0) {
                reportHtml += `<div class="turn-report-item item-tax-received">💎 +${r.taxReceived} Vergi Alındı</div>`;
            }

            // Notes
            if (r.notes && r.notes.length > 0) {
                r.notes.forEach(note => {
                    reportHtml += `<div class="turn-report-item item-note">📝 ${note}</div>`;
                });
            }
        }

        // Set notification content with player color
        const playerIcon = player.isBot ? '🤖' : '👑';
        notification.innerHTML = `
            <h2 style="color: ${player.color}; text-shadow: 0 0 20px ${player.color};">
                ${playerIcon} ${player.name}
            </h2>
            <div class="turn-notification-subtitle">Sıra Sizde!</div>
            <div class="turn-report-container">
                ${reportHtml}
            </div>
        `;

        // Show notification
        notification.style.display = 'block';
        notification.classList.remove('fade-out');

        // Hide after 3 seconds (increased form 2s to allow reading)
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.style.display = 'none';
            }, 300);
        }, 3000);
    }

    calculatePlayerIncome(p) {
        // Skip income on Turn 1 (Requested Feature)
        if (this.turn === 1) {
            this.log(`ℹ️ İlk turda gelir dağıtımı yapılmaz.`);
            return;
        }

        // Initialize Turn Report
        p.turnReport = {
            income: 0,
            incomeBreakdown: [],
            newUnits: [],
            newCivilians: 0,
            taxPaid: 0,
            taxReceived: 0,
            notes: []
        };

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
        const vassalIncome = vassals.length;
        income += vassalIncome;

        if (vassalIncome > 0) p.turnReport.taxReceived = vassalIncome;

        // 2.5 Economic Balance: If gold is >= 50% of cap, reduce income by 50%
        const goldCap = this.getGoldCap();
        if (p.gold >= goldCap / 2) {
            const originalIncome = income;
            income = Math.max(1, Math.floor(income / 2));
            this.log(`📉 ${p.name} zenginlik vergisi: Gelir %50 azaldı. (${originalIncome} → ${income})`);
            p.turnReport.notes.push("Zenginlik Vergisi (-%50 Gelir)");
        }

        // 3. Pay Tax (If Vassal, give 1 to Master)
        // This continues even when gold cap is near limit
        if (p.isVassal && p.gold > 0) {
            p.gold -= 1;
            p.turnReport.taxPaid = 1;
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
            p.turnReport.notes.push("Global Altın Limiti (Gelir Yok)");
        } else {
            // 5. Check Per-Player Gold Cap for capping income
            const currentGold = p.gold;
            const availableGold = goldCapPerPlayer - currentGold;

            if (availableGold <= 0) {
                this.log(`🚫 ${p.name} altın limitinde! Gelir alamadı. (${currentGold}/${goldCapPerPlayer})`);
                income = 0;
                p.turnReport.notes.push("Kişisel Altın Limiti (Gelir Yok)");
            } else if (income > availableGold) {
                income = availableGold;
                this.log(`⚠️ ${p.name} kısmi gelir aldı: ${income} Altın (Limit: ${goldCapPerPlayer})`);
                p.turnReport.notes.push("Limit Nedeniyle Kısıtlı Gelir");
            }
        }

        p.gold += income;
        p.totalGoldEarned += income; // Track total earned for statistics
        p.turnReport.income = income;

        // 5. Barracks Bonus (Each Kışla spawns 1 soldier in garrison)
        let totalProduced = 0;
        let fullBarracksCount = 0;
        const newSoldiers = [];

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

                // Check capacity (max 15 soldiers - UPDATED)
                if (cell.garrison.length < 15) {
                    const randomSoldier = soldierTypes[Math.floor(Math.random() * soldierTypes.length)];
                    cell.garrison.push({ ...randomSoldier });

                    totalProduced++;
                    newSoldiers.push(randomSoldier.name);
                    p.turnReport.newUnits.push(randomSoldier.name);
                } else {
                    fullBarracksCount++;
                }
            }
        });

        if (totalProduced > 0) {
            // Summary Log
            const uniqueTypes = [...new Set(newSoldiers)];
            const typeSummary = uniqueTypes.map(type => {
                const count = newSoldiers.filter(t => t === type).length;
                return `${count} ${type}`;
            }).join(', ');

            this.log(`🏰 ${p.name}, Kışlalardan +${totalProduced} asker kazandı! (${typeSummary})`);
        }

        if (fullBarracksCount > 0) {
            this.log(`⚠️ ${p.name}: ${fullBarracksCount} Kışla kapasitesi dolu! (Max 15/Kışla)`);
        }

        // 5.1 Science Center Production (1 Scientist per turn for 1 Gold)
        p.grid.forEach((cell, idx) => {
            if (cell && cell.type === 'Bilim Merkezi') {
                if (!cell.garrison) cell.garrison = [];

                // Capacity Check (Max 5)
                if (cell.garrison.length < 5) {
                    // Cost Check (1 Gold)
                    if (p.gold >= 1) {
                        p.gold -= 1;
                        cell.garrison.push({ name: 'Bilim İnsanı', type: 'Nüfus', power: 0 });
                        this.log(`🧪 ${p.name}, Bilim Merkezi'ne yeni bilim insanı aldı! (-1 Altın)`);
                    } else {
                        // Not enough gold - no recruitment
                        // this.log(`⚠️ ${p.name}, Bilim Merkezi için yeterli altına sahip değil.`);
                    }
                } else {
                    this.log(`⚠️ ${p.name}'in Bilim Merkezi dolu! (5/5)`);
                }
            }
        });


        // 5.5. Farm Civilian Production (if farm exists)
        // Throttle population growth: Only every 3 turns
        const canGrowPop = this.turn % 3 === 0;

        const hasFarm = p.grid.some(c => c && c.type === 'Çiftlik');
        const meclis = p.grid[0];

        if (canGrowPop) {
            if (hasFarm && meclis && meclis.garrison && meclis.garrison.length < 3) {
                meclis.garrison.push({ name: 'Sivil', type: 'Nüfus', power: 0 });
                this.log(`🌾 ${p.name}, Çiftlik 1 sivil üretti! (Meclis: ${meclis.garrison.length}/3)`);
                p.turnReport.newCivilians = 1;
            } else if (hasFarm) {
                this.log(`ℹ️ ${p.name} nüfusu tam, artış olmadı.`);
            }
        } else if (p.id === this.players[0].id && this.activePlayerIndex === 0) {
            // Log once per turn cycle for info (checking first player only to avoid spam)
            // Or better, log in global turn start
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
                    if (p.dp >= 1) {
                        p.dp -= 1;
                        meclis.garrison.push({ name: 'Sivil', type: 'Nüfus', power: 0 });
                        restored++;
                        usedDP++;
                    }
                    // Then try Gold (2 Gold per civilian)
                    else if (p.gold >= 2) {
                        p.gold -= 2;
                        meclis.garrison.push({ name: 'Sivil', type: 'Nüfus', power: 0 });
                        restored++;
                        usedGold += 2;
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
                        costMsg = `(-${usedDP} DP, -${usedGold} Altın)`;
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
    }

    getTotalGold() {
        // Return total earned gold (starting + all income), not current gold
        return this.players.reduce((sum, p) => sum + p.totalGoldEarned, 0);
    }

    getGoldCap() {
        // Per-player gold cap (not global pool)
        return 65;
    }

    getCapacityInfo(player) {
        // Base Capacity = 3 (Meclis) + (Barracks * 15)
        // Farms DO NOT count. Garrison Soldiers DO NOT count towards capacity.
        const barracks = player.grid.filter(c => c && c.type === 'Kışla').length;

        let baseCapacity = 3 + (barracks * 15);

        // Apply Food Technology Multiplier
        const foodTech = player.technologies.food;
        const techMultipliers = [1, 1.5, 3, 4.5, 6];
        const capacity = Math.floor(baseCapacity * techMultipliers[foodTech]);

        // Total Units = Pop (Civilians + Units on Grid + Garrison Soldiers)
        let armyCount = player.grid.filter(c => c && c.isUnit).length;

        // Count civilians in Meclis (assuming 1 Meclis per player, usually counts as 3 pop base if player.pop is 0)
        let basePop = player.pop > 0 ? player.pop : 3;

        // Calculate Garrison Soldiers (needed for Total Pop, but not Capacity)
        const garrisonSoldiers = player.grid.reduce((sum, c) => {
            if (c && c.type === 'Kışla' && c.garrison) {
                return sum + c.garrison.length;
            }
            return sum;
        }, 0);

        // Total Population = Base (Civilians) + Army on Grid + Garrison Soldiers
        let totalPop = basePop + armyCount + garrisonSoldiers;

        return { capacity, totalPop };
    }

    checkCapacity(player) {
        const { capacity, totalPop } = this.getCapacityInfo(player);

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

    // --- BARRACKS DESTRUCTION & MERCENARY SYSTEM ---

    handleBarracksDestruction(attacker, defender, garrison) {
        if (!garrison || garrison.length === 0) return;

        const totalSoldiers = garrison.length;
        const halfCount = Math.floor(totalSoldiers / 2);

        // Attacker gets half
        const attackerShare = garrison.slice(0, halfCount);
        // User said "50% attacker, 50% defender". Let's give remainder to defender.
        const defenderShare = garrison.slice(halfCount);

        this.log(`⚖️ Asker Paylaşımı: ${attacker.name} (${attackerShare.length}), ${defender.name} (${defenderShare.length})`);

        // Distribute or Sell
        if (attackerShare.length > 0) this.distributeOrSellSoldiers(attacker, attackerShare, 'attacker');
        if (defenderShare.length > 0) this.distributeOrSellSoldiers(defender, defenderShare, 'defender');
    }

    distributeOrSellSoldiers(player, soldiers, role) {
        // 1. Try to fill existing Barracks
        const barracksList = player.grid.filter(c => c && c.type === 'Kışla');
        const remainingSoldiers = [];

        for (const soldier of soldiers) {
            let placed = false;
            for (const barracks of barracksList) {
                if (!barracks.garrison) barracks.garrison = [];
                if (barracks.garrison.length < 15) {
                    barracks.garrison.push(soldier);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                remainingSoldiers.push(soldier);
            }
        }

        const placedCount = soldiers.length - remainingSoldiers.length;
        if (placedCount > 0) {
            const verb = role === 'attacker' ? 'katıldı' : 'sığındı';
            this.log(`➡️ ${placedCount} asker ${player.name} ordusuna ${verb}.`);
        }

        // 2. Sell Overflow to Market as Mercenary Card
        if (remainingSoldiers.length > 0) {
            const count = remainingSoldiers.length;
            const cost = this.calculateMercenaryCost(count);

            const mercenaryCard = {
                id: 'merc_' + Date.now() + '_' + Math.random(),
                type: 'Paralı Asker',
                name: `Paralı Asker (${count})`,
                count: count,
                soldiers: remainingSoldiers,
                cost: cost,
                description: `${count} adet tecrübeli asker.`
            };

            if (!this.openMarket) this.openMarket = [];
            this.openMarket.push(mercenaryCard);
            this.log(`💰 ${count} asker sığacak yer bulamadı ve Paralı Asker olarak pazara düştü! (${cost} Altın)`);
        }
    }

    calculateMercenaryCost(count) {
        if (count <= 10) return 1;
        if (count <= 20) return 2;
        return 3; // 21-30+
    }

    playMercenaryCard(handIndex) {
        const player = this.getActivePlayer();
        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const card = player.hand[handIndex];
        if (!card || card.type !== 'Paralı Asker') return { success: false, msg: "Geçersiz kart!" };

        // Try to place soldiers
        const soldiers = card.soldiers;
        const barracksList = player.grid.filter(c => c && c.type === 'Kışla');
        let placedCount = 0;

        for (const soldier of soldiers) {
            for (const barracks of barracksList) {
                if (!barracks.garrison) barracks.garrison = [];
                if (barracks.garrison.length < 15) {
                    barracks.garrison.push(soldier);
                    placedCount++;
                    break;
                }
            }
        }

        if (placedCount === 0) {
            return { success: false, msg: "Kışlalarda hiç yer yok!" };
        }

        // Action cost
        player.actionsRemaining -= 1;
        player.hand.splice(handIndex, 1);

        this.log(`⚔️ ${player.name}, ${placedCount} paralı askeri ordusuna kattı!`);

        if (placedCount < soldiers.length) {
            this.log(`⚠️ ${soldiers.length - placedCount} asker yer bulamadığı için dağıldı.`);
        }

        this.checkAutoEndTurn();
        return { success: true };
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
        this.selectedCardIndex = null; // Clear selection

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
                    case 'repair_building': // Mimari Onarım
                        // Target: Kışla, Duvar, Çiftlik only (as requested)
                        const allowedTypes = ['Kışla', 'Duvar', 'Çiftlik'];
                        const maxHpValues = { 'Kışla': 6, 'Duvar': 6, 'Çiftlik': 5 };

                        // Find damaged valid buildings
                        const damagedBuildings = player.grid.filter(c =>
                            c &&
                            allowedTypes.includes(c.type) &&
                            c.hp < maxHpValues[c.type]
                        );

                        if (damagedBuildings.length === 0) {
                            this.log(`⚠️ ONARIM BAŞARISIZ! ${player.name}'in onarılacak hasarlı binası (Kışla, Duvar, Çiftlik) yok!`);
                            player.hand.push(card);
                            player.actionsRemaining += 1;
                            player.dp -= card.dp || 0;
                            return { success: false, msg: "Onarılacak hasarlı bina yok!" };
                        }

                        // Repair the most damaged one (lowest HP relative to max? Or absolute?)
                        // User strategy: Repair the one closest to death (lowest absolute HP)
                        damagedBuildings.sort((a, b) => a.hp - b.hp);
                        const targetBuilding = damagedBuildings[0];

                        const oldHp = targetBuilding.hp;
                        const targetMax = maxHpValues[targetBuilding.type];
                        targetBuilding.hp = targetMax; // FULL REPAIR

                        this.log(`🔨 MİMARİ ONARIM: ${player.name}, ${targetBuilding.type} binasını tamamen yeniledi! (${oldHp} -> ${targetBuilding.hp} HP)`);
                        break;

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
                                // Check Population Limit
                                const { capacity, totalPop } = this.getCapacityInfo(player);
                                if (totalPop + 1 > capacity) {
                                    this.log(`⚠️ PROPAGANDA BAŞARISIZ! ${player.name} nüfus limiti dolu! (${totalPop}/${capacity})`);
                                    break;
                                }

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

                    case 'terror_joker': // Terör Jokeri
                        // Requirement: 10 DP
                        if (player.dp < 10) {
                            this.log(`❌ TERÖR JOKERİ BAŞARISIZ! ${player.name} yeterli DP'ye sahip değil! (${player.dp}/10)`);
                            player.hand.push(card);
                            player.actionsRemaining += 1;
                            // No DP cost if failed requirement? Or penalty? Usually just return card.
                            return { success: false, msg: `En az 10 DP gerekli! (Mevcut: ${player.dp})` };
                        }

                        // Usage Cost: 2 DP
                        player.dp = Math.max(0, player.dp - 2);

                        // Target validation
                        const terrorTarget = target.grid.map((cell, idx) => ({ cell, idx })).filter(item => item.cell && !item.cell.isUnit); // Buildings only

                        // Specific target logic needed? 
                        // Current `playDiplomacyCard` doesn't pass specific slot index, only player ID.
                        // So we need to select a random building OR ask user to target a slot.
                        // Since `playDiplomacyCard` structure assumes "Target Player", we will pick a RANDOM building for now or implementing targeting is complex.
                        // Wait, `attackSlot` uses `targetSlotIndex`. `playDiplomacyCard` does NOT interact with grid clicks in the same way.
                        // Renderer handles 'Diplomacy' with `needsTarget` by entering a mode?
                        // Line 628 in renderer.js: `this.game.pendingDiplomacyCard = { cardIndex: index, card: card };`
                        // This allows clicking a player card. It DOES NOT allow clicking a grid slot.

                        // PROPOSAL: Terror Joker destroys a RANDOM building of the target player (excluding Meclis).
                        // This fits the "Terror" theme (unpredictable/chaos) and existing UI constraints.

                        const destructibleBuildings = target.grid
                            .map((cell, idx) => ({ cell, idx }))
                            .filter(item => item.cell && !item.cell.isUnit && item.cell.type !== 'Meclis');

                        if (destructibleBuildings.length > 0) {
                            const randomBuilding = destructibleBuildings[Math.floor(Math.random() * destructibleBuildings.length)];
                            const slotIdx = randomBuilding.idx;
                            const bName = randomBuilding.cell.type;
                            const bGarrison = randomBuilding.cell.garrison ? [...randomBuilding.cell.garrison] : [];

                            // Destroy
                            target.grid[slotIdx] = null;
                            this.log(`💣 TERÖR JOKERİ! ${player.name}, ${target.name}'in ${bName} binasını havaya uçurdu! (-2 DP)`);

                            // If Kışla, trigger salvage
                            if (bName === 'Kışla') {
                                this.log(`🏚️ Yıkılan Kışla'dan askerler kaçışıyor...`);
                                this.handleBarracksDestruction(player, target, bGarrison);
                            }
                        } else {
                            this.log(`⚠️ TERÖR JOKERİ ETKİSİZ! ${target.name}'in yıkılacak binası yok!`);
                            // Refund? No, card used.
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

                    default:
                        this.log(`⚠️ Bilinmeyen Diplomasi Kartı: ${card.effect} `);
                }
            }
        }

        this.checkAutoEndTurn();
        return { success: true, needsTarget: card.effect && card.effect !== 'gold_boost' && card.effect !== 'military_boost' };
    }

    // TECHNOLOGY
    playTechnologyCard(handIndex, techType = null) {
        const player = this.getActivePlayer();

        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const card = player.hand[handIndex];
        if (!card || card.type !== 'Teknoloji') return { success: false, msg: "Geçersiz kart!" };

        // 1. Science Center Requirement (Building must exist)
        const hasScienceCenter = player.grid.some(cell => cell && cell.type === 'Bilim Merkezi');
        if (!hasScienceCenter) {
            return { success: false, msg: "Teknoloji geliştirmek için 'Bilim Merkezi' binasına sahip olmalısınız!" };
        }

        // Check available scientists in Science Centers
        let totalScientists = 0;
        player.grid.forEach(cell => {
            if (cell && cell.type === 'Bilim Merkezi' && cell.garrison) {
                totalScientists += cell.garrison.length;
            }
        });

        if (totalScientists < card.popCost) {
            return { success: false, msg: `Yetersiz Bilim İnsanı! ${card.popCost} Bilim İnsanı gerekli. (Mevcut: ${totalScientists})` };
        }

        let targetTechType = card.techType;
        let targetLevel = card.level;

        // Special handling for Joker card
        if (card.isJoker) {
            // Options
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

            // If techType is null, UI needs to ask user
            if (!techType) {
                return {
                    success: false,
                    msg: "JOKER_SELECTION_NEEDED",
                    availableTechs: availableTechs,
                    cardIndex: handIndex
                };
            }

            // Verify selection
            const selected = availableTechs.find(t => t.type === techType);
            if (!selected) {
                return { success: false, msg: "Geçersiz teknoloji seçimi!" };
            }

            targetTechType = selected.type;
            targetLevel = selected.currentLevel + 1;
        } else {
            // Regular tech card - check if player already has this level or higher
            const currentLevel = player.technologies[card.techType];
            if (currentLevel >= card.level) {
                return { success: false, msg: "Bu teknolojiye zaten sahipsin!" };
            }
        }

        // Consume population (Scientists) from Science Centers
        let remaining = card.popCost;

        for (let cell of player.grid) {
            if (remaining <= 0) break;
            if (cell && cell.type === 'Bilim Merkezi' && cell.garrison && cell.garrison.length > 0) {
                const scientistsToRemove = Math.min(remaining, cell.garrison.length);
                cell.garrison.splice(0, scientistsToRemove);
                remaining -= scientistsToRemove;
            }
        }

        player.actionsRemaining -= 1;

        // Apply technology
        player.technologies[targetTechType] = targetLevel;

        // Remove card from hand
        player.hand.splice(handIndex, 1);

        const techName = card.isJoker ? `${targetTechType} Lv${targetLevel} ` : card.name;
        this.log(`${player.name}, ${techName} araştırdı!`);

        // Clean up deck from old tech levels
        this.cleanupMarketDeck();

        this.checkAutoEndTurn();
        return { success: true };
    }

    /**
     * Removes technology cards from current deck that are no longer needed
     * (Lower or equal to current levels of all players)
     */
    cleanupMarketDeck() {
        if (!this.market || this.market.length === 0) return;

        // Collect max levels for each tech type across all players
        const maxLevels = { food: 0, military: 0, defense: 0, commerce: 0 };
        this.players.forEach(p => {
            for (let type in p.technologies) {
                maxLevels[type] = Math.max(maxLevels[type], p.technologies[type]);
            }
        });

        // Filter market deck
        const originalCount = this.market.length;
        this.market = this.market.filter(c => {
            if (c.type !== 'Teknoloji') return true;
            if (c.isJoker) return true; // Keep Jokers

            // Check if ANY player could still use this card (level >= playerLevel + 1)
            // Actually, if we want to be strict for the ACTIVE player, we might hide them,
            // but for the deck we only remove if NOBODY can ever use it.
            return this.players.some(p => {
                const current = p.technologies[c.techType];
                return c.level === current + 1;
            });
        });

        if (this.market.length < originalCount) {
            console.log(`🧹 Market temizlendi: ${originalCount - this.market.length} eski teknoloji kartı kaldırıldı.`);
        }
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
            return { success: false, msg: `❌ Sadece daha yüksek DP'li oyuncular ittifak teklif edebilir!\n\nSenin DP'n: ${proposer.dp} \n${target.name} DP: ${target.dp} \n\nİpucu: Diplomasi kartları oynayarak DP'ni artır.` };
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
