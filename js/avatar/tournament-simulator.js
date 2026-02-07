/**
 * 🏆 TOURNAMENT SIMULATOR ENGINE
 * Ray's Pickleball Platform
 *
 * Simulates pickleball matches between digital avatars based on their stats.
 * Uses weighted probability and randomness to create realistic match outcomes.
 *
 * Usage:
 *   const sim = new TournamentSimulator();
 *   const result = sim.simulateMatch(player1Avatar, player2Avatar);
 */

class TournamentSimulator {
    constructor(options = {}) {
        this.options = {
            pointsToWin: 11,
            winByTwo: true,
            maxPoints: 15, // Cap for deuce situations
            randomnessFactor: 0.25, // How much randomness affects outcomes
            homeCourtAdvantage: 0.02, // Slight advantage for higher seed
            ...options
        };

        // Stat weights for different game situations
        this.statWeights = {
            serve: { power: 0.35, consistency: 0.30, mental: 0.20, court_iq: 0.15 },
            return: { finesse: 0.30, speed: 0.25, consistency: 0.25, court_iq: 0.20 },
            rally: { finesse: 0.25, court_iq: 0.25, consistency: 0.25, speed: 0.15, mental: 0.10 },
            clutch: { mental: 0.40, consistency: 0.30, finesse: 0.20, court_iq: 0.10 },
            power_shot: { power: 0.50, speed: 0.20, consistency: 0.20, court_iq: 0.10 },
            finesse_shot: { finesse: 0.45, court_iq: 0.25, consistency: 0.20, mental: 0.10 }
        };

        // Shot type probabilities based on stats
        this.shotTypes = ['dink', 'drive', 'drop', 'lob', 'volley', 'overhead'];
    }

    /**
     * Calculate a player's effectiveness for a specific situation
     * @param {Object} avatar - Player avatar with stats
     * @param {string} situation - 'serve', 'return', 'rally', 'clutch', etc.
     * @returns {number} Effectiveness score (0-100)
     */
    calculateEffectiveness(avatar, situation) {
        const weights = this.statWeights[situation] || this.statWeights.rally;
        let score = 0;

        for (const [stat, weight] of Object.entries(weights)) {
            const statKey = `stat_${stat}`;
            const statValue = avatar[statKey] || avatar[stat] || 50;
            score += statValue * weight;
        }

        return score;
    }

    /**
     * Determine point winner with weighted probability
     * @param {Object} server - Serving player avatar
     * @param {Object} receiver - Receiving player avatar
     * @param {Object} gameState - Current game state
     * @returns {Object} Point result with details
     */
    simulatePoint(server, receiver, gameState) {
        const isClutch = this.isClutchMoment(gameState);
        const situation = isClutch ? 'clutch' : 'rally';

        // Calculate base probabilities
        let serverAdvantage = this.calculateEffectiveness(server, 'serve');
        let receiverStrength = this.calculateEffectiveness(receiver, 'return');

        // Rally effectiveness
        const serverRally = this.calculateEffectiveness(server, situation);
        const receiverRally = this.calculateEffectiveness(receiver, situation);

        // Combine serve/return with rally ability
        const serverTotal = (serverAdvantage * 0.3) + (serverRally * 0.7);
        const receiverTotal = (receiverStrength * 0.3) + (receiverRally * 0.7);

        // Calculate win probability (0-1)
        const totalScore = serverTotal + receiverTotal;
        let serverWinProb = serverTotal / totalScore;

        // Apply randomness
        const randomAdjustment = (Math.random() - 0.5) * this.options.randomnessFactor;
        serverWinProb += randomAdjustment;

        // Apply seed advantage (if applicable)
        if (server.seed && receiver.seed && server.seed < receiver.seed) {
            serverWinProb += this.options.homeCourtAdvantage;
        }

        // Clamp probability
        serverWinProb = Math.max(0.15, Math.min(0.85, serverWinProb));

        // Determine winner
        const roll = Math.random();
        const serverWins = roll < serverWinProb;

        // Generate point narrative
        const narrative = this.generatePointNarrative(server, receiver, serverWins, gameState);

        return {
            winner: serverWins ? server : receiver,
            loser: serverWins ? receiver : server,
            serverWins,
            probability: serverWinProb,
            roll,
            isClutch,
            narrative,
            shotType: this.getRandomShotType(serverWins ? server : receiver),
            statImpact: this.calculateStatImpact(server, receiver, serverWins)
        };
    }

