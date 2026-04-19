/**
 * CombatMixin — Savaş, hasar, askeri hesaplama ve vassal sistemi.
 * Game.prototype'a Object.assign ile uygulanır.
 */
export const CombatMixin = {

    // Phase 1: Validate attack, no dice yet
    initiateAttack(targetPlayerId, targetSlotIndex, confirmed = false) {
        const attacker = this.getActivePlayer();
        const defender = this.players.find(p => p.id === targetPlayerId);

        // Saldırı zaten devam ediyorsa yeni saldırı başlatma
        if (this.pendingAttack) return { success: false, msg: "Önceki saldırı tamamlanmadan yeni saldırı başlatılamaz!" };
        if (this.isRollingDice) return { success: false, msg: "Zar atılıyor, lütfen bekleyin..." };
        if (this.isCalculatingCombat) return { success: false, msg: "Muharebe hesaplanıyor..." };

        if (attacker.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };
        if (attacker.id === defender.id) return { success: false, msg: "Kendine saldıramazsın!" };

        if (this.turn <= 3) {
            return { success: false, msg: `🏳️ İlk 3 tur barış dönemi! Saldırı yapılamaz. (Tur: ${this.turn}/3)` };
        }

        const whiteFlagPlayer = this.players.find(p => p.whiteFlagTurns > 0);
        if (whiteFlagPlayer) {
            return { success: false, msg: `🏳️ ${whiteFlagPlayer.name} beyaz bayrak çekti! Kimse saldırı yapamaz. (${whiteFlagPlayer.whiteFlagTurns} tur kaldı)` };
        }

        if (attacker.allianceWith === defender.id) {
            if (!confirmed) {
                return {
                    success: false,
                    requiresConfirmation: true,
                    msg: `⚠️ DİKKAT!\n\nMüttefiğin ${defender.name}'e saldırmak üzeresin!\n\nBunu yaparsan:\n1. İttifak BOZULACAK.\n2. İhanet bedeli olarak 2 DP kaybedeceksin.\n3. ${defender.name} tazminat olarak 3 Altın kazanacak.\n\nSaldırıya devam etmek istiyor musun?`
                };
            }

            this.log(`😱 İHANET! ${attacker.name}, müttefiği ${defender.name}'e saldırdı!`);
            attacker.dp = Math.max(1, attacker.dp - 2);
            defender.gold += 3;
            defender.totalGoldEarned += 3;
            attacker.allianceWith = null;
            defender.allianceWith = null;
            this.log(`💔 İttifak bozuldu. ${attacker.name}: -2 DP, ${defender.name}: +3 Altın (Tazminat)`);
        }

        if (attacker.isVassal && attacker.masterId === defender.id) {
            return { success: false, msg: "Efendine saldıramazsın!" };
        }
        if (defender.isVassal && defender.masterId === attacker.id) {
            return { success: false, msg: "Vasalını korumalısın, saldıramazsın!" };
        }

        if (defender.isVassal && defender.masterId !== attacker.id) {
            const master = this.players.find(p => p.id === defender.masterId);
            if (master) {
                const validTargets = master.grid
                    .map((cell, idx) => ({ cell, idx }))
                    .filter(item => item.cell && !item.cell.isUnit);

                if (validTargets.length === 0) {
                    return { success: false, msg: `${defender.name} efendisi ${master.name} tarafından korunuyor, ama hedef bulunamadı!` };
                }

                const nonSaray = validTargets.filter(t => t.cell.type !== 'Saray');
                const targetList = nonSaray.length > 0 ? nonSaray : validTargets;
                const selectedTarget = targetList[Math.floor(Math.random() * targetList.length)];

                this.log(`⛓️ ${defender.name} bir vassal! Saldırı efendisi ${master.name}'e yönlendirildi!`);
                return this.initiateAttack(master.id, selectedTarget.idx);
            }
        }

        const targetCell = defender.grid[targetSlotIndex];
        if (!targetCell) return { success: false, msg: "Boş alana saldırılmaz." };

        this.lastDiceRoll = null;

        const wall = defender.grid.find(c => c && c.type === 'Duvar');
        if (wall && targetCell.type !== 'Duvar') {
            const wallIndex = defender.grid.findIndex(c => c && c.type === 'Duvar');
            this.log(`🛡️ Duvar tüm saldırıları karşılıyor! Saldırı otomatik olarak Duvar'a yönlendirildi.`);
            return this.initiateAttack(targetPlayerId, wallIndex);
        }

        if (targetCell.type === 'Saray') {
            // Kışla varsa önce Kışla'ya otomatik yönlendir
            const kışlaEntry = defender.grid
                .map((cell, idx) => ({ cell, idx }))
                .find(({ cell }) => cell && cell.type === 'Kışla');
            if (kışlaEntry) {
                this.log(`🎯 Saray korumalı! Saldırı Kışla'ya yönlendirildi.`);
                return this.initiateAttack(targetPlayerId, kışlaEntry.idx, confirmed);
            }
            // Başka savunma birimi (isUnit) varsa ona yönlendir
            const unitEntry = defender.grid
                .map((cell, idx) => ({ cell, idx }))
                .find(({ cell }) => cell && cell.isUnit);
            if (unitEntry) {
                this.log(`🎯 Saray korumalı! Saldırı ${unitEntry.cell.type}'ye yönlendirildi.`);
                return this.initiateAttack(targetPlayerId, unitEntry.idx, confirmed);
            }
        }

        const attackerMilitary = this.calculateMilitary(attacker);

        this.pendingAttack = {
            attackerId: attacker.id,
            targetPlayerId,
            targetSlotIndex,
            attackerMilitary
        };

        this.log(`⚔️ ${attacker.name}, ${defender.name}'e saldırı başlattı!`);
        this.log(`🎲 Zar atmak için butona bas...`);

        return { success: true, waitingForDice: true };
    },

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
    },

    // Phase 2: Roll dice and complete attack
    async rollDiceForAttack() {
        if (this.isRollingDice) return;
        if (!this.pendingAttack) {
            return { success: false, msg: "Bekleyen saldırı yok!" };
        }

        this.isRollingDice = true;
        try {
            const attacker = this.players.find(p => p.id === this.pendingAttack.attackerId);
            const defender = this.players.find(p => p.id === this.pendingAttack.targetPlayerId);
            const targetSlotIndex = this.pendingAttack.targetSlotIndex;
            const attackerMilitary = this.pendingAttack.attackerMilitary;

            attacker.actionsRemaining -= 1;

            if (!defender.attackedBy) defender.attackedBy = [];
            const attackInfo = {
                text: `${attacker.name} → ${defender.name}`,
                attackerColor: attacker.color,
                defenderColor: defender.color
            };
            if (!defender.attackedBy.some(a => typeof a === 'object' ? a.text === attackInfo.text : a === attackInfo.text)) {
                defender.attackedBy.push(attackInfo);
            }

            const totalMilitaryPower = attackerMilitary;
            const maxAttackPower = Math.ceil(totalMilitaryPower * 0.25);

            let attackRoll, defenseRoll;
            if (this.lastDiceRoll) {
                attackRoll = this.lastDiceRoll.attacker;
                defenseRoll = this.lastDiceRoll.defender;
                this.lastDiceRoll = null;
            } else {
                attackRoll = Math.floor(Math.random() * 6) + 1;
                defenseRoll = Math.floor(Math.random() * 6) + 1;
            }

            const militaryBonus = attacker.militaryBoost || 0;
            if (militaryBonus > 0) {
                this.log(`✨ Askeri Gösteri bonusu: +${militaryBonus}`);
                attacker.militaryBoost = 0;
            }

            const targetCell = defender.grid[targetSlotIndex];
            const defenderMilitary = this.calculateMilitary(defender);
            const defenderMilitaryBonus = Math.ceil(defenderMilitary * 0.20);

            const militaryTech = attacker.technologies.military;
            const militaryMultipliers = [1, 1.2, 1.5, 2, 2.5];
            const techBoostedAttack = Math.floor(maxAttackPower * militaryMultipliers[militaryTech]);

            const defenseTech = defender.technologies.defense;
            const defenseMultipliers = [1, 1.2, 1.5, 2, 2.5];
            let techBoostedDefense = Math.floor((targetCell.power || 0) * defenseMultipliers[defenseTech]);

            // Duvar'ın kendisi hedef alındığında kendi bonusunu sayma
            const hasWall = defender.grid.some((c, i) => c && c.type === 'Duvar' && i !== targetSlotIndex);
            const wallBonus = hasWall ? 5 : 0;
            techBoostedDefense += wallBonus;

            const attackPower = techBoostedAttack + attackRoll + militaryBonus;
            const defensePower = techBoostedDefense + defenderMilitaryBonus + defenseRoll;

            // Diversity bonus check
            const soldierTypes = new Set();
            let hasBarracksForBonus = false;
            attacker.grid.forEach(cell => {
                if (cell && cell.isUnit && cell.name) soldierTypes.add(cell.name);
                if (cell && cell.type === 'Kışla') hasBarracksForBonus = true;
            });
            const hasDiversityBonus = soldierTypes.has('Piyade') &&
                soldierTypes.has('Okçu') &&
                soldierTypes.has('Süvari') &&
                hasBarracksForBonus;

            // Combat data for display
            const attackerBaseCalc = [
                { text: `⚔️ Askeri Güç (%25): ${maxAttackPower}`, color: '#a8dadc' }
            ];
            if (militaryTech > 0) {
                attackerBaseCalc.push({
                    text: `🔬 Silah Teknolojisi Lv${militaryTech} (×${militaryMultipliers[militaryTech]}): +${techBoostedAttack - maxAttackPower}`,
                    color: '#4ecdc4'
                });
            }
            if (militaryBonus > 0) {
                attackerBaseCalc.push({ text: `✨ Askeri Gösteri Bonusu: +${militaryBonus}`, color: '#fbbf24' });
            }
            if (hasDiversityBonus) {
                attackerBaseCalc.push({ text: `🎖️ Çeşitlilik Bonusu: +20%`, color: '#10b981' });
            }

            const defenderBaseCalc = [
                { text: `🏰 Bina Savunması: ${targetCell.power || 0}`, color: '#a8dadc' }
            ];
            if (defenseTech > 0) {
                const rawTechVal = Math.floor((targetCell.power || 0) * defenseMultipliers[defenseTech]);
                defenderBaseCalc.push({
                    text: `🛡️ Savunma Teknolojisi Lv${defenseTech} (×${defenseMultipliers[defenseTech]}): +${rawTechVal - (targetCell.power || 0)}`,
                    color: '#4ecdc4'
                });
            }
            if (hasWall) {
                defenderBaseCalc.push({ text: `🧱 Duvar Bonusu: +5`, color: '#fbbf24' });
            }
            defenderBaseCalc.push({ text: `⚔️ Askeri Bonus (%20): ${defenderMilitaryBonus}`, color: '#a8dadc' });

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

            await this.showCombatCalculation({ ...combatData, targetType: targetCell.type, skipAnimation: attacker.isBot });

            this.log(`⚔️ ZAR ATILDI! ${attacker.name} -> ${defender.name}`);
            if (hasDiversityBonus) this.log(`🎖️ Çeşitlilik Bonusu: +20% (Piyade, Okçu, Süvari, Kışla)`);
            if (militaryTech > 0) this.log(`🔬 Silah Teknolojisi Lv${militaryTech}: ×${militaryMultipliers[militaryTech]}`);
            if (defenseTech > 0) this.log(`🛡️ Savunma Teknolojisi Lv${defenseTech}: ×${defenseMultipliers[defenseTech]}`);
            this.log(`Saldırı: ${attackPower} (Askeri %25: ${maxAttackPower}, Tek Bonus: ${techBoostedAttack - maxAttackPower}, Zar: ${attackRoll})`);
            this.log(`Savunma: ${defensePower} (Bina: ${targetCell.power || 0}, Tek Bonus: ${techBoostedDefense - (targetCell.power || 0)}, Askeri %20: ${defenderMilitaryBonus}, Zar: ${defenseRoll})`);

            const powerDiff = Math.abs(attackPower - defensePower);

            if (attackPower > defensePower) {
                const diff = attackPower - defensePower;
                let damage = 0;
                if (diff <= 5) {
                    damage = 1;
                    this.log(`📉 KISMİ HASAR: Yakın mücadele! Sadece 1 hasar verildi.`);
                } else if (diff <= 15) {
                    damage = 2;
                    this.log(`💥 CİDDİ HASAR: Üstün saldırı! 2 hasar verildi.`);
                } else {
                    damage = diff;
                    this.log(`🔥 YIKICI SALDIRI! Fark çok büyük! ${damage} hasar verildi.`);
                }

                targetCell.hp -= damage;

                this.lastAttackResult = {
                    success: true,
                    damage: damage,
                    targetType: targetCell.type,
                    destroyed: targetCell.hp <= 0
                };

                if (targetCell.hp <= 0) {
                    // Kışla tahliyesi
                    if (targetCell.type === 'Kışla' && targetCell.garrison && targetCell.garrison.length > 0) {
                        const garrisonSoldiers = [...targetCell.garrison];
                        this.log(`⚠️ Kışla yıkıldı! ${garrisonSoldiers.length} asker tahliye ediliyor...`);
                        const otherBarracks = defender.grid.filter(c => c && c.type === 'Kışla' && c !== targetCell);
                        let evacuatedToBarracks = 0;
                        const remainingSoldiers = [];

                        for (const soldier of garrisonSoldiers) {
                            let placed = false;
                            for (const barracks of otherBarracks) {
                                if (!barracks.garrison) barracks.garrison = [];
                                if (barracks.garrison.length < 15) {
                                    barracks.garrison.push(soldier);
                                    evacuatedToBarracks++;
                                    placed = true;
                                    break;
                                }
                            }
                            if (!placed) remainingSoldiers.push(soldier);
                        }

                        if (evacuatedToBarracks > 0) this.log(`✅ ${evacuatedToBarracks} asker diğer Kışla'lara taşındı!`);

                        if (remainingSoldiers.length > 0) {
                            const halfCount = Math.ceil(remainingSoldiers.length / 2);
                            const toAttacker = remainingSoldiers.slice(0, halfCount);
                            const toMercenary = remainingSoldiers.slice(halfCount);

                            if (toAttacker.length > 0) {
                                const result = this.addSoldiersToPlayer(attacker, toAttacker);
                                if (result.added > 0) this.log(`⚔️ ${result.added} asker ${attacker.name} tarafından esir alındı!`);
                            }
                            if (toMercenary.length > 0) {
                                const count = toMercenary.length;
                                const cost = this.calculateMercenaryCost(count);
                                this.mercenaryPool.push({
                                    id: `merc-${Date.now()}-${Math.random()}`,
                                    name: `Paralı Asker (${count})`,
                                    count, soldiers: toMercenary, cost,
                                    type: 'Asker', power: 3, isUnit: true,
                                    description: `${count} adet savaş kaçağı asker.`
                                });
                                this.log(`🎖️ ${count} asker savaş alanından kaçıp Pazar'a düştü!`);
                            }
                        }
                    }

                    const destroyedBuildingName = targetCell.type;
                    const destroyedGarrison = targetCell.garrison ? [...targetCell.garrison] : [];
                    defender.grid[targetSlotIndex] = null;
                    this.log(`💥 ${defender.name}'in ${destroyedBuildingName} binası yıkıldı!`);

                    if (destroyedBuildingName === 'Saray') {
                        this.log(`👑 ${defender.name} MECLİSİ DÜŞTÜ!`);
                        this.makeVassal(defender, attacker);
                    } else {
                        if (destroyedBuildingName === 'Kışla' && destroyedGarrison.length > 0) {
                            this.handleBarracksDestruction(attacker, defender, destroyedGarrison);
                        }
                        attacker.gold += 1;
                        attacker.totalGoldEarned += 1;
                        this.log(`💰 ${attacker.name} yıkımdan 1 Altın kazandı!`);
                    }
                } else {
                    this.log(`🛡️ ${defender.name}, ${targetCell.type} hasar aldı. Kalan HP: ${targetCell.hp}`);
                }

                // Muharebe kayıpları — saldırgan kazandı
                this._applyBattleCasualties(attacker, defender, true, powerDiff);

            } else {
                if (attacker.gold > 0) {
                    attacker.gold -= 1;
                    this.log(`💸 ${attacker.name} başarısız saldırı sonucu 1 Altın kaybetti!`);
                }
                this.lastAttackResult = { success: false, targetType: targetCell.type };

                // Muharebe kayıpları — savunucu kazandı
                this._applyBattleCasualties(attacker, defender, false, powerDiff);
            }

            // Harita animasyonu
            if (this.onAttackAnimated) {
                await this.onAttackAnimated(attacker.id, defender.id, {
                    success: combatSuccess,
                    damage: damageDealt,
                    blocked: !combatSuccess,
                    critical: damageDealt > 10,
                    targetType: targetCell?.type
                });
            }

            this.pendingAttack = null;
            this.clearActionMode();
            this.checkAutoEndTurn();
            return { success: true, showDice: true };
        } finally {
            this.isRollingDice = false;
        }
    },

    showAttackResultNotification(attackData) {
        const notification = document.createElement('div');
        notification.className = 'attack-result-notification';

        const gradient = `linear-gradient(90deg, ${attackData.attackerColor} 0%, ${attackData.attackerColor} 20%,
                         color-mix(in srgb, ${attackData.attackerColor} 50%, ${attackData.defenderColor} 50%) 50%,
                         ${attackData.defenderColor} 80%, ${attackData.defenderColor} 100%)`;

        const successIcon = attackData.success ? '💥' : '🛡️';
        const resultText = attackData.success ? 'BAŞARILI!' : 'BAŞARISIZ!';
        const destroyedText = attackData.destroyed ? '<div>💀 Yıkıldı!</div>' : '';

        notification.innerHTML = `
            <div class="attack-result-content" style="background: ${gradient}">
                <div class="attack-result-header">⚔️ ${attackData.attacker} → ${attackData.defender}</div>
                <div class="attack-result-details">
                    <div>🎯 Hedef: ${attackData.target}</div>
                    <div>${successIcon} ${resultText} - ${attackData.damage} Hasar</div>
                    <div>🎲 Zar: ${attackData.attackRoll} vs ${attackData.defenseRoll}</div>
                    ${destroyedText}
                </div>
            </div>
        `;

        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    showAttackStartNotification(attackData) {
        const notification = document.createElement('div');
        notification.className = 'attack-start-notification';

        const gradient = `linear-gradient(90deg, ${attackData.attackerColor} 0%, ${attackData.attackerColor} 20%,
                         color-mix(in srgb, ${attackData.attackerColor} 50%, ${attackData.defenderColor} 50%) 50%,
                         ${attackData.defenderColor} 80%, ${attackData.defenderColor} 100%)`;

        notification.innerHTML = `
            <div class="attack-start-content" style="background: ${gradient}">
                <div class="attack-start-header">⚔️ SALDIRI BAŞLADI!</div>
                <div class="attack-start-details">
                    <div>${attackData.attacker} → ${attackData.defender}</div>
                    <div>🎯 Hedef: ${attackData.target}</div>
                </div>
            </div>
        `;

        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    async showCombatCalculation(combatData) {
        try {
            this.isCalculatingCombat = true;
            if (window.renderer?._lockInput) window.renderer._lockInput(true);
            const { combatCalculator } = await import('./combatCalculator.js');
            await combatCalculator.showCombatCalculation(combatData);
        } catch (error) {
            console.error('Failed to load combat calculator:', error);
        } finally {
            this.isCalculatingCombat = false;
            if (window.renderer?._lockInput) window.renderer._lockInput(false);
        }
    },

    showPropagandaNotification(data) {
        const notification = document.createElement('div');
        notification.className = 'propaganda-notification';

        const gradient = `linear-gradient(90deg, ${data.attackerColor} 0%, ${data.attackerColor} 20%,
                         color-mix(in srgb, ${data.attackerColor} 50%, ${data.defenderColor} 50%) 50%,
                         ${data.defenderColor} 80%, ${data.defenderColor} 100%)`;

        notification.innerHTML = `
            <div class="propaganda-content" style="background: ${gradient}">
                <div class="propaganda-header">📢 PROPAGANDA BAŞARILI!</div>
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
    },

    makeVassal(vassal, master) {
        vassal.isVassal = true;
        vassal.masterId = master.id;
        vassal.grid[0] = { type: 'Saray', hp: 2 };
        this.log(`👑 ${vassal.name}, ${master.name} KRALLIĞINA BOYUN EĞDİ!`);
        this.checkWinCondition();
    },

    checkWinCondition() {
        const independentPlayers = this.players.filter(p => !p.isVassal);
        if (independentPlayers.length === 1) {
            const winner = independentPlayers[0];
            const totalPlayers = this.players.length;
            const myVassals = this.players.filter(p => p.masterId === winner.id);

            if (myVassals.length === totalPlayers - 1) {
                this.log(`🏆 OYUN BİTTİ! ${winner.name} MUTLAK HAKİM!`);
                if (window.renderer && window.renderer.showGameOver) {
                    window.renderer.showGameOver(winner);
                } else {
                    alert(`${winner.name} KAZANDI!`);
                }
                this.phase = 'SONUÇ';
                this.gameEnded = true;
            }
        }
    },

    addSoldiersToPlayer(player, soldiers) {
        let addedCount = 0;
        const toMercenary = [];

        for (const soldier of soldiers) {
            const barracks = player.grid.find(c => c && c.type === 'Kışla' && (!c.garrison || c.garrison.length < 15));
            if (barracks) {
                if (!barracks.garrison) barracks.garrison = [];
                barracks.garrison.push(soldier);
                addedCount++;
            } else {
                toMercenary.push(soldier);
            }
        }

        if (toMercenary.length > 0) {
            const count = toMercenary.length;
            const cost = this.calculateMercenaryCost(count);
            this.mercenaryPool.push({
                id: `merc-${Date.now()}-${Math.random()}`,
                name: `Paralı Asker (${count})`,
                count, soldiers: toMercenary, cost,
                type: 'Asker', power: 3, isUnit: true,
                description: `${count} adet tecrübeli asker.`
            });
            this.log(`⚠️ Kapasite aşımı! ${count} asker Pazar'a (Paralı Asker) gönderildi.`);
        }

        return { added: addedCount, overflow: toMercenary.length };
    },

    handleBarracksDestruction(attacker, defender, garrison) {
        if (!garrison || garrison.length === 0) return;
        const halfCount = Math.floor(garrison.length / 2);
        const attackerShare = garrison.slice(0, halfCount);
        const defenderShare = garrison.slice(halfCount);

        this.log(`⚖️ Asker Paylaşımı: ${attacker.name} (${attackerShare.length}), ${defender.name} (${defenderShare.length})`);
        if (attackerShare.length > 0) this.distributeOrSellSoldiers(attacker, attackerShare, 'attacker');
        if (defenderShare.length > 0) this.distributeOrSellSoldiers(defender, defenderShare, 'defender');
    },

    distributeOrSellSoldiers(player, soldiers, role) {
        const result = this.addSoldiersToPlayer(player, soldiers);
        if (result.added > 0) {
            const verb = role === 'attacker' ? 'katıldı' : 'sığındı';
            this.log(`➡️ ${result.added} asker ${player.name} ordusuna ${verb}.`);
        }
    },

    /**
     * Muharebe sonrası her iki taraftan asker kaybı uygular.
     * Güç farkı büyüdükçe kayıp sayısı artar.
     * Yakın savaşta kazanan da kayıp verir.
     */
    _applyBattleCasualties(attacker, defender, attackerWon, powerDiff) {
        // Kaybeden taraf: farka göre 1-5 asker
        const loserLosses = powerDiff <= 5  ? 1
                          : powerDiff <= 15 ? 2
                          : powerDiff <= 30 ? 3
                          : Math.min(5, Math.floor(powerDiff / 10));

        // Kazanan taraf: sadece yakın savaşta (≤5 fark) 1 kayıp verir
        const winnerLosses = powerDiff <= 5 ? 1 : 0;

        const loser  = attackerWon ? defender : attacker;
        const winner = attackerWon ? attacker : defender;

        const loserLost  = this._removeGarrisonSoldiers(loser, loserLosses);
        const winnerLost = winnerLosses > 0 ? this._removeGarrisonSoldiers(winner, winnerLosses) : 0;

        if (loserLost > 0)  this.log(`💀 ${loser.name}: ${loserLost} asker muharebede hayatını kaybetti!`);
        if (winnerLost > 0) this.log(`⚔️ ${winner.name}: ${winnerLost} asker çatışmada şehit düştü!`);
    },

    /**
     * Kışla garrison'larından `count` kadar asker kaldırır.
     * En zayıf (en düşük power) askerler önce gider.
     * Kaç asker kaldırıldığını döndürür.
     */
    _removeGarrisonSoldiers(player, count) {
        let removed = 0;
        for (const cell of player.grid) {
            if (!cell || cell.type !== 'Kışla' || !cell.garrison || cell.garrison.length === 0) continue;
            // En düşük güçlü askerler önce kayıp verir
            cell.garrison.sort((a, b) => (a.power || 0) - (b.power || 0));
            const toRemove = Math.min(count - removed, cell.garrison.length);
            cell.garrison.splice(0, toRemove);
            removed += toRemove;
            if (removed >= count) break;
        }
        return removed;
    },

    calculateMercenaryCost(count) {
        if (count <= 10) return 1;
        if (count <= 20) return 2;
        return 3;
    },

    calculateMilitary(player) {
        let basePower = player.grid.reduce((sum, cell) => {
            if (cell && cell.isUnit) {
                let cellPower = cell.power || 0;
                if (cell.garrison && cell.garrison.length > 0) {
                    cellPower += cell.garrison.reduce((gSum, s) => gSum + (s.power || 0), 0);
                }
                return sum + cellPower;
            }
            return sum;
        }, 0);

        player.grid.forEach(cell => {
            if (cell && cell.type === 'Kışla' && cell.garrison && cell.garrison.length > 0) {
                basePower += cell.garrison.reduce((gSum, s) => gSum + (s.power || 0), 0);
            }
        });

        const soldierTypes = new Set();
        let hasBarracks = false;
        player.grid.forEach(cell => {
            if (cell && cell.isUnit && cell.name) soldierTypes.add(cell.name);
            if (cell && cell.type === 'Kışla') {
                hasBarracks = true;
                // Garrison askerlerini de çeşitlilik sayımına dahil et
                if (cell.garrison) cell.garrison.forEach(s => { if (s.name) soldierTypes.add(s.name); });
            }
        });

        const hasAllTypes = soldierTypes.has('Piyade') && soldierTypes.has('Okçu') &&
            soldierTypes.has('Süvari') && hasBarracks;
        if (hasAllTypes) basePower = Math.floor(basePower * 1.2);

        const techMultipliers = [1, 1.2, 1.5, 2, 2.5];
        basePower = Math.floor(basePower * techMultipliers[player.technologies.military]);

        return basePower;
    },

    checkSarayHealth(player) {
        const meclis = player.grid[0];
        if (!meclis || !meclis.garrison) return;
        const civilCount = meclis.garrison.length;

        if (civilCount === 2) {
            meclis.hp = 7;
            this.log(`⚠️ ${player.name} Sarayı zayıfladı! (2 sivil kaldı)`);
        } else if (civilCount === 1) {
            meclis.hp = 5;
            this.log(`🚨 ${player.name} KRİZ DURUMUNDA! (1 sivil kaldı)`);
        } else if (civilCount === 0) {
            meclis.hp = 3;
            this.log(`☠️ ${player.name} KRAL ÖLDÜ! Saray savunmasız!`);
        }
    }
};
