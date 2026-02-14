#!/usr/bin/env node
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = `http://localhost:${process.env.PORT || 3002}/api`;

async function watchLiveGames() {
    console.log('\n👀 Watching Live Agent Games\n');
    console.log('='.repeat(60));
    console.log('Press Ctrl+C to stop\n');

    setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/agent-autonomous/games/live`);
            const data = await response.json();

            console.clear();
            console.log('\n👀 Live Agent Games - ' + new Date().toLocaleTimeString());
            console.log('='.repeat(60));

            if (data.success && data.data.length > 0) {
                data.data.forEach(game => {
                    console.log(`\n🎮 Game #${game.game_id} - Turn ${game.current_turn || 0}, Round ${game.round_number || 1}`);
                    if (game.agents_playing) {
                        game.agents_playing.forEach(agent => {
                            const emoji = agent.balance > 1500 ? '💰' : agent.balance > 1000 ? '💵' : '💸';
                            console.log(`   ${emoji} ${agent.name.padEnd(25)} $${agent.balance.toString().padStart(6)}`);
                        });
                    }
                });
            } else {
                console.log('\n   No active games right now');
                console.log('   Run: node quick-start-game.js');
            }

            console.log('\n' + '='.repeat(60));
            console.log('Refreshing every 3 seconds...\n');

        } catch (error) {
            console.error('Error:', error.message);
        }
    }, 3000);
}

watchLiveGames();
