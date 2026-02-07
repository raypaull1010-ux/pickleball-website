/**
 * 🏆 TOURNAMENT API ENDPOINTS
 * Ray's Pickleball Platform
 *
 * Netlify serverless function for tournament management.
 *
 * Endpoints:
 *   GET    /api/tournaments              - List tournaments
 *   GET    /api/tournaments/:id          - Get tournament details
 *   POST   /api/tournaments/:id/enter    - Enter tournament
 *   POST   /api/tournaments/:id/simulate - Run tournament simulation
 *   GET    /api/tournaments/:id/bracket  - Get tournament bracket
 */

// Mock database
const mockTournaments = new Map();
const mockEntries = new Map();

// Initialize with sample tournament
mockTournaments.set('feb-2025', {
    id: 'feb-2025',
    name: 'February Digital Championship',
    description: 'Monthly tournament for all skill levels. Win exclusive badges and coins!',
    start_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
    end_date: null,
    max_participants: 32,
    min_rating: 0,
    max_rating: 99,
    entry_fee_coins: 0,
    prize_badge_id: 'badge-champion-feb-2025',
    prize_coins_1st: 500,
    prize_coins_2nd: 250,
    prize_coins_3rd: 100,
    prize_xp: 1000,
    status: 'registration', // upcoming, registration, in_progress, completed, cancelled
    registration_opens_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    registration_closes_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    winner_avatar_id: null,
    runner_up_avatar_id: null,
    third_place_avatar_id: null,
    participants_count: 28,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
});

exports.handler = async (event, context) => {
    const { httpMethod, path, body, queryStringParameters } = event;

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    try {
        const pathParts = path.replace(/^\/\.netlify\/functions\/api-tournament\/?/, '').split('/').filter(Boolean);

        // GET /api/tournaments - List all
        if (pathParts.length === 0 && httpMethod === 'GET') {
            return handleListTournaments(queryStringParameters, headers);
        }

        // GET /api/tournaments/:id
        if (pathParts.length === 1 && httpMethod === 'GET') {
            return handleGetTournament(pathParts[0], headers);
        }

        // POST /api/tournaments/:id/enter
        if (pathParts.length === 2 && pathParts[1] === 'enter' && httpMethod === 'POST') {
            return handleEnterTournament(pathParts[0], JSON.parse(body || '{}'), headers);
        }

        // POST /api/tournaments/:id/simulate
        if (pathParts.length === 2 && pathParts[1] === 'simulate' && httpMethod === 'POST') {
            return handleSimulateTournament(pathParts[0], headers);
        }

        // GET /api/tournaments/:id/bracket
        if (pathParts.length === 2 && pathParts[1] === 'bracket' && httpMethod === 'GET') {
            return handleGetBracket(pathParts[0], headers);
        }

        // GET /api/tournaments/:id/entries
        if (pathParts.length === 2 && pathParts[1] === 'entries' && httpMethod === 'GET') {
            return handleGetEntries(pathParts[0], headers);
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Not found' })
        };

    } catch (error) {
        console.error('Tournament API Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

/**
 * List tournaments
 */
function handleListTournaments(params, headers) {
    const status = params?.status;
    const limit = parseInt(params?.limit) || 10;

    let tournaments = Array.from(mockTournaments.values());

    if (status) {
        tournaments = tournaments.filter(t => t.status === status);
    }

    tournaments = tournaments
        .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
        .slice(0, limit);

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            tournaments,
            total: tournaments.length
        })
    };
}

/**
 * Get tournament details
 */
function handleGetTournament(tournamentId, headers) {
    const tournament = mockTournaments.get(tournamentId);

    if (!tournament) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Tournament not found' })
        };
    }

    // Calculate time until start
    const startDate = new Date(tournament.start_date);
    const now = new Date();
    const msUntilStart = startDate - now;

    const timeUntilStart = {
        days: Math.floor(msUntilStart / (1000 * 60 * 60 * 24)),
        hours: Math.floor((msUntilStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((msUntilStart % (1000 * 60 * 60)) / (1000 * 60))
    };

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            ...tournament,
            time_until_start: timeUntilStart,
            is_registration_open: tournament.status === 'registration',
            spots_remaining: tournament.max_participants - tournament.participants_count
        })
    };
}

/**
 * Enter tournament
 */
function handleEnterTournament(tournamentId, data, headers) {
    const tournament = mockTournaments.get(tournamentId);

    if (!tournament) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Tournament not found' })
        };
    }

    if (tournament.status !== 'registration') {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Tournament registration is not open' })
        };
    }

    if (tournament.participants_count >= tournament.max_participants) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Tournament is full' })
        };
    }

    if (!data.avatar_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'avatar_id is required' })
        };
    }

    // Check if already entered
    const entryKey = `${tournamentId}-${data.avatar_id}`;
    if (mockEntries.has(entryKey)) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Already entered this tournament' })
        };
    }

    // Create entry with snapshot of current stats
    const entry = {
        id: `entry-${Date.now()}`,
        tournament_id: tournamentId,
        avatar_id: data.avatar_id,
        entry_power: data.stat_power || 50,
        entry_finesse: data.stat_finesse || 50,
        entry_speed: data.stat_speed || 50,
        entry_court_iq: data.stat_court_iq || 50,
        entry_consistency: data.stat_consistency || 50,
        entry_mental: data.stat_mental || 50,
        entry_overall: data.overall_rating || 50,
        seed: null, // Assigned when tournament starts
        current_round: 0,
        eliminated: false,
        final_placement: null,
        registered_at: new Date().toISOString()
    };

    mockEntries.set(entryKey, entry);

    // Update participant count
    tournament.participants_count++;
    mockTournaments.set(tournamentId, tournament);

    return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
            message: 'Successfully entered tournament!',
            entry,
            tournament_spots_remaining: tournament.max_participants - tournament.participants_count
        })
    };
}

