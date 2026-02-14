import http from 'http';
import { Server } from 'socket.io';
import db from './config/database.js';
import Agent from './models/Agent.js';
import Game from './models/Game.js';
import GameSetting from './models/GameSetting.js';
import GamePlayer from './models/GamePlayer.js';
import User from './models/User.js';
import AgentGameParticipation from './models/AgentGameParticipation.js';
import agentGameRunner, { setSocketIO } from './services/agentGameRunner.js';

/**
 * Start an autonomous agent-vs-agent battle with Socket.IO support
 * This version creates a minimal HTTP server for socket.io to work
 */
async function startAgentBattleWithSocket() {
    try {
        console.log('🎮 Starting Agent Battle System with Socket.IO...\n');

        // Create minimal HTTP server for socket.io
        const server = http.createServer();
        const io = new Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        // Initialize socket.io for agent game runner
        setSocketIO(io);
        console.log('✅ Socket.IO initialized\n');

        // Start server on a random port (we don't need to access it)
        const PORT = 4001;
        server.listen(PORT, () => {
            console.log(`📡 Socket.IO server running on port ${PORT}\n`);
        });

        // Step 1: Get all available agents
        const allAgents = await Agent.findAll({ limit: 100 });

        if (allAgents.length < 2) {
            console.error('❌ Need at least 2 agents to start a battle!');
            console.log('💡 Create more agents using: node create-my-agent.js');
            process.exit(1);
        }

        console.log(`✅ Found ${allAgents.length} agents in database:\n`);
        allAgents.forEach((agent, i) => {
            console.log(`   ${i + 1}. ${agent.name} (${agent.strategy}) - Wallet: ${agent.wallet_address || agent.address}`);
        });

        // Step 2: Select agents for battle
        const numberOfAgents = Math.min(4, allAgents.length);
        const selectedAgents = allAgents.slice(0, numberOfAgents);

        console.log(`\n🎯 Selected ${numberOfAgents} agents for battle:`);
        selectedAgents.forEach((agent, i) => {
            console.log(`   ${i + 1}. ${agent.name} (${agent.strategy})`);
        });

        // Step 3: Create game code
        const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        console.log(`\n🎲 Game Code: ${gameCode}`);

        // Step 4: Create game in database
        const creatorAgent = selectedAgents[0];

        let creatorUser = await User.findByAddress(creatorAgent.wallet_address || creatorAgent.address, 'MONAD_TESTNET');
        if (!creatorUser) {
            creatorUser = await User.findByAddress(creatorAgent.wallet_address || creatorAgent.address, 'AI_NET');
        }
        if (!creatorUser) {
            creatorUser = await User.create({
                username: creatorAgent.name,
                address: creatorAgent.wallet_address || creatorAgent.address,
                chain: 'MONAD_TESTNET'
            });
        }

        const game = await Game.create({
            code: gameCode,
            mode: 'AI',
            creator_id: creatorUser.id,
            next_player_id: null,
            number_of_players: selectedAgents.length,
            status: 'PENDING',
            is_agent_only: true
        });

        console.log(`✅ Game created with ID: ${game.id}`);

        // Step 5: Create game settings
        await GameSetting.create({
            game_id: game.id,
            auction: true,
            rent_in_prison: false,
            mortgage: true,
            even_build: true,
            randomize_play_order: true,
            starting_cash: 1500
        });

        console.log('✅ Game settings configured');

        // Step 6: Add all agents as players
        const gamePlayers = [];
        for (let i = 0; i < selectedAgents.length; i++) {
            const agent = selectedAgents[i];
            const agentAddress = agent.wallet_address || agent.address;

            let aiUser = await User.findByAddress(agentAddress, 'MONAD_TESTNET');
            if (!aiUser) {
                aiUser = await User.findByAddress(agentAddress, 'AI_NET');
            }
            if (!aiUser) {
                aiUser = await User.create({
                    username: agent.name,
                    address: agentAddress,
                    chain: 'MONAD_TESTNET'
                });
            }

            const player = await GamePlayer.create({
                game_id: game.id,
                user_id: aiUser.id,
                address: aiUser.address,
                balance: 1500,
                position: 0,
                turn_order: i + 1,
                symbol: (i + 1).toString(),
                chance_jail_card: false,
                community_chest_jail_card: false,
                is_ai: true,
                agent_id: agent.id
            });

            try {
                await AgentGameParticipation.create({
                    agent_id: agent.id,
                    game_id: game.id,
                    user_id: aiUser.id
                });
            } catch (participationError) {
                if (!participationError.message.includes('Duplicate entry')) {
                    throw participationError;
                }
            }

            gamePlayers.push(player);
            console.log(`✅ Added ${agent.name} to game (Turn Order: ${i + 1})`);
        }

        // Step 7: Start the game
        await Game.update(game.id, {
            status: 'RUNNING',
            next_player_id: gamePlayers[0].user_id
        });

        console.log('\n🔥 Game status set to RUNNING');

        // Step 8: Start autonomous gameplay
        try {
            await agentGameRunner.startAgentGame(game.id);
            console.log('✅ Autonomous gameplay started with Socket.IO support!');
        } catch (runnerError) {
            console.error('❌ Failed to start autonomous gameplay:', runnerError);
        }

        // Step 9: Display preview URL
        console.log('\n' + '='.repeat(60));
        console.log('🎉 AGENT BATTLE STARTED SUCCESSFULLY!');
        console.log('='.repeat(60));
        console.log(`\n📺 Watch the battle live at:\n`);
        console.log(`   🌐 http://localhost:3000/ai-play?gameCode=${gameCode}\n`);
        console.log('='.repeat(60));
        console.log('\n💡 Tips:');
        console.log('   - Agents are playing autonomously with real-time updates');
        console.log('   - Game updates every 3 seconds');
        console.log('   - Check console for detailed AI decisions');
        console.log('   - Socket.IO enabled for live frontend updates\n');

        console.log('⏳ Battle in progress... (Press Ctrl+C to stop)\n');

    } catch (error) {
        console.error('❌ Error starting agent battle:', error);
        process.exit(1);
    }
}

// Run the battle
startAgentBattleWithSocket();
