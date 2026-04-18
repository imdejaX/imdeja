import { CombatMixin } from './combat.js';
import { EconomyMixin } from './economy.js';
import { DiplomacyMixin } from './diplomacy.js';
import { TechnologyMixin } from './technology.js';

export class Game {
    constructor() {
        this.turn = 1;
        this.phase = "HAZIRLIK";
        this.activePlayerIndex = 0;
        this.selectedCardIndex = null;
        this.pendingAttack = null;
        this.pendingDiplomacyCard = null;
        this.gameEnded = false;
        this.botTurnInProgress = false;
        this.isCalculatingCombat = false;

        const playerCount = parseInt(localStorage.getItem('playerCount')) || 2;
        const botCount = parseInt(localStorage.getItem('botCount')) || 0;

        const colors = [
            '#dc2626', '#2563eb', '#059669', '#f59e0b',
            '#7c3aed', '#db2777', '#0891b2', '#65a30d'
        ];
        const defaultNames = [
            'Kızıl Krallık', 'Mavi Krallık', 'Yeşil Krallık', 'Altın Krallık',
            'Mor Hanedanlık', 'Pembe İmparatorluk', 'Camgöbeği Sultanlığı', 'Zeytin Konfederasyonu'
        ];

        // Kullanıcının menüde girdiği özel isimler (varsa)
        let customNames = [];
        try {
            customNames = JSON.parse(localStorage.getItem('playerNames') || '[]');
        } catch (e) { customNames = []; }

        this.players = [];
        for (let i = 0; i < playerCount; i++) {
            const name = (customNames[i] && customNames[i].trim()) ? customNames[i].trim() : defaultNames[i];
            const player = this.createPlayer(i + 1, name, colors[i]);
            player.isBot = i >= (playerCount - botCount);
            this.players.push(player);
        }

        this.market = this.createDeck();
        this.openMarket = [];
        this.mercenaryPool = [];
        this.refillMarket();

        this.logs = [{ turn: 1, message: "Oyun Başladı!" }];

        this.actionMode = null;
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
            totalGoldEarned: 8,
            pop: 0,
            dp: 1,
            isVassal: false,
            masterId: null,
            allianceWith: null,
            technologies: {
                food: 0,
                military: 0,
                defense: 0,
                commerce: 0
            },
            militaryBoost: 0,
            whiteFlagTurns: 0,
            marketRefreshes: 0,
            grid: Array(9).fill(null),
            hand: [],
            actionsRemaining: 2,
            attackedBy: []
        };
    }

    createDeck() {
        const playerCount = this.players.length;
        const baseAndCount = Math.max(1, playerCount);

        const buildingCards = [];
        for (let i = 0; i < baseAndCount * 2; i++) buildingCards.push({ name: 'Çiftlik', cost: 3, type: 'Bina', hp: 5, power: 8 });
        for (let i = 0; i < baseAndCount * 3; i++) buildingCards.push({ name: 'Kışla', cost: 4, type: 'Bina', hp: 6, power: 12 });
        for (let i = 0; i < baseAndCount * 1; i++) buildingCards.push({ name: 'Duvar', cost: 5, type: 'Bina', hp: 6, power: 20 });
        for (let i = 0; i < baseAndCount * 1; i++) buildingCards.push({ name: 'Pazar', cost: 3, type: 'Bina', hp: 3, power: 8 });
        for (let i = 0; i < baseAndCount * 1; i++) buildingCards.push({ name: 'Bilim Merkezi', cost: 5, type: 'Bina', hp: 4, power: 5 });

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
            { name: 'Mimari Onarım', cost: 4, type: 'Diplomasi', dp: 2, effect: 'repair_building' },
            { name: 'Terör Jokeri', cost: 20, type: 'Diplomasi', dp: 0, effect: 'terror_joker' }
        ];

        const technologyCards = [
            { name: 'Silah', cost: 5, popCost: 2, type: 'Teknoloji', techType: 'military', level: 1, multiplier: 1.2 },
            { name: 'Silah', cost: 10, popCost: 3, type: 'Teknoloji', techType: 'military', level: 2, multiplier: 1.5 },
            { name: 'Silah', cost: 15, popCost: 4, type: 'Teknoloji', techType: 'military', level: 3, multiplier: 2 },
            { name: 'Silah', cost: 25, popCost: 5, type: 'Teknoloji', techType: 'military', level: 4, multiplier: 2.5 },
            { name: 'Savunma', cost: 5, popCost: 2, type: 'Teknoloji', techType: 'defense', level: 1, multiplier: 1.2 },
            { name: 'Savunma', cost: 10, popCost: 3, type: 'Teknoloji', techType: 'defense', level: 2, multiplier: 1.5 },
            { name: 'Savunma', cost: 15, popCost: 4, type: 'Teknoloji', techType: 'defense', level: 3, multiplier: 2 },
            { name: 'Savunma', cost: 25, popCost: 5, type: 'Teknoloji', techType: 'defense', level: 4, multiplier: 2.5 },
            { name: 'Ticaret', cost: 5, popCost: 2, type: 'Teknoloji', techType: 'commerce', level: 1, multiplier: 1.5 },
            { name: 'Ticaret', cost: 10, popCost: 3, type: 'Teknoloji', techType: 'commerce', level: 2, multiplier: 2 },
            { name: 'Ticaret', cost: 15, popCost: 4, type: 'Teknoloji', techType: 'commerce', level: 3, multiplier: 2.5 },
            { name: 'Ticaret', cost: 25, popCost: 5, type: 'Teknoloji', techType: 'commerce', level: 4, multiplier: 3 },
            { name: 'Joker', cost: 10, popCost: 2, type: 'Teknoloji', techType: 'joker', level: 0, isJoker: true }
        ];

        let deck = [];

        buildingCards.forEach(c => deck.push({ id: `card-${deck.length}`, ...c }));

        const militaryCount = playerCount * 15;
        for (let i = 0; i < militaryCount; i++) {
            const template = militaryCards[Math.floor(Math.random() * militaryCards.length)];
            deck.push({ id: `card-${deck.length}`, ...template });
        }

        const dipCount = playerCount * 8;
        for (let i = 0; i < dipCount; i++) {
            const template = diplomacyCards[Math.floor(Math.random() * diplomacyCards.length)];
            deck.push({ id: `card-${deck.length}`, ...template });
        }

        const regularTechCards = technologyCards.filter(c => !c.isJoker);
        const techCount = playerCount * 6;
        for (let i = 0; i < techCount; i++) {
            const template = regularTechCards[Math.floor(Math.random() * regularTechCards.length)];
            deck.push({ id: `card-${deck.length}`, ...template });
        }

        const jokerCard = technologyCards.find(c => c.isJoker);
        if (jokerCard) {
            for (let i = 0; i < playerCount; i++) {
                deck.push({ id: `card-${deck.length}`, ...jokerCard });
            }
        }

        // Shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        console.log(`Deck created with ${deck.length} cards for ${playerCount} players.`);
        return deck;
    }

    refillMarket() {
        if (this.openMarket.length >= 4) return;

        const requiredTypes = ['Bina', 'Asker', 'Diplomasi', 'Teknoloji'];
        const player = this.getActivePlayer();

        requiredTypes.forEach(type => {
            if (this.openMarket.some(c => c.type === type)) return;

            if (type === 'Teknoloji') {
                for (let i = 0; i < this.market.length; i++) {
                    const card = this.market[i];
                    if (card.type !== 'Teknoloji') continue;

                    if (card.isJoker) {
                        this.openMarket.push(this.market.splice(i, 1)[0]);
                        break;
                    }

                    const currentLevel = player.technologies[card.techType];
                    if (card.level === currentLevel + 1) {
                        const hasInHand = player.hand.some(h =>
                            h.type === 'Teknoloji' && h.techType === card.techType && h.level === card.level
                        );
                        if (!hasInHand) {
                            this.openMarket.push(this.market.splice(i, 1)[0]);
                            break;
                        }
                    } else if (card.level <= currentLevel) {
                        this.market.splice(i, 1);
                        i--;
                    }
                }
            } else {
                const cardIndex = this.market.findIndex(c => c.type === type);
                if (cardIndex !== -1) {
                    this.openMarket.push(this.market.splice(cardIndex, 1)[0]);
                }
            }
        });
    }

    refreshMarket() {
        const activePlayer = this.getActivePlayer();
        if (typeof activePlayer.marketRefreshes !== 'number') activePlayer.marketRefreshes = 0;

        if (activePlayer.marketRefreshes >= 2) {
            return { success: false, msg: 'Bu turda daha fazla yenileme yapamazsınız! (Maksimum 2)' };
        }

        activePlayer.marketRefreshes++;

        if (this.openMarket.length > 0) {
            const mercenaries = this.openMarket.filter(c => c.type === 'Paralı Asker');
            const others = this.openMarket.filter(c => c.type !== 'Paralı Asker');
            if (others.length > 0) this.market.push(...others);
            this.openMarket = [...mercenaries];
        }

        this.refillMarket();
        return { success: true };
    }

    initializeBoard() {
        this.players.forEach(p => {
            p.grid[0] = {
                type: 'Saray', hp: 10, power: 20,
                garrison: [
                    { name: 'Sivil', type: 'Nüfus', power: 0 },
                    { name: 'Sivil', type: 'Nüfus', power: 0 },
                    { name: 'Sivil', type: 'Nüfus', power: 0 }
                ]
            };
            p.grid[1] = { type: 'Çiftlik', hp: 5, power: 4 };

            const startingSoldiers = [];
            const soldierTypes = [
                { name: 'Piyade', cost: 2, type: 'Asker', power: 2, hp: 3, isUnit: true },
                { name: 'Okçu', cost: 3, type: 'Asker', power: 3, hp: 4, isUnit: true }
            ];
            for (let i = 0; i < 5; i++) {
                startingSoldiers.push(soldierTypes[Math.floor(Math.random() * soldierTypes.length)]);
            }
            p.grid[3] = { type: 'Kışla', hp: 6, power: 12, garrison: startingSoldiers };
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
        const counts = { 'Bina': 0, 'Asker': 0, 'Diplomasi': 0, 'Teknoloji': 0 };
        this.market.forEach(card => {
            if (counts[card.type] !== undefined) counts[card.type]++;
        });
        return counts;
    }

    log(msg) {
        this.logs.unshift({ turn: this.turn, message: msg });
    }

    showGameTip() {
        const tips = [
            "💡 Askeri gücünü artır ve rakibi alt etmeyi dene",
            "💡 Altın kaynaklarını doğru kartlara kullan",
            "💡 Çiftlik ile gelirini artır, daha fazla altın kazan",
            "💡 Kışla her tur otomatik asker üretir",
            "💡 Duvar tüm saldırıları karşılar, önce Duvar'ı yıkmalısın",
            "💡 Pazar her tur +2 altın geliri sağlar",
            "💡 Piyade + Okçu + Süvari + Kışla ile %20 saldırı bonusu kazan",
            "💡 İttifak kurarak güçlü rakiplere karşı korun",
            "💡 Diplomasi kartları strateji için çok önemlidir",
            "💡 Teknoloji kartları uzun vadede güç kazandırır",
            "💡 Saray'daki sivil sayısını 3'te tut",
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
        if (window.renderer && window.renderer.showSubtitle) {
            window.renderer.showSubtitle(randomTip);
        }
    }

    setActionMode(mode) {
        if (mode === 'attack') {
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

    buyCard(marketSlotIndex, source = 'openMarket') {
        const player = this.getActivePlayer();
        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        let card = null;
        let sourceArray = null;

        if (source === 'mercenaryPool') {
            if (marketSlotIndex >= this.mercenaryPool.length) return { success: false, msg: "Geçersiz kart." };
            sourceArray = this.mercenaryPool;
            card = sourceArray[marketSlotIndex];
        } else {
            if (marketSlotIndex >= this.openMarket.length) return { success: false, msg: "Geçersiz kart." };
            sourceArray = this.openMarket;
            card = sourceArray[marketSlotIndex];
        }

        if (player.gold < card.cost) return { success: false, msg: "Yetersiz Altın!" };

        if (card.type === 'Teknoloji') {
            const hasScienceCenter = player.grid.some(cell => cell && cell.type === 'Bilim Merkezi');
            if (!hasScienceCenter) {
                return { success: false, msg: "Teknoloji geliştirmek için 'Bilim Merkezi' binasına sahip olmalısınız!" };
            }
        }

        player.gold -= card.cost;
        player.actionsRemaining -= 1;
        player.hand.push(card);
        sourceArray.splice(marketSlotIndex, 1);

        if (source === 'openMarket') this.refillMarket();

        this.log(`${player.name}, ${card.name} aldı.`);
        this.checkAutoEndTurn();
        return { success: true };
    }

    selectHandCard(index) {
        this.selectedCardIndex = this.selectedCardIndex === index ? null : index;
    }

    buildOnSlot(slotIndex) {
        const player = this.getActivePlayer();
        if (this.selectedCardIndex === null) return { success: false, msg: "Önce bir kart seçin." };
        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const card = player.hand[this.selectedCardIndex];
        const currentSlot = player.grid[slotIndex];

        if (card.type === 'Diplomasi') {
            player.dp += card.dp || 0;
            player.grid[slotIndex] = { type: card.name, hp: card.hp, power: card.power };

            if (card.name === 'Bilim Merkezi') {
                player.grid[slotIndex].garrison = [{ name: 'Bilim İnsanı', type: 'Nüfus', power: 0 }];
                player.grid[slotIndex].capacity = 5;
                this.log(`🧪 Bilim Merkezi kuruldu! 1 Bilim İnsanı göreve başladı.`);
            }

            player.actionsRemaining -= 1;
            player.hand.splice(this.selectedCardIndex, 1);
            this.selectedCardIndex = null;
            this.log(`${player.name}, ${card.name} inşa etti.`);
            this.checkAutoEndTurn();
            return { success: true };
        }

        if (currentSlot && currentSlot.type !== 'Boş') {
            return { success: false, msg: "Alan dolu!" };
        }

        if (card.type === 'Asker') {
            const { capacity, totalPop } = this.getCapacityInfo(player);
            if (totalPop + 1 > capacity) {
                return { success: false, msg: `Nüfus limiti aşıldı! (Mevcut: ${totalPop}/${capacity})` };
            }
        }

        player.grid[slotIndex] = { type: card.name, hp: card.hp || 3, power: card.power || 0, isUnit: card.type === 'Asker' };
        player.actionsRemaining -= 1;
        player.hand.splice(this.selectedCardIndex, 1);
        this.selectedCardIndex = null;

        this.log(`${player.name}, ${card.name} inşa etti.`);
        this.checkAutoEndTurn();
        return { success: true };
    }

    demolishBuilding(slotIndex) {
        const player = this.getActivePlayer();
        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const cell = player.grid[slotIndex];
        if (!cell) return { success: false, msg: "Bu konumda bina yok!" };
        if (cell.type === 'Saray') return { success: false, msg: "Saray yıkılamaz!" };
        if (cell.isUnit) return { success: false, msg: "Askerler yıkılamaz!" };

        const buildingName = cell.type;
        player.grid[slotIndex] = null;
        player.actionsRemaining -= 1;

        this.log(`🔨 ${player.name}, ${buildingName} binasını yıktı!`);
        this.clearActionMode();
        this.checkAutoEndTurn();
        return { success: true };
    }

    endTurn() {
        if (this.phase === 'SONUÇ') return;
        if (this.isTurnTransitioning) return;
        if (this.isCalculatingCombat) return;

        this.isTurnTransitioning = true;

        if (this.autoEndTimer) { clearTimeout(this.autoEndTimer); this.autoEndTimer = null; }
        if (this.combatWaitTimer) { clearTimeout(this.combatWaitTimer); this.combatWaitTimer = null; }
        if (this.botSafetyTimer) { clearTimeout(this.botSafetyTimer); this.botSafetyTimer = null; }

        const marketModal = document.getElementById('market-modal');
        if (marketModal && marketModal.open) marketModal.close();

        this.selectedCardIndex = null;
        this.clearActionMode();
        this.activePlayerIndex++;
        if (this.activePlayerIndex >= this.players.length) {
            this.activePlayerIndex = 0;
            this.turn++;
            this.log("---------------");
            this.log(`TUR ${this.turn} BAŞLADI`);
        }

        const nextPlayer = this.getActivePlayer();
        console.log(`🎯 Turn ${this.turn}, Player Index ${this.activePlayerIndex}: ${nextPlayer.name} (Bot: ${nextPlayer.isBot}, Vassal: ${nextPlayer.isVassal})`);

        if (nextPlayer.isVassal) {
            this.calculatePlayerIncome(nextPlayer);
            nextPlayer.actionsRemaining = 0;
            this.log(`⛓️ ${nextPlayer.name} (Vassal): Sıra pas geçildi.`);

            setTimeout(() => {
                this.isTurnTransitioning = false;
                this.endTurn();
                window.renderer.render();
            }, 1500);
            return;
        } else {
            nextPlayer.actionsRemaining = 2;
            this.calculatePlayerIncome(nextPlayer);
        }

        if (nextPlayer.whiteFlagTurns > 0) {
            nextPlayer.whiteFlagTurns--;
            if (nextPlayer.whiteFlagTurns === 0) {
                this.log(`🏳️ ${nextPlayer.name}'in beyaz bayrağı sona erdi!`);
            }
        }

        this.log(`${nextPlayer.name} sırası.`);
        this.showGameTip();
        this.showTurnNotification(nextPlayer);

        setTimeout(() => { this.isTurnTransitioning = false; }, 500);

        if (nextPlayer.isBot && window.botAI && !this.botTurnInProgress) {
            this.botTurnInProgress = true;
            const currentTurnIndex = this.activePlayerIndex;

            const endTurnBtn = document.getElementById('end-turn-btn');
            if (endTurnBtn) endTurnBtn.disabled = true;

            const safetyTimeout = setTimeout(() => {
                if (this.activePlayerIndex !== currentTurnIndex) return;
                console.warn('⚠️ Bot timeout - forcing end');
                this.botTurnInProgress = false;
                this.isTurnTransitioning = false;
                if (endTurnBtn) endTurnBtn.disabled = false;
                if (window.botAI) window.botAI.hideBotThinking();
                this.endTurn();
            }, 10000);

            this.botSafetyTimer = safetyTimeout;

            setTimeout(async () => {
                if (this.activePlayerIndex !== currentTurnIndex) return;

                try {
                    await window.botAI.executeTurn(nextPlayer);
                    window.renderer.render();
                    await new Promise(resolve => setTimeout(resolve, 800));

                    if (this.botSafetyTimer) clearTimeout(this.botSafetyTimer);
                    this.botSafetyTimer = null;
                    this.botTurnInProgress = false;
                    this.isTurnTransitioning = false;
                    if (endTurnBtn) endTurnBtn.disabled = false;
                    if (this.activePlayerIndex !== currentTurnIndex) return;

                    this.endTurn();
                    window.renderer.render();
                } catch (error) {
                    console.error('Bot turn error:', error);
                    if (this.botSafetyTimer) clearTimeout(this.botSafetyTimer);
                    this.botTurnInProgress = false;
                    this.isTurnTransitioning = false;
                    if (endTurnBtn) endTurnBtn.disabled = false;
                    this.log(`⚠️ Bot hatası: ${error.message}`);
                    this.log(`⚠️ Tur geçiliyor...`);
                    this.endTurn();
                    try { window.renderer.render(); } catch (e) { console.error("Render crash in error handler", e); }
                }
            }, 1200);
        }
    }

    showTurnNotification(player) {
        if (window.soundManager) window.soundManager.playTurnStart();

        let notification = document.getElementById('turn-notification-popup');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'turn-notification-popup';
            notification.className = 'turn-notification';
            document.body.appendChild(notification);
        }

        let reportHtml = '';
        if (player.turnReport) {
            const r = player.turnReport;

            if (r.income > 0) {
                reportHtml += `<div class="turn-report-item item-gold">💰 +${r.income} Altın</div>`;
            } else {
                reportHtml += `<div class="turn-report-item item-gold" style="color: #ef4444;">💰 Gelir Yok</div>`;
            }

            if (r.newUnits.length > 0) {
                const unitCounts = {};
                r.newUnits.forEach(u => unitCounts[u] = (unitCounts[u] || 0) + 1);
                Object.entries(unitCounts).forEach(([name, count]) => {
                    reportHtml += `<div class="turn-report-item item-unit">⚔️ +${count} ${name} (Kışla)</div>`;
                });
            }

            if (r.newCivilians > 0) {
                reportHtml += `<div class="turn-report-item item-pop">👥 +${r.newCivilians} Nüfus</div>`;
            }
            if (r.taxPaid > 0) {
                reportHtml += `<div class="turn-report-item item-tax-paid">💸 -${r.taxPaid} Vergi Ödendi</div>`;
            }
            if (r.taxReceived > 0) {
                reportHtml += `<div class="turn-report-item item-tax-received">💎 +${r.taxReceived} Vergi Alındı</div>`;
            }
            if (r.notes && r.notes.length > 0) {
                r.notes.forEach(note => {
                    reportHtml += `<div class="turn-report-item item-note">📝 ${note}</div>`;
                });
            }
        }

        const playerIcon = player.isBot ? '🤖' : '👑';
        notification.innerHTML = `
            <h2 style="color: ${player.color}; text-shadow: 0 0 20px ${player.color};">
                ${playerIcon} ${player.name}
            </h2>
            <div class="turn-notification-subtitle">Sıra Sizde!</div>
            <div class="turn-report-container">${reportHtml}</div>
        `;

        notification.style.display = 'block';
        notification.classList.remove('fade-out');

        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => { notification.style.display = 'none'; }, 300);
        }, 3000);
    }
}

// Mixin'leri Game.prototype'a uygula
Object.assign(Game.prototype, CombatMixin, EconomyMixin, DiplomacyMixin, TechnologyMixin);
