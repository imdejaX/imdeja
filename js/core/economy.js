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

        // 3. Vassal tax income + master-owned building income on vassal lands
        const vassals = this.players.filter(v => v.masterId === p.id);
        const vassalIncome = vassals.length;
        income += vassalIncome;
        if (vassalIncome > 0) p.turnReport.taxReceived = vassalIncome;

        vassals.forEach(v => {
            v.grid.forEach(cell => {
                if (!cell || cell.ownerId !== p.id) return;
                if (cell.type === 'Çiftlik') income += 1;
                if (cell.type === 'Pazar') income += Math.floor(commerceMultipliers[p.technologies.commerce]);
            });
        });

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

        // 7. Barracks spawn soldiers (own grid + master-owned on vassal lands)
        const generatedSoldiers = [];
        const allBarracks = [...p.grid];
        this.players.forEach(v => {
            if (v.isVassal && v.masterId === p.id) {
                v.grid.forEach(cell => {
                    if (cell && cell.type === 'Kışla' && cell.ownerId === p.id) allBarracks.push(cell);
                });
            }
        });
        allBarracks.forEach(cell => {
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
                if (cell.garrison.length < 5 && p.gold >= 1) {
                    p.gold -= 1;
                    cell.garrison.push({ name: 'Bilim İnsanı', type: 'Nüfus', power: 0 });
                    this.log(`🧪 ${p.name}, Bilim Merkezi'ne yeni bilim insanı aldı! (-1 Altın)`);
                }
            }
        });

        // 8.5. Silah Atölyesi — her tur birikimli saldırı bonusu
        const workshops = p.grid.filter(c => c && c.type === 'Silah Atölyesi').length;
        if (workshops > 0) {
            p.weaponBonus = (p.weaponBonus || 0) + workshops;
            this.log(`⚒️ ${p.name}, Silah Atölyesi'nden +${workshops} silah bonusu! (Toplam: ${p.weaponBonus})`);
        }

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

        // 11. Food balance & unrest check
        this.checkFoodAndUnrest(p);
    },

    getTotalGold() {
        return this.players.reduce((sum, p) => sum + p.totalGoldEarned, 0);
    },

    getGoldCap() {
        // Artık zorlayıcı bir sınır yok; bu fonksiyon sadece
        // UI'da "hedef" göstermek için kullanılabilir.
        return 999;
    },

    calculateFoodBalance(player) {
        const farms = player.grid.filter(c => c && c.type === 'Çiftlik').length;
        const techMultipliers = [1, 1.5, 2.5, 4, 6];
        const production = Math.floor((5 + farms * 4) * techMultipliers[player.technologies.food]);

        const consumption = player.grid.reduce((sum, c) => {
            if (!c || c.type !== 'Kışla' || !c.garrison) return sum;
            return sum + c.garrison.length;
        }, 0);

        return { production, consumption, balance: production - consumption };
    },

    getCapacityInfo(player) {
        const { production, consumption } = this.calculateFoodBalance(player);
        return { capacity: production, totalPop: consumption };
    },

    checkFoodAndUnrest(player) {
        const { production, consumption, balance } = this.calculateFoodBalance(player);

        if (balance < 0) {
            const deficit = Math.abs(balance);
            player.unrest = (player.unrest || 0) + deficit;
            this.log(`🍞 ${player.name} GIDA AÇIĞI! Üretim: ${production}, Tüketim: ${consumption} → Huzursuzluk: ${player.unrest}`);
        } else if (balance > 0) {
            const reduction = Math.floor(balance / 2);
            if (reduction > 0 && (player.unrest || 0) > 0) {
                player.unrest = Math.max(0, (player.unrest || 0) - reduction);
                this.log(`🌾 ${player.name} gıda fazlası, huzursuzluk azaldı: ${player.unrest}`);
            }
        }

        const unrest = player.unrest || 0;

        if (unrest >= 13) {
            const candidates = player.grid
                .map((c, i) => ({ c, i }))
                .filter(({ c }) => c && c.type !== 'Saray' && !c.isUnit);

            if (candidates.length > 0) {
                const target = candidates[Math.floor(Math.random() * candidates.length)];
                target.c.hp = Math.max(1, target.c.hp - 2);
                this.log(`🔥 İÇ SAVAŞ! ${player.name}: ${target.c.type} hasar gördü! (-2 HP)`);
            }
            player.dp = Math.max(1, (player.dp || 1) - 2);
            player.unrest = Math.max(0, player.unrest - 8);
            this.log(`😱 ${player.name} isyanı bastırdı! -2 DP, Huzursuzluk: ${player.unrest}`);

        } else if (unrest >= 8) {
            const deserted = this._desertSoldiers(player, 2);
            if (player.gold > 0) { player.gold -= 1; }
            this.log(`😤 ${player.name} büyük şikayet! ${deserted} asker kaçtı, -1 Altın (Huzursuzluk: ${unrest})`);

        } else if (unrest >= 4) {
            const deserted = this._desertSoldiers(player, 1);
            if (deserted > 0) {
                this.log(`😠 ${player.name} halk şikayetleri! 1 asker kaçtı (Huzursuzluk: ${unrest})`);
            }

        } else if (unrest >= 1 && balance < 0) {
            this.log(`⚠️ ${player.name} gıda sıkıntısı çekiyor (Huzursuzluk: ${unrest}/13)`);
        }
    },

    _desertSoldiers(player, count) {
        let removed = 0;
        for (const cell of player.grid) {
            if (!cell || cell.type !== 'Kışla' || !cell.garrison || cell.garrison.length === 0) continue;
            const toRemove = Math.min(count - removed, cell.garrison.length);
            for (let i = 0; i < toRemove; i++) {
                const idx = Math.floor(Math.random() * cell.garrison.length);
                const soldier = cell.garrison.splice(idx, 1)[0];
                if (soldier) {
                    this.mercenaryPool.push({
                        id: `merc-${Date.now()}-${Math.random()}`,
                        name: 'Paralı Asker (1)',
                        count: 1, soldiers: [soldier], cost: 1,
                        type: 'Asker', power: soldier.power || 2, isUnit: true,
                        description: `${player.name}'dan kaçan asker.`
                    });
                    removed++;
                }
            }
            if (removed >= count) break;
        }
        // Kaçan asker silahını da götürür
        if (removed > 0 && player.weaponBonus > 0) {
            player.weaponBonus = Math.max(0, player.weaponBonus - removed);
        }
        return removed;
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
