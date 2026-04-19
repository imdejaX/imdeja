/**
 * TechnologyMixin — Teknoloji kartları ve deste temizliği.
 * Game.prototype'a Object.assign ile uygulanır.
 */
export const TechnologyMixin = {

    playTechnologyCard(handIndex, techType = null) {
        const player = this.getActivePlayer();
        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const card = player.hand[handIndex];
        if (!card || card.type !== 'Teknoloji') return { success: false, msg: "Geçersiz kart!" };

        // Joker kartı Bilim Merkezi ve bilim insanı gerektirmez (10 altın maliyetiyle özel kart)
        if (!card.isJoker) {
            const hasScienceCenter = player.grid.some(cell => cell && cell.type === 'Bilim Merkezi');
            if (!hasScienceCenter) {
                return { success: false, msg: "Teknoloji geliştirmek için 'Bilim Merkezi' binasına sahip olmalısınız!" };
            }

            let totalScientists = 0;
            player.grid.forEach(cell => {
                if (cell && cell.type === 'Bilim Merkezi' && cell.garrison) {
                    totalScientists += cell.garrison.length;
                }
            });

            if (totalScientists < card.popCost) {
                return { success: false, msg: `Yetersiz Bilim İnsanı! ${card.popCost} gerekli. (Mevcut: ${totalScientists})` };
            }
        }

        let targetTechType = card.techType;
        let targetLevel = card.level;

        if (card.isJoker) {
            const techOptions = [
                { type: 'military', name: 'Silah (Askeri Güç)', currentLevel: player.technologies.military },
                { type: 'defense', name: 'Savunma (Bina HP)', currentLevel: player.technologies.defense },
                { type: 'commerce', name: 'Ticaret (Pazar Geliri)', currentLevel: player.technologies.commerce }
            ];
            const availableTechs = techOptions.filter(t => t.currentLevel < 4);

            if (availableTechs.length === 0) {
                return { success: false, msg: "Tüm teknolojilerin maksimum seviyede!" };
            }

            if (!techType) {
                return {
                    success: false,
                    msg: "JOKER_SELECTION_NEEDED",
                    availableTechs,
                    cardIndex: handIndex
                };
            }

            const selected = availableTechs.find(t => t.type === techType);
            if (!selected) return { success: false, msg: "Geçersiz teknoloji seçimi!" };

            targetTechType = selected.type;
            targetLevel = selected.currentLevel + 1;
        } else {
            const currentLevel = player.technologies[card.techType];
            if (currentLevel >= card.level) {
                return { success: false, msg: "Bu teknolojiye zaten sahipsin!" };
            }
        }

        // Consume scientists
        let remaining = card.popCost;
        for (let cell of player.grid) {
            if (remaining <= 0) break;
            if (cell && cell.type === 'Bilim Merkezi' && cell.garrison && cell.garrison.length > 0) {
                const toRemove = Math.min(remaining, cell.garrison.length);
                cell.garrison.splice(0, toRemove);
                remaining -= toRemove;
            }
        }

        player.actionsRemaining -= 1;
        player.technologies[targetTechType] = targetLevel;
        player.hand.splice(handIndex, 1);

        const techName = card.isJoker ? `${targetTechType} Lv${targetLevel}` : card.name;
        this.log(`${player.name}, ${techName} araştırdı!`);

        this.cleanupMarketDeck();
        this.checkAutoEndTurn();
        return { success: true };
    },

    cleanupMarketDeck() {
        if (!this.market || this.market.length === 0) return;

        const originalCount = this.market.length;
        this.market = this.market.filter(c => {
            if (c.type !== 'Teknoloji') return true;
            if (c.isJoker) return true;
            return this.players.some(p => {
                const current = p.technologies[c.techType];
                return c.level === current + 1;
            });
        });

        if (this.market.length < originalCount) {
            console.log(`🧹 Market temizlendi: ${originalCount - this.market.length} eski teknoloji kartı kaldırıldı.`);
        }
    }
};
