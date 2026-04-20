/**
 * EconomyMixin — Gelir hesaplama, altın limiti, kapasite ve tur otomatik bitiş.
 * Game.prototype'a Object.assign ile uygulanır.
 */
export const EconomyMixin = {

    checkAutoEndTurn() {
        if (this.isTurnTransitioning) {
            console.warn("⚠️ checkAutoEndTurn skipped: Turn Transitioning");
            return;
        }
        if (this.botTurnInProgress) {
            console.warn("⚠️ checkAutoEndTurn skipped: Bot Turn In Progress");
            return;
        }

        const player = this.getActivePlayer();
        if (player.actionsRemaining <= 0) {
            if (player.id !== this.getActivePlayer().id) return;

            if (this.isCalculatingCombat) {
                if (this.combatWaitTimer) clearTimeout(this.combatWaitTimer);
                this.combatWaitTimer = setTimeout(() => {
                    this.combatWaitTimer = null;
                    this.checkAutoEndTurn();
                }, 1000);
                this.log("⏳ Savaş hesaplaması bekleniyor...");
                return;
            }

            if (this.autoEndTimer) clearTimeout(this.autoEndTimer);

            if (this.actionMode) this.clearActionMode();

            console.log('⏳ Auto-end turn timer started (1.5s)');
            this.autoEndTimer = setTimeout(() => {
                console.log('⌛ Auto-ending turn now...');
                this.autoEndTimer = null;
                this.endTurn();
                if (window.renderer) window.renderer.render();
                if (window.mapRenderer) window.mapRenderer.render();
            }, 1500);
        }
    },

    calculatePlayerIncome(p) {
        if (this.turn === 1) return;

        p.turnReport = {
            income: 0,
            incomeBreakdown: [],
            newUnits: [],
            newCivilians: 0,
            taxPaid: 0,
            taxReceived: 0,
            notes: []
        };

        p.marketRefreshes = 0;

        // 1. Base income + farms
        const farms = p.grid.filter(c => c && c.type === 'Çiftlik').length;
        let income = 1 + farms;

        // 2. Market bonus × commerce tech
        const markets = p.grid.filter(c => c && c.type === 'Pazar').length;
        const commerceMultipliers = [1, 1.5, 2, 2.5, 3];
        income += Math.floor(markets * commerceMultipliers[p.technologies.commerce]);

        // 3. Vassal tax income
        const vassals = this.players.filter(v => v.masterId === p.id);
        const vassalIncome = vassals.length;
        income += vassalIncome;
        if (vassalIncome > 0) p.turnReport.taxReceived = vassalIncome;

        // 4. Vassal tax: vasal efendiye vergi öder
        if (p.isVassal && p.gold > 0) {
            const taxAmount = Math.min(2, p.gold); // sabit 2 altın vergi
            p.gold -= taxAmount;
            p.turnReport.taxPaid = taxAmount;
            const master = this.players.find(m => m.id === p.masterId);
            if (master) {
                master.gold += taxAmount;
                master.totalGoldEarned += taxAmount;
                this.log(`${p.name}, ${master.name}'e ${taxAmount} Altın vergi ödedi.`);
            }
        }

        // 5. Altın limiti YOK — gelir serbestçe birikir.
        // Oyun dengesi harcama teşvikiyle sağlanır (bina maliyetleri, asker vb.)
        p.gold += income;
        p.totalGoldEarned += income;
        p.turnReport.income = income;

        // 7. Barracks spawn soldiers
        const generatedSoldiers = [];
        p.grid.forEach(cell => {
            if (cell && cell.type === 'Kışla') {
                const soldierTypes = [
                    { name: 'Piyade', cost: 2, type: 'Asker', power: 2, hp: 3, isUnit: true },
                    { name: 'Okçu', cost: 3, type: 'Asker', power: 3, hp: 4, isUnit: true },
                    { name: 'Süvari', cost: 4, type: 'Asker', power: 4, hp: 5, isUnit: true }
                ];
                generatedSoldiers.push(soldierTypes[Math.floor(Math.random() * soldierTypes.length)]);
            }
        });

        if (generatedSoldiers.length > 0) {
            const result = this.addSoldiersToPlayer(p, generatedSoldiers);
            if (result.added > 0) {
                this.log(`🏰 ${p.name}, Kışlalardan +${result.added} asker kazandı!`);
                generatedSoldiers.slice(0, result.added).forEach(s => p.turnReport.newUnits.push(s.name));
            }
        }

        // 8. Science center: recruit 1 scientist per turn for 1 gold
        p.grid.forEach(cell => {
            if (cell && cell.type === 'Bilim Merkezi') {
                if (!cell.garrison) cell.garrison = [];
                if (cell.garrison.length < 5) {
                    if (p.gold >= 1) {
                        p.gold -= 1;
                        cell.garrison.push({ name: 'Bilim İnsanı', type: 'Nüfus', power: 0 });
                        this.log(`🧪 ${p.name}, Bilim Merkezi'ne yeni bilim insanı aldı! (-1 Altın)`);
                    }
                } else {
                    this.log(`⚠️ ${p.name}'in Bilim Merkezi dolu! (5/5)`);
                }
            }
        });

        // 9. Farm civilian production (every 3 turns)
        const canGrowPop = this.turn % 3 === 0;
        const hasFarm = p.grid.some(c => c && c.type === 'Çiftlik');
        const saray = p.grid[0];

        if (canGrowPop && hasFarm && saray && saray.garrison && saray.garrison.length < 3) {
            saray.garrison.push({ name: 'Sivil', type: 'Nüfus', power: 0 });
            this.log(`🌾 ${p.name}, Çiftlik 1 sivil üretti! (Saray: ${saray.garrison.length}/3)`);
            p.turnReport.newCivilians = 1;
        }

        // 10. Saray auto-repair
        if (saray && saray.garrison) {
            const missingCivils = 3 - saray.garrison.length;
            if (missingCivils > 0) {
                let restored = 0, usedDP = 0, usedGold = 0;

                for (let i = 0; i < missingCivils; i++) {
                    if (p.dp >= 1) {
                        p.dp -= 1;
                        saray.garrison.push({ name: 'Sivil', type: 'Nüfus', power: 0 });
                        restored++; usedDP++;
                    } else if (p.gold >= 2) {
                        p.gold -= 2;
                        saray.garrison.push({ name: 'Sivil', type: 'Nüfus', power: 0 });
                        restored++; usedGold += 2;
                    } else {
                        break;
                    }
                }

                if (restored > 0) {
                    let costMsg = '';
                    if (usedDP > 0 && usedGold > 0) costMsg = `(-${usedDP} DP, -${usedGold} Altın)`;
                    else if (usedDP > 0) costMsg = `(-${usedDP} DP)`;
                    else if (usedGold > 0) costMsg = `(-${usedGold} Altın)`;
                    this.log(`🏛️ ${p.name} Sarayı onarıldı! +${restored} sivil ${costMsg}`);
                }

                const stillMissing = 3 - saray.garrison.length;
                if (stillMissing > 0) {
                    this.log(`⚠️ ${p.name} Sarayı zayıf! ${stillMissing} sivil eksik (DP veya Altın yetersiz)`);
                }
            }

            if (saray.garrison.length === 0) {
                this.log(`☠️ ${p.name} KRAL ÖLDÜ! Saray savunmasız!`);
            }
        }

        // 11. Capacity check
        this.checkCapacity(p);
    },

    getTotalGold() {
        return this.players.reduce((sum, p) => sum + p.totalGoldEarned, 0);
    },

    getGoldCap() {
        // Artık zorlayıcı bir sınır yok; bu fonksiyon sadece
        // UI'da "hedef" göstermek için kullanılabilir.
        return 999;
    },

    getCapacityInfo(player) {
        const barracks = player.grid.filter(c => c && c.type === 'Kışla').length;
        const farms = player.grid.filter(c => c && c.type === 'Çiftlik').length;
        // Base 10 + her kışla 20 + her çiftlik 5 — daha geniş başlangıç
        let baseCapacity = 10 + (barracks * 20) + (farms * 5);
        const techMultipliers = [1, 1.5, 2.5, 4, 6];
        const capacity = Math.floor(baseCapacity * techMultipliers[player.technologies.food]);

        const armyCount = player.grid.filter(c => c && c.isUnit).length;
        const basePop = player.pop > 0 ? player.pop : 3;
        const garrisonSoldiers = player.grid.reduce((sum, c) => {
            if (c && c.type === 'Kışla' && c.garrison) return sum + c.garrison.length;
            return sum;
        }, 0);
        const totalPop = basePop + armyCount + garrisonSoldiers;

        return { capacity, totalPop };
    },

    checkCapacity(player) {
        const { capacity, totalPop } = this.getCapacityInfo(player);
        if (totalPop <= capacity) return;

        const excess = totalPop - capacity;
        this.log(`🛑 ${player.name} GIDA KITLIĞI! Kapasite: ${capacity}, Nüfus: ${totalPop}`);

        let returned = 0;
        for (let i = 0; i < player.grid.length; i++) {
            if (returned >= excess) break;
            if (player.grid[i] && player.grid[i].isUnit) {
                const soldier = player.grid[i];
                this.log(`🔄 Havuza döndü: ${soldier.type}`);
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

        if (returned > 0) this.log(`♻️ ${returned} asker havuza eklendi. Pazarda satılacak.`);
    },

    playMercenaryCard(handIndex) {
        const player = this.getActivePlayer();
        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const card = player.hand[handIndex];
        if (!card || card.type !== 'Paralı Asker') return { success: false, msg: "Geçersiz kart!" };

        const totalCapacity = player.grid
            .filter(c => c && c.type === 'Kışla')
            .reduce((sum, b) => sum + (15 - (b.garrison?.length || 0)), 0);

        if (totalCapacity === 0) return { success: false, msg: "Kışlalarda hiç yer yok!" };

        const result = this.addSoldiersToPlayer(player, card.soldiers);
        player.actionsRemaining -= 1;
        player.hand.splice(handIndex, 1);

        this.log(`⚔️ ${player.name}, ${result.added} paralı askeri ordusuna kattı!`);
        this.checkAutoEndTurn();
        return { success: true };
    }
};