    /**
     * Check if current game state is a clutch moment
     */
    isClutchMoment(gameState) {
        const { score1, score2, pointsToWin } = gameState;
        const gamePoint = pointsToWin - 1;

        // Game point situations
        if (score1 >= gamePoint || score2 >= gamePoint) return true;

        // Close game (within 2 points near end)
        if (score1 >= 8 && score2 >= 8 && Math.abs(score1 - score2) <= 2) return true;

        return false;
    }

    /**
     * Get a random shot type weighted by player stats
     */
    getRandomShotType(player) {
        const finesse = player.stat_finesse || player.finesse || 50;
        const power = player.stat_power || player.power || 50;

        // Higher finesse = more dinks/drops, higher power = more drives/overheads
        const weights = {
            dink: finesse * 1.5,
            drive: power * 1.2,
            drop: finesse * 1.0,
            lob: 20,
            volley: 40,
            overhead: power * 0.8
        };

        const total = Object.values(weights).reduce((a, b) => a + b, 0);
        let random = Math.random() * total;

        for (const [shot, weight] of Object.entries(weights)) {
            random -= weight;
            if (random <= 0) return shot;
        }

        return 'rally';
    }

    /**
     * Calculate which stats contributed to the point
     */
    calculateStatImpact(player1, player2, player1Wins) {
        const winner = player1Wins ? player1 : player2;
        const stats = ['power', 'finesse', 'speed', 'court_iq', 'consistency', 'mental'];

        const impact = {};
        for (const stat of stats) {
            const value = winner[`stat_${stat}`] || winner[stat] || 50;
            // Random contribution based on stat value
            if (Math.random() < value / 100) {
                impact[stat] = (impact[stat] || 0) + 1;
            }
        }

        return impact;
    }

    /**
     * Generate narrative text for a point
     */
    generatePointNarrative(server, receiver, serverWins, gameState) {
        const winner = serverWins ? server : receiver;
        const loser = serverWins ? receiver : server;

        const winnerName = winner.display_name || 'Player 1';
        const loserName = loser.display_name || 'Player 2';

        const narratives = {
            normal: [
                `${winnerName} wins the point with a well-placed shot!`,
                `${loserName} hits it into the net. Point to ${winnerName}.`,
                `${winnerName} puts it away!`,
                `Great rally! ${winnerName} comes out on top.`,
                `${winnerName} finds the opening and takes the point.`
            ],
            clutch: [
                `CLUTCH! ${winnerName} delivers under pressure!`,
                `${winnerName} shows ice in their veins with a pressure shot!`,
                `Big point for ${winnerName}!`,
                `${winnerName} rises to the occasion!`,
                `Nerves of steel! ${winnerName} takes the crucial point!`
            ],
            power: [
                `${winnerName} CRUSHES it! No chance for ${loserName}.`,
                `Powerful drive from ${winnerName}!`,
                `${winnerName} puts too much pace on it for ${loserName}.`
            ],
            finesse: [
                `Soft hands from ${winnerName} - beautiful dink!`,
                `${winnerName} drops it perfectly into the kitchen.`,
                `Touch shot by ${winnerName} catches ${loserName} off guard.`
            ]
        };

        const isClutch = this.isClutchMoment(gameState);
        const category = isClutch ? 'clutch' :
            (winner.stat_power || winner.power || 50) > 75 ? 'power' :
            (winner.stat_finesse || winner.finesse || 50) > 75 ? 'finesse' : 'normal';

        const options = narratives[category];
        return options[Math.floor(Math.random() * options.length)];
    }

