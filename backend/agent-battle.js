/**
 * Setup and run a live agent battle
 * Fund 2 agents with 4 MON each and watch them compete
 */

const BASE_URL = 'http://localhost:3002';

async function setupAgentBattle() {
    console.log('🤖 Setting Up Agent Battle\\n');
    console.log('═══════════════════════════════════════\\n');

    // Step 1: Create 2 agents with wallets
    console.log('1️⃣  Creating Agent 1: "BattleBot Alpha"...');
    const agent1Res = await fetch(`${BASE_URL}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'BattleBot Alpha',
            personality: 'Aggressive and competitive',
            createWallet: true,
        }),
    });
    const agent1Data = await agent1Res.json();
    const agent1 = agent1Data.data;
    console.log(`   ✅ Created! ID: ${agent1.id}, Wallet: ${agent1.wallet_address}\\n`);

    console.log('2️⃣  Creating Agent 2: "BattleBot Beta"...');
    const agent2Res = await fetch(`${BASE_URL}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'BattleBot Beta',
            personality: 'Strategic and calculated',
            createWallet: true,
        }),
    });
    const agent2Data = await agent2Res.json();
    const agent2 = agent2Data.data;
    console.log(`   ✅ Created! ID: ${agent2.id}, Wallet: ${agent2.wallet_address}\\n`);

    // Step 2: Fund both agents
    console.log('3️⃣  Funding agents with 4 MON each...');
    console.log('   Source wallet: 0x85287B91121906771d4D9391A696a20aB0940C90\\n');

    console.log('   📝 Run these commands to fund the agents:\\n');
    console.log('   # Fund Agent 1 (BattleBot Alpha)');
    console.log(`   cast send ${agent1.wallet_address} \\\\`);
    console.log('     --value 4ether \\\\');
    console.log('     --rpc-url https://testnet-rpc.monad.xyz \\\\');
    console.log('     --private-key 0x9a6f8a97f897736e0c80942c54336165bb94df23975e9848f34da0eeccf324b8\\n');

    console.log('   # Fund Agent 2 (BattleBot Beta)');
    console.log(`   cast send ${agent2.wallet_address} \\\\`);
    console.log('     --value 4ether \\\\');
    console.log('     --rpc-url https://testnet-rpc.monad.xyz \\\\');
    console.log('     --private-key 0x9a6f8a97f897736e0c80942c54336165bb94df23975e9848f34da0eeccf324b8\\n');

    console.log('   ⏳ Waiting for you to fund the wallets...');
    console.log('   Press Enter when done...');

    // Wait for user input
    await new Promise(resolve => {
        process.stdin.once('data', resolve);
    });

    console.log('\\n4️⃣  Registering agents on-chain...');

    // Register Agent 1
    console.log('   Registering BattleBot Alpha...');
    const reg1Res = await fetch(`${BASE_URL}/api/agents/${agent1.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'AlphaBot' }),
    });
    const reg1Data = await reg1Res.json();
    console.log(`   ✅ Registered! TX: ${reg1Data.data?.txHash || 'N/A'}\\n`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Register Agent 2
    console.log('   Registering BattleBot Beta...');
    const reg2Res = await fetch(`${BASE_URL}/api/agents/${agent2.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'BetaBot' }),
    });
    const reg2Data = await reg2Res.json();
    console.log(`   ✅ Registered! TX: ${reg2Data.data?.txHash || 'N/A'}\\n`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Create game with Agent 1
    console.log('5️⃣  Creating battle arena (AI game)...');
    const gameRes = await fetch(`${BASE_URL}/api/agents/${agent1.id}/create-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'AlphaBot',
            gameType: 'PUBLIC',
            playerSymbol: 'car',
            numberOfPlayers: 2, // Just 2 agents
            code: '',
            startingBalance: '1500',
            stakeAmount: '0',
            isAIGame: true,
        }),
    });
    const gameData = await gameRes.json();

    if (!gameData.success) {
        console.error('   ❌ Failed to create game:', gameData.message);
        return;
    }

    console.log(`   ✅ Game created! TX: ${gameData.data.txHash}\\n`);

    // Step 4: Monitor the battle
    console.log('6️⃣  🎮 BATTLE STARTED! 🎮\\n');
    console.log('═══════════════════════════════════════\\n');
    console.log('   Monitoring game progress...\\n');

    let gameComplete = false;
    let checkCount = 0;

    while (!gameComplete && checkCount < 60) { // Max 10 minutes
        checkCount++;
        await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds

        // Get both agents' stats
        const stats1Res = await fetch(`${BASE_URL}/api/gameplay/agents/${agent1.id}/active-games`);
        const stats1 = await stats1Res.json();

        const stats2Res = await fetch(`${BASE_URL}/api/gameplay/agents/${agent2.id}/active-games`);
        const stats2 = await stats2Res.json();

        console.log(`[Check ${checkCount}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        if (stats1.data.length > 0) {
            const game1 = stats1.data[0];
            console.log(`   🤖 AlphaBot: Balance: ${game1.balance || 'N/A'}, Position: ${game1.position || 0}, Status: ${game1.status}`);
        } else {
            console.log(`   🤖 AlphaBot: No active games`);
        }

        if (stats2.data.length > 0) {
            const game2 = stats2.data[0];
            console.log(`   🤖 BetaBot:  Balance: ${game2.balance || 'N/A'}, Position: ${game2.position || 0}, Status: ${game2.status}`);
        } else {
            console.log(`   🤖 BetaBot:  No active games`);
        }

        // Check if game completed
        const completed1Res = await fetch(`${BASE_URL}/api/gameplay/agents/${agent1.id}/stats`);
        const completed1 = await completed1Res.json();

        const completed2Res = await fetch(`${BASE_URL}/api/gameplay/agents/${agent2.id}/stats`);
        const completed2 = await completed2Res.json();

        if (completed1.data.completedGames > 0 || completed2.data.completedGames > 0) {
            gameComplete = true;
            console.log('\\n🏁 GAME COMPLETE! 🏁\\n');
            console.log('═══════════════════════════════════════\\n');

            // Get final results
            console.log('📊 FINAL RESULTS:\\n');

            console.log('🤖 BattleBot Alpha (AlphaBot):');
            console.log(`   Total Games: ${completed1.data.totalGames}`);
            console.log(`   Wins: ${completed1.data.wins}`);
            console.log(`   Win Rate: ${completed1.data.winRate}%`);
            console.log(`   Total Winnings: ${completed1.data.totalWinnings}\\n`);

            console.log('🤖 BattleBot Beta (BetaBot):');
            console.log(`   Total Games: ${completed2.data.totalGames}`);
            console.log(`   Wins: ${completed2.data.wins}`);
            console.log(`   Win Rate: ${completed2.data.winRate}%`);
            console.log(`   Total Winnings: ${completed2.data.totalWinnings}\\n`);

            // Determine winner
            if (completed1.data.wins > completed2.data.wins) {
                console.log('🏆 WINNER: BattleBot Alpha! 🏆');
            } else if (completed2.data.wins > completed1.data.wins) {
                console.log('🏆 WINNER: BattleBot Beta! 🏆');
            } else {
                console.log('🤝 TIE GAME! 🤝');
            }

            // Get decision logs
            const dec1Res = await fetch(`${BASE_URL}/api/gameplay/agents/${agent1.id}/decisions?limit=1`);
            const dec1 = await dec1Res.json();

            if (dec1.data.length > 0) {
                const decision = dec1.data[0];
                const data = JSON.parse(decision.decision_data);
                console.log('\\n📝 AlphaBot Final Stats:');
                console.log(`   Rank: ${data.rank}`);
                console.log(`   Final Balance: ${data.finalBalance}`);
            }

            const dec2Res = await fetch(`${BASE_URL}/api/gameplay/agents/${agent2.id}/decisions?limit=1`);
            const dec2 = await dec2Res.json();

            if (dec2.data.length > 0) {
                const decision = dec2.data[0];
                const data = JSON.parse(decision.decision_data);
                console.log('\\n📝 BetaBot Final Stats:');
                console.log(`   Rank: ${data.rank}`);
                console.log(`   Final Balance: ${data.finalBalance}`);
            }
        }

        console.log('');
    }

    if (!gameComplete) {
        console.log('⏰ Timeout - game still running after 10 minutes');
    }
}

setupAgentBattle().catch(console.error);
