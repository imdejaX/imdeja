/**
 * DiplomacyMixin — Diplomasi kartları, ittifak ve vasal bağış sistemi.
 * Game.prototype'a Object.assign ile uygulanır.
 */
export const DiplomacyMixin = {

    playDiplomacyCard(handIndex, targetPlayerId = null) {
        const player = this.getActivePlayer();
        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const card = player.hand[handIndex];
        if (!card || card.type !== 'Diplomasi') return { success: false, msg: "Geçersiz kart!" };

        const needsTarget = card.effect && card.effect !== 'gold_boost' &&
            card.effect !== 'military_boost' && card.effect !== 'white_flag';

        if (needsTarget) {
            if (!targetPlayerId) return { success: false, msg: "Bu kart için bir hedef seçmelisin!" };
            const target = this.players.find(p => p.id === targetPlayerId);
            if (!target) return { success: false, msg: "Hedef bulunamadı!" };
        }

        player.actionsRemaining -= 1;
        player.dp += card.dp || 0;
        this.log(`${player.name}, ${card.name} oynadı! +${card.dp} DP`);
        player.hand.splice(handIndex, 1);
        this.selectedCardIndex = null;

        if (card.effect) {
            if (card.effect === 'gold_boost') {
                player.gold += 3;
                player.totalGoldEarned += 3;
                this.log(`💰 ${player.name}, +3 Altın kazandı!`);

            } else if (card.effect === 'military_boost') {
                player.militaryBoost = 3;
                this.log(`⚔️ ${player.name}, **sonraki saldırısında** +3 güç bonusu kazandı!`);

            } else {
                const target = this.players.find(p => p.id === targetPlayerId);

                switch (card.effect) {

                    case 'repair_building': {
                        const allowedTypes = ['Kışla', 'Duvar', 'Çiftlik'];
                        const maxHpValues = { 'Kışla': 6, 'Duvar': 6, 'Çiftlik': 5 };
                        const damagedBuildings = player.grid.filter(c =>
                            c && allowedTypes.includes(c.type) && c.hp < maxHpValues[c.type]
                        );

                        if (damagedBuildings.length === 0) {
                            this.log(`⚠️ ONARIM BAŞARISIZ! ${player.name}'in onarılacak hasarlı binası yok!`);
                            player.hand.push(card);
                            player.actionsRemaining += 1;
                            player.dp -= card.dp || 0;
                            return { success: false, msg: "Onarılacak hasarlı bina yok!" };
                        }

                        damagedBuildings.sort((a, b) => a.hp - b.hp);
                        const targetBuilding = damagedBuildings[0];
                        const oldHp = targetBuilding.hp;
                        targetBuilding.hp = maxHpValues[targetBuilding.type];
                        this.log(`🔨 MİMARİ ONARIM: ${player.name}, ${targetBuilding.type} binasını tamamen yeniledi! (${oldHp} -> ${targetBuilding.hp} HP)`);
                        break;
                    }

                    case 'steal_card': {
                        if (target.hand.length > 0) {
                            const randomIndex = Math.floor(Math.random() * target.hand.length);
                            const stolenCard = target.hand.splice(randomIndex, 1)[0];
                            player.hand.push(stolenCard);
                            this.log(`🕵️ CASUSLUK BAŞARILI! ${player.name}, ${target.name}'den "${stolenCard.name}" kartını çaldı!`);
                        } else {
                            this.log(`⚠️ CASUSLUK BAŞARISIZ! ${target.name}'in elinde kart yok!`);
                        }
                        break;
                    }

                    case 'steal_unit': {
                        const units = target.grid
                            .map((cell, idx) => ({ cell, idx }))
                            .filter(item => item.cell && item.cell.isUnit);

                        if (units.length > 0) {
                            const randomUnit = units[Math.floor(Math.random() * units.length)];
                            const emptySlots = player.grid
                                .map((cell, idx) => ({ cell, idx }))
                                .filter(item => !item.cell);

                            if (emptySlots.length > 0) {
                                const { capacity, totalPop } = this.getCapacityInfo(player);
                                if (totalPop + 1 > capacity) {
                                    this.log(`⚠️ PROPAGANDA BAŞARISIZ! ${player.name} nüfus limiti dolu!`);
                                    break;
                                }
                                const targetSlot = emptySlots[0];
                                const stolenUnitType = target.grid[randomUnit.idx].type;
                                player.grid[targetSlot.idx] = target.grid[randomUnit.idx];
                                target.grid[randomUnit.idx] = null;
                                this.log(`🎭 PROPAGANDA BAŞARILI! ${player.name}, ${target.name}'den ${stolenUnitType} çaldı!`);
                                this.showPropagandaNotification({
                                    attacker: player.name, attackerColor: player.color,
                                    defender: target.name, defenderColor: target.color,
                                    unitName: stolenUnitType
                                });
                            } else {
                                this.log(`⚠️ PROPAGANDA BAŞARISIZ! ${player.name}'in boş alanı yok!`);
                            }
                        } else {
                            this.log(`⚠️ PROPAGANDA BAŞARISIZ! ${target.name}'in askeri birimi yok!`);
                        }
                        break;
                    }

                    case 'break_alliance': {
                        const playerMilitary = this.calculateMilitary(player);
                        if (playerMilitary < (card.minMilitary || 20)) {
                            this.log(`❌ NİFAK TOHUMU BAŞARISIZ! Yeterli askeri güç yok! (${playerMilitary}/20)`);
                            player.hand.push(card);
                            player.actionsRemaining += 1;
                            player.dp -= card.dp || 0;
                            return { success: false, msg: `En az 20 askeri güç gerekli! (Mevcut: ${playerMilitary})` };
                        }

                        if (!target.allianceWith) {
                            this.log(`❌ NİFAK TOHUMU BAŞARISIZ! ${target.name}'in ittifakı yok!`);
                            player.hand.push(card);
                            player.actionsRemaining += 1;
                            player.dp -= card.dp || 0;
                            return { success: false, msg: `${target.name}'in ittifakı yok!` };
                        }

                        const targetAlly = this.players.find(p => p.id === target.allianceWith);
                        const attackerPower = playerMilitary + player.dp;
                        const targetMilitary = this.calculateMilitary(target);
                        const allyMilitary = this.calculateMilitary(targetAlly);
                        const defenderPower = targetMilitary + target.dp + allyMilitary + targetAlly.dp;

                        this.log(`⚔️ NİFAK TOHUMU: ${player.name} (${attackerPower}) vs ${target.name}+${targetAlly.name} (${defenderPower})`);

                        if (attackerPower > defenderPower) {
                            target.allianceWith = null;
                            targetAlly.allianceWith = null;
                            this.log(`✅ NİFAK TOHUMU BAŞARILI! ${target.name} ile ${targetAlly.name} arasındaki ittifak bozuldu!`);
                        } else {
                            player.dp = Math.max(1, player.dp - 2);
                            target.dp += 1;
                            targetAlly.dp += 1;
                            this.log(`❌ NİFAK TOHUMU BAŞARISIZ! ${player.name}: -2 DP | ${target.name}: +1 DP | ${targetAlly.name}: +1 DP`);
                        }
                        break;
                    }

                    case 'terror_joker': {
                        if (player.dp < 10) {
                            this.log(`❌ TERÖR JOKERİ BAŞARISIZ! ${player.name} yeterli DP'ye sahip değil! (${player.dp}/10)`);
                            player.hand.push(card);
                            player.actionsRemaining += 1;
                            return { success: false, msg: `En az 10 DP gerekli! (Mevcut: ${player.dp})` };
                        }

                        player.dp = Math.max(0, player.dp - 2);

                        const destructibleBuildings = target.grid
                            .map((cell, idx) => ({ cell, idx }))
                            .filter(item => item.cell && !item.cell.isUnit && item.cell.type !== 'Saray');

                        if (destructibleBuildings.length > 0) {
                            const randomBuilding = destructibleBuildings[Math.floor(Math.random() * destructibleBuildings.length)];
                            const bName = randomBuilding.cell.type;
                            const bGarrison = randomBuilding.cell.garrison ? [...randomBuilding.cell.garrison] : [];
                            target.grid[randomBuilding.idx] = null;
                            this.log(`💣 TERÖR JOKERİ! ${player.name}, ${target.name}'in ${bName} binasını havaya uçurdu! (-2 DP)`);
                            if (bName === 'Kışla') {
                                this.log(`🏚️ Yıkılan Kışla'dan askerler kaçışıyor...`);
                                this.handleBarracksDestruction(player, target, bGarrison);
                            }
                        } else {
                            this.log(`⚠️ TERÖR JOKERİ ETKİSİZ! ${target.name}'in yıkılacak binası yok!`);
                        }
                        break;
                    }

                    case 'white_flag': {
                        const duration = card.duration || 1;
                        player.whiteFlagTurns = duration;
                        this.log(`🏳️ BEYAZ BAYRAK! ${player.name}, ${duration} tur boyunca saldırıya karşı korunuyor!`);
                        break;
                    }

                    case 'assassination': {
                        const totalSoldiers = player.grid.filter(c => c && c.isUnit).length +
                            player.grid.reduce((sum, c) => sum + (c?.garrison?.length || 0), 0);

                        if (totalSoldiers <= 20) {
                            player.hand.push(card); player.actionsRemaining += 1; player.dp -= card.dp || 0;
                            return { success: false, msg: `En az 20 asker gerekli! (Mevcut: ${totalSoldiers})` };
                        }
                        if (player.technologies.military < 3) {
                            player.hand.push(card); player.actionsRemaining += 1; player.dp -= card.dp || 0;
                            return { success: false, msg: 'Silah III veya IV teknolojisi gerekli!' };
                        }

                        const attackerMilitaryPower = this.calculateMilitary(player);
                        const attackerRoll = Math.floor(Math.random() * 6) + 1;
                        const defenderRoll = Math.floor(Math.random() * 6) + 1;
                        const targetSaray = target.grid[0];
                        const garrisonBonus = targetSaray?.garrison?.length || 0;
                        const attackerScore = attackerRoll + player.dp + Math.floor(attackerMilitaryPower / 5);
                        const defenderScore = defenderRoll + target.dp + (garrisonBonus * 2) + 6;

                        this.log(`🗡️ SUİKAST GİRİŞİMİ! ${player.name} → ${target.name}`);
                        this.log(`Saldırı: ${attackerScore} | Savunma: ${defenderScore}`);

                        if (attackerScore > defenderScore) {
                            if (targetSaray && targetSaray.garrison) {
                                const killed = Math.min(2, targetSaray.garrison.length);
                                targetSaray.garrison.splice(0, killed);
                                target.dp = Math.max(1, target.dp - 5);
                                player.dp += 3;
                                this.log(`✅ SUİKAST BAŞARILI! ${killed} sivil öldürüldü! ${target.name}: -5 DP, ${player.name}: +3 DP`);
                                this.checkSarayHealth(target);
                            }
                        } else {
                            player.dp = Math.max(1, player.dp - 6);
                            player.gold = Math.max(0, player.gold - 10);
                            target.dp += 2;
                            this.log(`❌ SUİKAST BAŞARISIZ! ${player.name}: -6 DP, -10 Altın | ${target.name}: +2 DP`);
                        }
                        break;
                    }

                    default:
                        this.log(`⚠️ Bilinmeyen Diplomasi Kartı: ${card.effect}`);
                }
            }
        }

        this.checkAutoEndTurn();
        return { success: true };
    },

    proposeAlliance(targetPlayerId) {
        const proposer = this.getActivePlayer();
        const target = this.players.find(p => p.id === targetPlayerId);
        if (proposer.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };
        if (proposer.id === target.id) return { success: false, msg: "Kendinle ittifak kuramazsın!" };
        if (proposer.allianceWith !== null) return { success: false, msg: "Zaten bir ittifakın var!" };
        if (target.allianceWith !== null) return { success: false, msg: "Hedefin zaten müttefiki var!" };
        if (proposer.dp === target.dp) return { success: false, msg: "Eşit DP ile teklif edilemez!" };
        if (proposer.isVassal || target.isVassal) return { success: false, msg: "Vasallar ittifak kuramaz!" };

        const independentPlayers = this.players.filter(p => !p.isVassal);
        if (independentPlayers.length === 2 &&
            independentPlayers.includes(proposer) &&
            independentPlayers.includes(target)) {
            return { success: false, msg: "Son iki bağımsız krallık ittifak kuramaz! Biri kazanmalı!" };
        }

        if (proposer.dp < target.dp) {
            return {
                success: false,
                msg: `❌ Sadece daha yüksek DP'li oyuncular ittifak teklif edebilir!\n\nSenin DP'n: ${proposer.dp}\n${target.name} DP: ${target.dp}`
            };
        }

        proposer.actionsRemaining -= 1;

        const proposerMilitary = this.calculateMilitary(proposer);
        const targetMilitary = this.calculateMilitary(target);

        if (targetMilitary >= proposerMilitary * 3) {
            this.log(`❌ ${target.name}, ${proposer.name}'in teklifini REDDETTİ! (Askeri üstünlük: ${targetMilitary} vs ${proposerMilitary})`);
            return { success: true, msg: `Teklif reddedildi! ${target.name} askeri olarak çok güçlü.` };
        }

        proposer.allianceWith = target.id;
        target.allianceWith = proposer.id;
        this.log(`🤝 İTTİFAK! ${proposer.name} ⇄ ${target.name} (DP: ${proposer.dp} > ${target.dp})`);

        this.checkAutoEndTurn();
        return { success: true };
    },

    breakAlliance() {
        const player = this.getActivePlayer();
        if (player.allianceWith === null) return { success: false, msg: "İttifakın yok!" };
        if (player.actionsRemaining < 1) return { success: false, msg: "Aksiyon kalmadı!" };

        const ally = this.players.find(p => p.id === player.allianceWith);
        player.dp = Math.max(1, player.dp - 2);
        player.actionsRemaining -= 1;
        ally.gold += 3;
        ally.totalGoldEarned += 3;
        player.allianceWith = null;
        ally.allianceWith = null;

        this.log(`💔 ${player.name}, ${ally.name} ile ittifakı bozdu! (-2 DP, ${ally.name} +3 Altın)`);
        this.checkAutoEndTurn();
        return { success: true };
    },

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
            const units = player.grid
                .map((cell, idx) => ({ cell, idx }))
                .filter(item => item.cell && item.cell.isUnit);
            if (units.length === 0) return { success: false, msg: "Bağışlanacak asker yok!" };

            const emptySlots = target.grid
                .map((cell, idx) => ({ cell, idx }))
                .filter(item => !item.cell);
            if (emptySlots.length === 0) return { success: false, msg: "Hedefin boş alanı yok!" };

            const unitToTransfer = units[0];
            const targetSlot = emptySlots[0];
            target.grid[targetSlot.idx] = player.grid[unitToTransfer.idx];
            player.grid[unitToTransfer.idx] = null;
            this.log(`🎁 ${player.name}, ${target.name}'e ${target.grid[targetSlot.idx].type} bağışladı!`);
        }

        this.checkAutoEndTurn();
        return { success: true };
    }
};