    /**
     * Simulate a complete game
     * @param {Object} player1 - First player avatar
     * @param {Object} player2 - Second player avatar
     * @param {Function} onPoint - Optional callback for each point
     * @returns {Object} Game result
     */
    simulateGame(player1, player2, onPoint = null) {
        let score1 = 0;
        let score2 = 0;
        let server = player1; // Player 1 starts serving
        let receiver = player2;
        const pointLog = [];
        const statImpact = {
            player1: { power: 0, finesse: 0, speed: 0, court_iq: 0, consistency: 0, mental: 0 },
            player2: { power: 0, finesse: 0, speed: 0, court_iq: 0, consistency: 0, mental: 0 }
        };

        while (true) {
            const gameState = {
                score1,
                score2,
                pointsToWin: this.options.pointsToWin,
                server: server === player1 ? 1 : 2
            };

            const pointResult = this.simulatePoint(server, receiver, gameState);

            // Update scores
            if (pointResult.winner === player1) {
                score1++;
                // Accumulate stat impact
                for (const [stat, value] of Object.entries(pointResult.statImpact)) {
                    statImpact.player1[stat] += value;
                }
            } else {
                score2++;
                for (const [stat, value] of Object.entries(pointResult.statImpact)) {
                    statImpact.player2[stat] += value;
                }
            }

            // Log point
            pointLog.push({
                point: pointLog.length + 1,
                score: `${score1}-${score2}`,
                winner: pointResult.winner === player1 ? 'player1' : 'player2',
                narrative: pointResult.narrative,
                shotType: pointResult.shotType,
                isClutch: pointResult.isClutch
            });

            // Callback
            if (onPoint) {
                onPoint({
                    score1,
                    score2,
                    ...pointResult
                });
            }

            // Check for winner
            const minPoints = this.options.pointsToWin;
            const maxPoints = this.options.maxPoints;

            if (this.options.winByTwo) {
                // Need to win by 2
                if ((score1 >= minPoints || score2 >= minPoints) &&
                    Math.abs(score1 - score2) >= 2) {
                    break;
                }
                // Cap at max points
                if (score1 >= maxPoints || score2 >= maxPoints) {
                    break;
                }
            } else {
                if (score1 >= minPoints || score2 >= minPoints) {
                    break;
                }
            }

            // Side out - switch server (simplified, every point)
            if (pointResult.winner !== server) {
                [server, receiver] = [receiver, server];
            }
        }

        const winner = score1 > score2 ? player1 : player2;

        return {
            winner,
            loser: winner === player1 ? player2 : player1,
            score: { player1: score1, player2: score2 },
            totalPoints: score1 + score2,
            pointLog,
            statImpact,
            keyMoments: this.extractKeyMoments(pointLog)
        };
    }

    /**
     * Extract key moments from the point log
     */
    extractKeyMoments(pointLog) {
        return pointLog.filter(p => p.isClutch).slice(-5); // Last 5 clutch moments
    }

    /**
     * Simulate a complete match (best of N games)
     * @param {Object} player1 - First player avatar
     * @param {Object} player2 - Second player avatar
     * @param {number} bestOf - Best of N games (1, 3, or 5)
     * @param {Function} onGame - Optional callback after each game
     * @returns {Object} Match result
     */
    simulateMatch(player1, player2, bestOf = 1, onGame = null) {
        const gamesToWin = Math.ceil(bestOf / 2);
        let games1 = 0;
        let games2 = 0;
        const gameResults = [];

        while (games1 < gamesToWin && games2 < gamesToWin) {
            const gameResult = this.simulateGame(player1, player2);
            gameResults.push(gameResult);

            if (gameResult.winner === player1) {
                games1++;
            } else {
                games2++;
            }

            if (onGame) {
                onGame({
                    game: gameResults.length,
                    games1,
                    games2,
                    gameResult
                });
            }
        }

        const winner = games1 > games2 ? player1 : player2;

        // Combine stat impacts from all games
        const totalStatImpact = {
            player1: { power: 0, finesse: 0, speed: 0, court_iq: 0, consistency: 0, mental: 0 },
            player2: { power: 0, finesse: 0, speed: 0, court_iq: 0, consistency: 0, mental: 0 }
        };

        for (const game of gameResults) {
            for (const stat of Object.keys(totalStatImpact.player1)) {
                totalStatImpact.player1[stat] += game.statImpact.player1[stat];
                totalStatImpact.player2[stat] += game.statImpact.player2[stat];
            }
        }

        return {
            winner,
            loser: winner === player1 ? player2 : player1,
            score: { games1, games2 },
            gameResults,
            totalStatImpact,
            totalPoints: gameResults.reduce((sum, g) => sum + g.totalPoints, 0),
            keyMoments: gameResults.flatMap(g => g.keyMoments).slice(-10)
        };
    }

