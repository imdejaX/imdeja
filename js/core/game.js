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
            'Asgard', 'Olympos', 'Avalon', 'Valhalla',
            'Camelot', 'Atlantis', 'Midgard', 'El Dorado'
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
            mustRetaliateAgainst: null,
            technologies: {
                food: 0,
                military: 0,
                defense: 0,
                commerce: 0
            },
            militaryBoost: 0,
            weaponBonus: 0,
            unrest: 0,
            whiteFlagTurns: 0,
            marketRefreshes: 0,
            grid: Array(13).fill(null),
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
        for (let i = 0; i < baseAndCount * 1; i++) buildingCards.push({ name: 'Silah Atölyesi', cost: 4, type: 'Bina', hp: 5, power: 10 });

        const extraBuildingTypes = [
            { name: 'Çiftlik', cost: 3, type: 'Bina', hp: 5, power: 8 },
            { name: 'Kışla', cost: 4, type: 'Bina', hp: 6, power: 12 },
            { name: 'Duvar', cost: 5, type: 'Bina', hp: 6, power: 20 },
            { name: 'Pazar', cost: 3, type: 'Bina', hp: 3, power: 8 },
            { name: 'Bilim Merkezi', cost: 5, type: 'Bina', hp: 4, power: 5 },
            { name: 'Silah Atölyesi', cost: 4, type: 'Bina', hp: 5, power: 10 }
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
            { name: 'Beyaz Bayrak', cost: 5, type: 'Diplomasi', dp: 1, effect: 'white_flag', duration: 2 },
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
            { name: 'Tarım', cost: 4,  popCost: 1, type: 'Teknoloji', techType: 'food', level: 1, multiplier: 1.5 },
            { name: 'Tarım', cost: 8,  popCost: 2, type: 'Teknoloji', techType: 'food', level: 2, multiplier: 2.5 },
            { name: 'Tarım', cost: 14, popCost: 3, type: 'Teknoloji', techType: 'food', level: 3, multiplier: 4   },
            { name: 'Tarım', cost: 22, popCost: 4, type: 'Teknoloji', techType: 'food', level: 4, multiplier: 6   },
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

        // Desteden rastgele bir eşleşen kart seç ve çıkar
        const pickRandom = (predicate) => {
            const indices = [];
            for (let i = 0; i < this.market.length; i++) {
                if (predicate(this.market[i])) indices.push(i);
            }
            if (indices.length === 0) return -1;
            return indices[Math.floor(Math.random() * indices.length)];
        };

        requiredTypes.forEach(type => {
            if (this.openMarket.some(c => c.type === type)) return;

            if (type === 'Teknoloji') {
                // Önce eskimiş seviyeleri temizle
                for (let i = this.market.length - 1; i >= 0; i--) {
                    const card = this.market[i];
                    if (card.type !== 'Teknoloji' || card.isJoker) continue;
                    if (card.level <= player.technologies[card.techType]) {
                        this.market.splice(i, 1);
                    }
                }

                // Joker varsa önce joker göster, yoksa uygun seviye teknoloji
                let idx = pickRandom(c => c.type === 'Teknoloji' && c.isJoker);
                if (idx === -1) {
                    idx = pickRandom(c => {
                        if (c.type !== 'Teknoloji' || c.isJoker) return false;
                        if (c.level !== player.technologies[c.techType] + 1) return false;
                        return !player.hand.some(h =>
                            h.type === 'Teknoloji' && h.techType === c.techType && h.level === c.level
                        );
                    });
                }
                if (idx !== -1) this.openMarket.push(this.market.splice(idx, 1)[0]);

            } else if (type === 'Diplomasi') {
                // Terör Jokeri'ni sona bırak — önce diğer diplomasi kartları
                let idx = pickRandom(c => c.type === 'Diplomasi' && c.effect !== 'terror_joker');
                if (idx === -1) idx = pickRandom(c => c.type === 'Diplomasi');
                if (idx !== -1) this.openMarket.push(this.market.splice(idx, 1)[0]);

            } else {
                const idx = pickRandom(c => c.type === type);
                if (idx !== -1) this.openMarket.push(this.market.splice(idx, 1)[0]);
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
            p.grid[1] = { type: 'Çiftlik', hp: 5, power: 8 };

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
            // Ekonomi
            "💰 Çiftlik hem gelir hem gıda üretir — ilk kurulacak binalar arasında.",
            "💰 Pazar her tur altın sağlar; Ticaret teknolojisiyle gelir katlanır.",
            "💰 Her saldırı savaş gideri olarak 1 Altın tüketir — boşuna saldırma!",
            "💰 Başarısız saldırı 2 Altın kaybettirir: 1 gider + 1 ceza.",
            // Gıda & Huzursuzluk
            "🍞 Kışladaki her asker 1 birim gıda tüketir — ordu büyüdükçe Çiftlik kur!",
            "🍞 Huzursuzluk 4'e ulaşırsa askerler kaçar, 13'e ulaşırsa iç savaş çıkar.",
            "🍞 Tarım teknolojisi gıda üretimini 6 katına kadar artırır.",
            "🍞 Gıda fazlası huzursuzluğu yavaşça azaltır — dengeyi koru.",
            // Askeri
            "⚔️ Piyade + Okçu + Süvari + Kışla kombinasyonu %20 saldırı bonusu verir.",
            "⚔️ Silah Atölyesi her tur kalıcı saldırı bonusu biriktirir.",
            "⚔️ Düşen her asker silahını da götürür — Silah Atölyesi bonusu erir.",
            "⚔️ Kışla yıkıldığında askerler esir düşer veya paralı askere dönüşür.",
            "⚔️ Duvar yıkılmadan Saray'a ulaşamazsın.",
            "⚔️ Savunma teknolojisi bina direncini 2.5 katına çıkarır.",
            // Teknoloji
            "🔬 Bilim Merkezi kurmadan teknoloji kartı kullanamazsın.",
            "🔬 Bilim İnsanı sayısı teknoloji araştırma hızını belirler.",
            "🔬 Silah teknolojisi tüm ordu gücünü çarpar — önce asker topla, sonra araştır.",
            "🔬 Joker kartı ile istediğin teknolojiyi bir seviye atlayabilirsin.",
            // Diplomasi & Vasal
            "🤝 İttifak kurmak için karşı taraftan yüksek DP'ye sahip olmalısın.",
            "🤝 Müttefikine saldırırsan 2 DP kaybeder, o 3 Altın kazanır.",
            "🤝 Vasal olarak 4 bina kurup 8 Altın öder — bağımsızlığını geri alırsın.",
            "🤝 Vasal iken saldırı yapamazsın ama bina inşa edebilirsin.",
            "🤝 Nifak Tohumu güçlü ittifakları parçalar — tek başına kazanmak için kullan.",
            "🤝 Beyaz Bayrak 2 tur saldırıya karşı koruma sağlar.",
            // Strateji
            "👑 Rakibin Pazar'ını yıkarak gelirini, Kışla'sını yıkarak asker üretimini durdur.",
            "👑 Saray'ı korumak için önce Kışla, sonra Duvar inşa et.",
            "👑 Hasarlı binaları Mimari Onarım kartıyla tamamen sıfırlayabilirsin.",
            "👑 İlk 3 tur barış dönemi — bu süreyi bina kurmak ve ekonomi geliştirmek için kullan.",
            "👑 Askeri Gösteri kartını saldırıdan hemen önce oyna: +3 güç bonusu kazanırsın."
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
        this.selectedCardIndex = null;
        this.pendingDiplomacyCard = null;
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

        if (card.type === 'Teknoloji' && !card.isJoker) {
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

    // Bina kartını otomatik olarak ilk boş slota yerleştirir
    buildBuilding(handIndex) {
        const player = this.getActivePlayer();
        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const card = player.hand[handIndex];
        if (!card || card.type !== 'Bina') return { success: false, msg: "Bu bir Bina kartı değil!" };

        // Slot 0 Saray'a ayrılmış — 1-8 arasında ilk boş slotu bul
        const emptySlot = player.grid.findIndex((cell, idx) => idx > 0 && !cell);
        if (emptySlot === -1) return { success: false, msg: "Tüm binalar dolu! (Maksimum 12 bina)" };

        const newBuilding = {
            type: card.name,
            hp: card.hp || 3,
            power: card.power || 0
        };

        if (card.name === 'Bilim Merkezi') {
            newBuilding.garrison = [{ name: 'Bilim İnsanı', type: 'Nüfus', power: 0 }];
            newBuilding.capacity = 5;
            this.log(`🧪 Bilim Merkezi kuruldu! 1 Bilim İnsanı göreve başladı.`);
        } else if (card.name === 'Kışla') {
            newBuilding.garrison = [];
        }

        player.grid[emptySlot] = newBuilding;
        player.actionsRemaining -= 1;
        player.hand.splice(handIndex, 1);
        this.selectedCardIndex = null;

        this.log(`🏗️ ${player.name}, ${card.name} inşa etti.`);
        this.checkAutoEndTurn();
        return { success: true };
    }

    // Asker kartını doğrudan Kışla garrison'una ekler
    playAskerCard(handIndex) {
        const player = this.getActivePlayer();
        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };
        const card = player.hand[handIndex];
        if (!card || card.type !== 'Asker') return { success: false, msg: "Geçersiz kart!" };

        const hasBarracks = player.grid.some(c => c && c.type === 'Kışla');
        if (!hasBarracks) return { success: false, msg: "Asker konuşlandırmak için Kışla gerekli!" };

        const soldier = { name: card.name, type: 'Asker', power: card.power || 2, hp: card.hp || 3 };
        const result = this.addSoldiersToPlayer(player, [soldier]);

        if (result.added === 0 && result.overflow > 0) {
            return { success: false, msg: "Kışlalarda yer yok! (Kapasite: 15/kışla)" };
        }

        player.actionsRemaining -= 1;
        player.hand.splice(handIndex, 1);
        this.log(`⚔️ ${player.name}, ${card.name} kışlaya konuşlandırdı!`);
        this.checkAutoEndTurn();
        return { success: true };
    }

    buildOnSlot(slotIndex) {
        const player = this.getActivePlayer();
        if (this.selectedCardIndex === null) return { success: false, msg: "Önce bir kart seçin." };
        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const card = player.hand[this.selectedCardIndex];

        // Diplomasi kartları buildOnSlot ile kullanılamaz — playDiplomacyCard üzerinden çalışır
        if (card.type === 'Diplomasi' || card.type === 'Asker' || card.type === 'Teknoloji' || card.type === 'Paralı Asker') {
            return { success: false, msg: `${card.type} kartları buradan kullanılmaz — kart panelinden tıkla.` };
        }

        const currentSlot = player.grid[slotIndex];
        if (currentSlot && currentSlot.type !== 'Boş') {
            return { success: false, msg: "Alan dolu!" };
        }

        const newBuilding = {
            type: card.name,
            hp: card.hp || 3,
            power: card.power || 0
        };

        if (card.name === 'Bilim Merkezi') {
            newBuilding.garrison = [{ name: 'Bilim İnsanı', type: 'Nüfus', power: 0 }];
            newBuilding.capacity = 5;
            this.log(`🧪 Bilim Merkezi kuruldu! 1 Bilim İnsanı göreve başladı.`);
        } else if (card.name === 'Kışla') {
            newBuilding.garrison = [];
        }

        player.grid[slotIndex] = newBuilding;
        player.actionsRemaining -= 1;
        player.hand.splice(this.selectedCardIndex, 1);
        this.selectedCardIndex = null;

        this.log(`🏗️ ${player.name}, ${card.name} inşa etti.`);
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

        // Dayanışma zorunluluğu — tur bitmeden önce temizle
        const currentPlayer = this.getActivePlayer();
        if (currentPlayer.mustRetaliateAgainst !== null) {
            currentPlayer.mustRetaliateAgainst = null;
        }

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

        // Son 2 bağımsız krallık kaldıysa ittifak otomatik bozulur
        const independent = this.players.filter(p => !p.isVassal);
        if (independent.length <= 2) {
            const allied = independent.find(p => p.allianceWith !== null);
            if (allied) {
                const ally = this.players.find(a => a.id === allied.allianceWith);
                allied.allianceWith = null;
                if (ally) ally.allianceWith = null;
                this.log(`⚡ Son iki bağımsız krallık kaldı — ittifak otomatik bozuldu! Biri kazanmalı.`);
            }
        }

        const nextPlayer = this.getActivePlayer();
        console.log(`🎯 Turn ${this.turn}, Player Index ${this.activePlayerIndex}: ${nextPlayer.name} (Bot: ${nextPlayer.isBot}, Vassal: ${nextPlayer.isVassal})`);

        if (nextPlayer.isVassal) {
            nextPlayer.actionsRemaining = 1;
            this.calculatePlayerIncome(nextPlayer);
            this.log(`⛓️ ${nextPlayer.name} (Vasal): 1 aksiyon — bağımsızlık için ${4 - nextPlayer.grid.filter((c,i)=>c&&i>0&&!c.isUnit).length} bina daha kur.`);
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
                    if (window.renderer) window.renderer.render();
                    if (window.mapRenderer) window.mapRenderer.render();
                    await new Promise(resolve => setTimeout(resolve, 800));

                    if (this.botSafetyTimer) clearTimeout(this.botSafetyTimer);
                    this.botSafetyTimer = null;
                    this.botTurnInProgress = false;
                    this.isTurnTransitioning = false;
                    if (endTurnBtn) endTurnBtn.disabled = false;
                    if (this.activePlayerIndex !== currentTurnIndex) return;

                    this.endTurn();
                    if (window.renderer) window.renderer.render();
                    if (window.mapRenderer) window.mapRenderer.render();
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

    buildOnVassalLand(vassalId, slotIndex) {
        const master = this.getActivePlayer();
        if (master.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };
        if (this.selectedCardIndex === null) return { success: false, msg: "Önce el kartlarından bina seçin." };

        const vassal = this.players.find(p => p.id === vassalId);
        if (!vassal || !vassal.isVassal || vassal.masterId !== master.id)
            return { success: false, msg: "Bu vassal'ınız değil!" };
        if (slotIndex === 0) return { success: false, msg: "Saray slotu kullanılamaz!" };
        if (vassal.grid[slotIndex]) return { success: false, msg: "Alan dolu!" };

        const card = master.hand[this.selectedCardIndex];
        if (!card || card.type !== 'Bina') return { success: false, msg: "Sadece bina kartları inşa edilebilir!" };

        const building = { type: card.name, hp: card.hp || 3, power: card.power || 0, ownerId: master.id };
        if (card.name === 'Kışla') building.garrison = [];
        if (card.name === 'Bilim Merkezi') { building.garrison = []; building.capacity = 5; }

        vassal.grid[slotIndex] = building;
        master.actionsRemaining -= 1;
        master.hand.splice(this.selectedCardIndex, 1);
        this.selectedCardIndex = null;

        this.log(`🏗️ ${master.name}, ${vassal.name} topraklarına ${card.name} inşa etti!`);
        this.checkAutoEndTurn();
        return { success: true };
    }

    demolishOnVassalLand(vassalId, slotIndex) {
        const master = this.getActivePlayer();
        if (master.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const vassal = this.players.find(p => p.id === vassalId);
        if (!vassal || !vassal.isVassal || vassal.masterId !== master.id)
            return { success: false, msg: "Bu vassal'ınız değil!" };

        const cell = vassal.grid[slotIndex];
        if (!cell) return { success: false, msg: "Boş alan!" };
        if (cell.type === 'Saray') return { success: false, msg: "Saray yıkılamaz!" };
        if (cell.ownerId !== master.id) return { success: false, msg: "Bu bina size ait değil!" };

        vassal.grid[slotIndex] = null;
        master.actionsRemaining -= 1;
        this.clearActionMode();
        this.log(`🔨 ${master.name}, ${vassal.name} topraklarındaki ${cell.type} binasını yıktı!`);
        this.checkAutoEndTurn();
        return { success: true };
    }

    declareIndependence() {
        const player = this.getActivePlayer();
        if (!player.isVassal) return { success: false, msg: "Zaten bağımsızsın!" };
        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const buildings = player.grid.filter((c, i) => c && i > 0 && !c.isUnit).length;
        if (buildings < 4) {
            return { success: false, msg: `Bağımsızlık için 4 bina gerekli! (Mevcut: ${buildings}/4)` };
        }
        if (player.gold < 8) {
            return { success: false, msg: `Bağımsızlık bedeli 8 Altın! (Mevcut: ${player.gold})` };
        }

        const master = this.players.find(p => p.id === player.masterId);

        player.gold -= 8;
        player.isVassal = false;
        player.masterId = null;
        player.actionsRemaining -= 1;

        if (master) {
            master.gold += 8;
            master.totalGoldEarned += 8;
            master.dp = Math.max(1, master.dp - 3);
            this.log(`💥 ${player.name} BAĞIMSIZLIĞINI İLAN ETTİ! Bedel: 8 Altın → ${master.name}. ${master.name}: -3 DP`);
        } else {
            this.log(`💥 ${player.name} BAĞIMSIZLIĞINI İLAN ETTİ!`);
        }

        this.log(`🎉 ${player.name} artık bağımsız bir krallık!`);
        this.checkAutoEndTurn();
        return { success: true };
    }
}

// Mixin'leri Game.prototype'a uygula
Object.assign(Game.prototype, CombatMixin, EconomyMixin, DiplomacyMixin, TechnologyMixin);
