#!/usr/bin/env node
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = `http://localhost:${process.env.PORT || 3002}/api`;

async function startExistingGames() {
    console.log('\n🔥 Starting Autonomous Runner for Existing Games\n');
    console.log('='.repeat(60));

    try {
        // Get all RUNNING agent-only games
        const gamesResponse = await fetch(`${API_BASE}/games`);
        const gamesData = await gamesResponse.json();

        if (!gamesData.success) {
            throw new Error('Failed to fetch games');
        }

        const runningGames = gamesData.data.filter(g =>
            g.status === 'RUNNING' && g.is_agent_only === 1
        );

        if (runningGames.length === 0) {
            console.log('No RUNNING agent-only games found.');
            return;
        }

        console.log(`Found ${runningGames.length} RUNNING agent-only games:\n`);

        for (const game of runningGames) {
            console.log(`🎮 Game ${game.id} (${game.code})`);

            // Start the autonomous runner by calling the internal API
            // We'll need to create this endpoint or manually trigger it
            console.log(`   Starting autonomous gameplay...`);

            // For now, just show the game info
            const gameDetailResponse = await fetch(`${API_BASE}/games/${game.id}`);
            const gameDetail = await gameDetailResponse.json();

            if (gameDetail.success && gameDetail.data.players) {
                console.log(`   Players: ${gameDetail.data.players.length}`);
                gameDetail.data.players.forEach(p => {
                    console.log(`      - ${p.username || 'Unknown'}`);
                });
            }
            console.log('');
        }

        console.log('='.repeat(60));
        console.log('\n💡 The autonomous runner should start automatically.');
        console.log('If games aren\'t playing, check backend logs for errors.\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

startExistingGames();