/**
 * Get tournament entries
 */
function handleGetEntries(tournamentId, headers) {
    const entries = Array.from(mockEntries.values())
        .filter(e => e.tournament_id === tournamentId)
        .sort((a, b) => b.entry_overall - a.entry_overall);

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            entries,
            total: entries.length
        })
    };
}

/**
 * Simulate tournament (runs the bracket)
 */
function handleSimulateTournament(tournamentId, headers) {
    const tournament = mockTournaments.get(tournamentId);

    if (!tournament) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Tournament not found' })
        };
    }

    // Get all entries
    const entries = Array.from(mockEntries.values())
        .filter(e => e.tournament_id === tournamentId)
        .sort((a, b) => b.entry_overall - a.entry_overall);

    if (entries.length < 2) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Not enough participants to run tournament' })
        };
    }

    // Assign seeds
    entries.forEach((entry, index) => {
        entry.seed = index + 1;
    });

    // Simple bracket simulation (would use TournamentSimulator in production)
    const results = simulateBracket(entries);

    // Update tournament
    tournament.status = 'completed';
    tournament.winner_avatar_id = results.champion.avatar_id;
    tournament.runner_up_avatar_id = results.runnerUp.avatar_id;
    tournament.third_place_avatar_id = results.thirdPlace?.avatar_id || null;
    tournament.bracket = results.bracket;
    tournament.updated_at = new Date().toISOString();

    mockTournaments.set(tournamentId, tournament);

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            message: 'Tournament simulation complete!',
            results: {
                champion: results.champion,
                runner_up: results.runnerUp,
                third_place: results.thirdPlace,
                bracket: results.bracket
            }
        })
    };
}

/**
 * Get tournament bracket
 */
function handleGetBracket(tournamentId, headers) {
    const tournament = mockTournaments.get(tournamentId);

    if (!tournament) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Tournament not found' })
        };
    }

    // Get entries and build bracket structure
    const entries = Array.from(mockEntries.values())
        .filter(e => e.tournament_id === tournamentId)
        .sort((a, b) => (a.seed || 999) - (b.seed || 999));

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            tournament_id: tournamentId,
            status: tournament.status,
            entries: entries.map(e => ({
                avatar_id: e.avatar_id,
                seed: e.seed,
                overall: e.entry_overall,
                eliminated: e.eliminated,
                placement: e.final_placement
            })),
            bracket: tournament.bracket || null,
            winner: tournament.winner_avatar_id,
            runner_up: tournament.runner_up_avatar_id,
            third_place: tournament.third_place_avatar_id
        })
    };
}

/**
 * Simple bracket simulation
 */
function simulateBracket(entries) {
    // Pad to power of 2
    const targetSize = Math.pow(2, Math.ceil(Math.log2(entries.length)));
    while (entries.length < targetSize) {
        entries.push({ avatar_id: 'bye', entry_overall: 0, isBye: true });
    }

    const bracket = [];
    let currentRound = [...entries];
    let roundNumber = 1;

    while (currentRound.length > 1) {
        const nextRound = [];
        const matches = [];

        for (let i = 0; i < currentRound.length; i += 2) {
            const p1 = currentRound[i];
            const p2 = currentRound[i + 1];

            let winner;

            if (p1.isBye) {
                winner = p2;
            } else if (p2.isBye) {
                winner = p1;
            } else {
                // Simulate match (simplified)
                const p1Chance = p1.entry_overall / (p1.entry_overall + p2.entry_overall);
                winner = Math.random() < p1Chance ? p1 : p2;

                // Mark loser as eliminated
                const loser = winner === p1 ? p2 : p1;
                if (!loser.isBye) {
                    loser.eliminated = true;
                    loser.final_placement = currentRound.length;
                }
            }

            matches.push({
                match: i / 2 + 1,
                player1: p1.isBye ? null : { avatar_id: p1.avatar_id, seed: p1.seed, overall: p1.entry_overall },
                player2: p2.isBye ? null : { avatar_id: p2.avatar_id, seed: p2.seed, overall: p2.entry_overall },
                winner: winner.avatar_id,
                score: p1.isBye || p2.isBye ? 'BYE' : `11-${Math.floor(Math.random() * 8) + 3}`
            });

            nextRound.push(winner);
        }

        bracket.push({
            round: roundNumber,
            name: getRoundName(currentRound.length),
            matches
        });

        currentRound = nextRound;
        roundNumber++;
    }

    const champion = currentRound[0];
    champion.final_placement = 1;

    // Find runner-up and third place from bracket
    const finalMatch = bracket[bracket.length - 1]?.matches[0];
    const runnerUpId = finalMatch?.player1?.avatar_id === champion.avatar_id ?
        finalMatch?.player2?.avatar_id : finalMatch?.player1?.avatar_id;

    const runnerUp = entries.find(e => e.avatar_id === runnerUpId);
    if (runnerUp) runnerUp.final_placement = 2;

    // Third place from semifinal losers
    const semiFinal = bracket[bracket.length - 2];
    const thirdPlace = entries.find(e => e.final_placement === 4);
    if (thirdPlace) thirdPlace.final_placement = 3;

    return {
        champion,
        runnerUp,
        thirdPlace,
        bracket
    };
}

function getRoundName(size) {
    const names = {
        2: 'Final',
        4: 'Semifinals',
        8: 'Quarterfinals',
        16: 'Round of 16',
        32: 'Round of 32',
        64: 'Round of 64'
    };
    return names[size] || `Round of ${size}`;
}