    /**
     * Run a complete tournament bracket
     * @param {Array} players - Array of player avatars (must be power of 2)
     * @param {Function} onMatch - Optional callback after each match
     * @returns {Object} Tournament results
     */
    runTournament(players, onMatch = null) {
        if (players.length < 2 || (players.length & (players.length - 1)) !== 0) {
            throw new Error('Tournament must have 2, 4, 8, 16, 32, or 64 players');
        }

        // Seed players by overall rating
        const seededPlayers = [...players].sort((a, b) => {
            const ratingA = a.overall_rating || a.entry_overall || 50;
            const ratingB = b.overall_rating || b.entry_overall || 50;
            return ratingB - ratingA;
        }).map((p, i) => ({ ...p, seed: i + 1 }));

        // Create bracket with proper seeding (1v16, 8v9, etc.)
        const bracket = this.createSeededBracket(seededPlayers);

        const rounds = [];
        let currentRound = bracket;
        let roundNumber = 1;

        while (currentRound.length > 1) {
            const nextRound = [];
            const roundMatches = [];

            for (let i = 0; i < currentRound.length; i += 2) {
                const player1 = currentRound[i];
                const player2 = currentRound[i + 1];

                const matchResult = this.simulateMatch(player1, player2);

                roundMatches.push({
                    matchNumber: i / 2 + 1,
                    player1,
                    player2,
                    result: matchResult
                });

                nextRound.push(matchResult.winner);

                if (onMatch) {
                    onMatch({
                        round: roundNumber,
                        match: i / 2 + 1,
                        player1,
                        player2,
                        winner: matchResult.winner,
                        score: matchResult.score
                    });
                }
            }

            rounds.push({
                roundNumber,
                name: this.getRoundName(currentRound.length),
                matches: roundMatches
            });

            currentRound = nextRound;
            roundNumber++;
        }

        const champion = currentRound[0];

        // Determine placements
        const finalRound = rounds[rounds.length - 1];
        const semifinalRound = rounds.length > 1 ? rounds[rounds.length - 2] : null;

        const runnerUp = finalRound.matches[0].result.loser;
        const thirdPlace = semifinalRound ?
            semifinalRound.matches.map(m => m.result.loser)
                .sort((a, b) => (b.overall_rating || 50) - (a.overall_rating || 50))[0] :
            null;

        return {
            champion,
            runnerUp,
            thirdPlace,
            rounds,
            totalMatches: rounds.reduce((sum, r) => sum + r.matches.length, 0),
            bracket: this.buildBracketVisualization(rounds)
        };
    }

    /**
     * Create properly seeded bracket (1v16, 8v9, 4v13, etc.)
     */
    createSeededBracket(players) {
        const n = players.length;

        if (n === 2) return players;

        // Standard tournament seeding
        const bracket = new Array(n);
        const seeds = this.generateSeedOrder(n);

        for (let i = 0; i < n; i++) {
            bracket[seeds[i]] = players[i];
        }

        return bracket;
    }

    /**
     * Generate standard tournament seed positions
     */
    generateSeedOrder(n) {
        if (n === 2) return [0, 1];

        const half = n / 2;
        const quarterSeeds = this.generateSeedOrder(half);

        const seeds = [];
        for (let i = 0; i < half; i++) {
            seeds.push(quarterSeeds[i] * 2);
            seeds.push(n - 1 - quarterSeeds[i] * 2);
        }

        return seeds;
    }

    /**
     * Get round name based on remaining players
     */
    getRoundName(playersRemaining) {
        const names = {
            2: 'Final',
            4: 'Semifinals',
            8: 'Quarterfinals',
            16: 'Round of 16',
            32: 'Round of 32',
            64: 'Round of 64'
        };
        return names[playersRemaining] || `Round of ${playersRemaining}`;
    }

    /**
     * Build bracket visualization data
     */
    buildBracketVisualization(rounds) {
        return rounds.map(round => ({
            name: round.name,
            matches: round.matches.map(m => ({
                player1: {
                    name: m.player1.display_name || 'Player',
                    seed: m.player1.seed,
                    rating: m.player1.overall_rating || m.player1.entry_overall
                },
                player2: {
                    name: m.player2.display_name || 'Player',
                    seed: m.player2.seed,
                    rating: m.player2.overall_rating || m.player2.entry_overall
                },
                winner: m.result.winner.display_name,
                score: `${m.result.score.games1}-${m.result.score.games2}`
            }))
        }));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TournamentSimulator };
}

// Also attach to window for browser use
if (typeof window !== 'undefined') {
    window.TournamentSimulator = TournamentSimulator;
}
