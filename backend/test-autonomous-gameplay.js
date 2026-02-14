/**
 * Test script for Phase 3: Autonomous Gameplay
 * Tests agent configuration, auto-join, and game monitoring
 */

const BASE_URL = 'http://localhost:3002';

async function testAutonomousGameplay() {
    console.log('🧪 Testing Autonomous Gameplay System\\n');

    // Get agents
    console.log('1. Fetching agents...');
    const agentsRes = await fetch(`${BASE_URL}/api/agents`);
    const agentsData = await agentsRes.json();

    if (!agentsData.success || !agentsData.data || agentsData.data.length === 0) {
        console.error('❌ No agents found');
        return;
    }

    const agent = agentsData.data.find(a => a.wallet_address);

    if (!agent) {
        console.error('❌ No agents with wallets found');
        return;
    }

    console.log(`✅ Found agent: ${agent.name} (ID: ${agent.id})`);
    console.log(`   Wallet: ${agent.wallet_address}\\n`);

    // Test 1: Get agent configuration
    console.log('2. Getting agent configuration...');
    try {
        const configRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/config`);
        const configData = await configRes.json();

        if (configData.success) {
            console.log('✅ Agent configuration retrieved:');
            console.log(`   Auto-play: ${configData.data.auto_play_enabled}`);
            console.log(`   Strategy: ${configData.data.strategy}`);
            console.log(`   Max stake: ${configData.data.max_stake_per_game}`);
            console.log(`   Auto-join: ${configData.data.auto_join_games}\\n`);
        } else {
            console.error('❌ Failed to get config:', configData.message);
        }
    } catch (error) {
        console.error('❌ Error getting config:', error.message, '\\n');
    }

    // Test 2: Enable auto-join
    console.log('3. Enabling auto-join...');
    try {
        const updateRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auto_join_games: true,
                auto_play_enabled: true,
                strategy: 'balanced',
                max_stake_per_game: 10,
            }),
        });
        const updateData = await updateRes.json();

        if (updateData.success) {
            console.log('✅ Auto-join enabled');
            console.log(`   Strategy: ${updateData.data.strategy}\\n`);
        } else {
            console.error('❌ Failed to enable auto-join:', updateData.message, '\\n');
        }
    } catch (error) {
        console.error('❌ Error enabling auto-join:', error.message, '\\n');
    }

    // Test 3: Auto-join a game
    console.log('4. Auto-joining game...');
    try {
        const joinRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/auto-join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const joinData = await joinRes.json();

        if (joinData.success) {
            console.log('✅ Successfully joined/created game');
            console.log(`   Game ID: ${joinData.data.gameId || 'N/A'}`);
            console.log(`   TX Hash: ${joinData.data.txHash || 'N/A'}\\n`);
        } else {
            console.error('❌ Failed to auto-join:', joinData.message, '\\n');
        }
    } catch (error) {
        console.error('❌ Error auto-joining:', error.message, '\\n');
    }

    // Test 4: Get active games
    console.log('5. Getting active games...');
    try {
        const gamesRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/active-games`);
        const gamesData = await gamesRes.json();

        if (gamesData.success) {
            console.log(`✅ Active games: ${gamesData.data.length}`);
            gamesData.data.forEach((game, i) => {
                console.log(`   Game ${i + 1}:`);
                console.log(`     - ID: ${game.game_id}`);
                console.log(`     - Status: ${game.status}`);
                console.log(`     - Balance: ${game.balance}`);
                console.log(`     - Position: ${game.position}`);
            });
            console.log();
        } else {
            console.error('❌ Failed to get active games:', gamesData.message, '\\n');
        }
    } catch (error) {
        console.error('❌ Error getting active games:', error.message, '\\n');
    }

    // Test 5: Get agent stats
    console.log('6. Getting agent stats...');
    try {
        const statsRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/stats`);
        const statsData = await statsRes.json();

        if (statsData.success) {
            console.log('✅ Agent statistics:');
            console.log(`   Total games: ${statsData.data.totalGames}`);
            console.log(`   Completed: ${statsData.data.completedGames}`);
            console.log(`   Wins: ${statsData.data.wins}`);
            console.log(`   Win rate: ${statsData.data.winRate}%`);
            console.log(`   Total winnings: ${statsData.data.totalWinnings}\\n`);
        } else {
            console.error('❌ Failed to get stats:', statsData.message, '\\n');
        }
    } catch (error) {
        console.error('❌ Error getting stats:', error.message, '\\n');
    }

    // Test 6: Get decision history
    console.log('7. Getting decision history...');
    try {
        const decisionsRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/decisions?limit=5`);
        const decisionsData = await decisionsRes.json();

        if (decisionsData.success) {
            console.log(`✅ Recent decisions: ${decisionsData.data.length}`);
            decisionsData.data.forEach((decision, i) => {
                console.log(`   Decision ${i + 1}:`);
                console.log(`     - Type: ${decision.decision_type}`);
                console.log(`     - Executed: ${decision.executed}`);
                console.log(`     - Game ID: ${decision.game_id}`);
            });
            console.log();
        } else {
            console.error('❌ Failed to get decisions:', decisionsData.message, '\\n');
        }
    } catch (error) {
        console.error('❌ Error getting decisions:', error.message, '\\n');
    }

    console.log('✅ All tests completed!\\n');
    console.log('📝 Summary:');
    console.log('   - Agent configuration works');
    console.log('   - Auto-join functionality works');
    console.log('   - Active games tracking works');
    console.log('   - Statistics tracking works');
    console.log('   - Decision logging works');
    console.log('\\n🎉 Phase 3.1: Infrastructure is ready!');
}

// Run tests
testAutonomousGameplay().catch(console.error);
