/**
 * Create fresh agent and run battle
 */

const BASE_URL = 'http://localhost:3002';

async function setupAndBattle() {
    console.log('🤖 CREATING FRESH AGENT FOR BATTLE\\n');
    console.log('═══════════════════════════════════════\\n');

    // Create new agent with wallet
    console.log('1️⃣  Creating new agent...');
    const createRes = await fetch(`${BASE_URL}/api/agents/create-with-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Champion',
            personality: 'Competitive and strategic',
        }),
    });

    const createData = await createRes.json();

    if (!createData.success) {
        console.error('❌ Failed to create agent:', createData.message);
        return;
    }

    const agent = createData.data;
    console.log(`   ✅ Agent created!`);
    console.log(`   ID: ${agent.id}`);
    console.log(`   Name: ${agent.name}`);
    console.log(`   Wallet: ${agent.wallet_address}\\n`);

    console.log('2️⃣  Funding agent wallet with 1 MON...');
    console.log(`   📝 Run this command:\\n`);
    console.log(`   cast send ${agent.wallet_address} --value 1ether --rpc-url https://testnet-rpc.monad.xyz --private-key 0x9a6f8a97f897736e0c80942c54336165bb94df23975e9848f34da0eeccf324b8\\n`);
    console.log('   Press Enter when funded...');

    await new Promise(resolve => {
        process.stdin.once('data', resolve);
    });

    console.log('\\n3️⃣  Registering agent on-chain...');
    const regRes = await fetch(`${BASE_URL}/api/agents/${agent.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Champion' }),
    });

    const regData = await regRes.json();
    if (regData.success) {
        console.log(`   ✅ Registered! TX: ${regData.data.txHash}\\n`);
        await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
        console.log(`   ⚠️  ${regData.message}\\n`);
    }

    // Create game
    console.log('4️⃣  Creating AI battle (4 players)...');
    const gameRes = await fetch(`${BASE_URL}/api/agents/${agent.id}/create-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'Champion',
            gameType: 'PUBLIC',
            playerSymbol: 'car',
            numberOfPlayers: 4,
            code: '',
            startingBalance: '1500',
            stakeAmount: '0',
            isAIGame: true,
        }),
    });

    const gameData = await gameRes.json();

    if (!gameData.success) {
        console.error('   ❌ Failed:', gameData.message);
        return;
    }

    console.log(`   ✅ Game created! TX: ${gameData.data.txHash}\\n`);
    console.log('═══════════════════════════════════════');
    console.log('🎮 BATTLE IN PROGRESS!');
    console.log('═══════════════════════════════════════\\n');

    // Monitor
    let complete = false;
    let checkNum = 0;

    while (!complete && checkNum < 60) {
        checkNum++;
        await new Promise(resolve => setTimeout(resolve, 10000));

        const gamesRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/active-games`);
        const games = await gamesRes.json();

        const statsRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/stats`);
        const stats = await statsRes.json();

        console.log(`[${checkNum}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        if (games.data.length > 0) {
            const game = games.data[0];
            console.log(`   🎮 Status: ${game.status.toUpperCase()}`);
            console.log(`   💰 Balance: ${game.balance || 'Loading...'}`);
            console.log(`   📍 Position: ${game.position || 0}`);
        }

        console.log(`   📊 Completed: ${stats.data.completedGames}`);

        if (stats.data.completedGames > 0) {
            complete = true;
            console.log('\\n🏁 GAME COMPLETE! 🏁\\n');
            console.log('═══════════════════════════════════════\\n');
            console.log('📊 FINAL RESULTS:\\n');
            console.log(`   Total Games: ${stats.data.totalGames}`);
            console.log(`   Wins: ${stats.data.wins}`);
            console.log(`   Win Rate: ${stats.data.winRate}%`);
            console.log(`   Winnings: ${stats.data.totalWinnings}\\n`);

            const decRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/decisions?limit=1`);
            const dec = await decRes.json();

            if (dec.data.length > 0) {
                const decision = dec.data[0];
                const data = JSON.parse(decision.decision_data);

                console.log('🏆 BATTLE RESULTS:');
                console.log(`   Rank: ${data.rank}${data.rank === 1 ? 'st' : data.rank === 2 ? 'nd' : data.rank === 3 ? 'rd' : 'th'}`);
                console.log(`   Final Balance: ${data.finalBalance}`);
                console.log(`   Winnings: ${data.winnings}\\n`);

                if (data.rank === 1) {
                    console.log('🎉🎉🎉 VICTORY! Champion wins! 🎉🎉🎉');
                } else {
                    console.log(`📊 Finished in ${data.rank}${data.rank === 2 ? 'nd' : data.rank === 3 ? 'rd' : 'th'} place`);
                }
            }
        }

        console.log('');
    }

    if (!complete) {
        console.log('⏰ Still running. Check: curl http://localhost:3002/api/gameplay/agents/' + agent.id + '/stats');
    }
}

setupAndBattle().catch(console.error);
