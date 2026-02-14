import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = `http://localhost:${process.env.PORT || 3002}/api`;
const OWNER_ADDRESS = process.env.TREASURY_ADDRESS;

async function quickStartGame() {
    console.log('\n🎮 Quick Start: Creating Agents & Starting Game\n');
    console.log('='.repeat(60));

    try {
        // Step 1: Create 3 new agents quickly (no on-chain registration for speed)
        console.log('\n📋 Creating 3 agents (legacy mode for speed)...');

        const agentNames = ['QuickBot1', 'QuickBot2', 'QuickBot3'];
        const agentIds = [];

        for (const name of agentNames) {
            const response = await fetch(`${API_BASE}/agents/create-legacy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    ownerAddress: OWNER_ADDRESS,
                    strategy: ['aggressive', 'balanced', 'conservative'][agentIds.length]
                })
            });

            const data = await response.json();
            if (data.success) {
                agentIds.push(data.data.id);
                console.log(`   ✅ ${name} (ID: ${data.data.id})`);
            }
        }

        // Step 2: Start game
        console.log('\n📋 Starting autonomous game...');

        const gameResponse = await fetch(`${API_BASE}/agent-games/agent-only`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: `GAME_${Date.now()}`,
                mode: 'AI', // Use valid enum value
                numberOfPlayers: 3,
                agentIds,
                ownerAddress: OWNER_ADDRESS,
                settings: {
                    starting_cash: 1500,
                    auction: true,
                    rent_in_prison: false,
                    mortgage: true,
                    even_build: true,
                    randomize_play_order: true
                }
            })
        });

        const gameData = await gameResponse.json();

        if (!gameData.success) {
            throw new Error(`Game creation failed: ${gameData.message}`);
        }

        const gameId = gameData.data.id;
        console.log(`   ✅ Game created! ID: ${gameId}`);
        console.log(`   🤖 ${agentIds.length} agents playing automatically`);

        // Step 3: Watch for 20 seconds
        console.log('\n📋 Watching game (20 seconds)...\n');

        for (let i = 0; i < 4; i++) {
            await new Promise(r => setTimeout(r, 5000));

            const liveResponse = await fetch(`${API_BASE}/agent-autonomous/games/live`);
            const liveData = await liveResponse.json();

            if (liveData.success && liveData.data.length > 0) {
                const game = liveData.data.find(g => g.game_id === gameId);
                if (game) {
                    console.log(`   Turn ${game.current_turn || 0}:`);
                    if (game.agents_playing) {
                        game.agents_playing.forEach(a => {
                            console.log(`      ${a.name}: $${a.balance}`);
                        });
                    }
                    console.log('');
                }
            }
        }

        console.log('='.repeat(60));
        console.log('🎉 AGENTS ARE PLAYING!\n');
        console.log(`Game ID: ${gameId}`);
        console.log(`Live games: http://localhost:${process.env.PORT || 3002}/api/agent-autonomous/games/live\n`);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

quickStartGame();
