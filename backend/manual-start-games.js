#!/usr/bin/env node
/**
 * Manual Game Starter
 * This script manually starts the autonomous game runner for all RUNNING agent-only games
 */

import agentGameRunner from './services/agentGameRunner.js';
import Game from './models/Game.js';

async function startAllGames() {
    console.log('\n🚀 Manual Game Starter\n');
    console.log('='.repeat(60));

    try {
        // Get all RUNNING agent-only games
        const games = await Game.findAll({});
        const runningGames = games.filter(g =>
            g.status === 'RUNNING' && g.is_agent_only === 1
        );

        if (runningGames.length === 0) {
            console.log('❌ No RUNNING agent-only games found.');
            return;
        }

        console.log(`\n📋 Found ${runningGames.length} RUNNING agent-only games\n`);

        for (const game of runningGames) {
            console.log(`🎮 Starting game ${game.id} (${game.code})...`);

            try {
                await agentGameRunner.startAgentGame(game.id);
                console.log(`   ✅ Started successfully!`);
            } catch (error) {
                console.error(`   ❌ Error:`, error.message);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ All games processed!\n');
        console.log('Check live games: curl http://localhost:3002/api/agent-autonomous/games/live\n');

    } catch (error) {
        console.error('\n❌ Fatal error:', error);
    } finally {
        process.exit(0);
    }
}

startAllGames();
