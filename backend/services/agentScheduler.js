import Agent from '../models/Agent.js';
import Game from '../models/Game.js';
import GamePlayer from '../models/GamePlayer.js';
import User from '../models/User.js';
import GameSetting from '../models/GameSetting.js';
import AgentGameParticipation from '../models/AgentGameParticipation.js';
import agentGameRunner from './agentGameRunner.js';
import db from '../config/database.js';

class AgentSchedulerService {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.MATCH_INTERVAL = 60 * 1000; // 1 minute
        this.AGENTS_PER_GAME = 4;
    }

    start() {
        if (this.isRunning) return;

        console.log('🔄 Agent Matchmaking Scheduler started...');

        // Check if matchmaking is enabled
        if (process.env.ENABLE_MATCHMAKING !== 'true') {
            console.log('⚠️ Matchmaking is disabled (ENABLE_MATCHMAKING != true). Skipping auto-start.');
            return;
        }

        this.isRunning = true;

        // Run immediately on start
        this.runMatchmakingCycle();

        // Then run interval
        this.intervalId = setInterval(() => {
            this.runMatchmakingCycle();
        }, this.MATCH_INTERVAL);
    }

    stop() {
        if (!this.isRunning) return;
        if (this.intervalId) clearInterval(this.intervalId);
        this.isRunning = false;
        console.log('🛑 Agent Matchmaking Scheduler stopped.');
    }

    async runMatchmakingCycle() {
        try {
            console.log('🔍 Checking for idle agents...');

            // 1. Get all active agents from DB
            const allAgents = await Agent.findAll({ limit: 1000 }); // Get plenty

            // 2. Get busy agent IDs from Runner
            const busyAgentIds = agentGameRunner.getBusyAgentIds();
            const busySet = new Set(busyAgentIds);

            // 3. Also check database for agents in RUNNING games
            const activeGamePlayers = await db('game_players')
                .join('games', 'game_players.game_id', 'games.id')
                .where('games.status', 'RUNNING')
                .where('games.is_agent_only', true)
                .whereNotNull('game_players.agent_id')
                .select('game_players.agent_id');

            activeGamePlayers.forEach(p => busySet.add(p.agent_id));

            // 4. Filter for idle agents (not in any active game)
            const idleAgents = allAgents.filter(a => !busySet.has(a.id));

            if (idleAgents.length < 2) {
                console.log(`ℹ️ Not enough idle agents to start a game (${idleAgents.length} available).`);
                return;
            }

            console.log(`✅ Found ${idleAgents.length} idle agents. Creating matches...`);

            // 4. Shuffle idle agents for randomness
            const shuffled = idleAgents.sort(() => 0.5 - Math.random());

            // 5. Create games in chunks
            let gamesCreated = 0;

            for (let i = 0; i < shuffled.length; i += this.AGENTS_PER_GAME) {
                const chunk = shuffled.slice(i, i + this.AGENTS_PER_GAME);

                // Need at least 2 players for a game
                if (chunk.length < 2) {
                    console.log(`⚠️ Remaining ${chunk.length} agents waiting for next cycle.`);
                    break;
                }

                const agentNames = chunk.map(a => a.name).join(', ');
                console.log(`🎲 Starting Game ${gamesCreated + 1} with agents: ${agentNames}`);

                await this.createAndStartGame(chunk);
                gamesCreated++;
            }

            if (gamesCreated > 0) {
                console.log(`🎉 Matchmaking cycle complete. Created ${gamesCreated} new games.`);
            } else {
                console.log('ℹ️ No games created this cycle (not enough idle agents).');
            }

        } catch (error) {
            console.error('❌ Error in matchmaking cycle:', error);
        }
    }

    async createAndStartGame(agents) {
        try {
            // Create Game Code
            const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();

            // Use first agent as creator
            const creatorAgent = agents[0];

            // Ensure creator user exists
            let creatorUser = await User.findByAddress(creatorAgent.address, 'AI_NET');
            if (!creatorUser) {
                creatorUser = await User.create({
                    username: creatorAgent.name,
                    address: creatorAgent.address,
                    chain: 'AI_NET'
                });
            }

            // Create game with PENDING status first
            const game = await Game.create({
                code: gameCode,
                mode: 'AI',
                creator_id: creatorUser.id,
                next_player_id: null,
                number_of_players: agents.length,
                status: 'PENDING',
                is_agent_only: true
            });

            if (!game) {
                throw new Error('Failed to create game record in DB');
            }

            // Create game settings (CRITICAL - this was missing!)
            await GameSetting.create({
                game_id: game.id,
                auction: true,
                rent_in_prison: false,
                mortgage: true,
                even_build: true,
                randomize_play_order: true,
                starting_cash: 1500
            });

            // Add Players
            const gamePlayers = [];
            for (let i = 0; i < agents.length; i++) {
                const agent = agents[i];

                // Get or create AI user for this agent (CRITICAL - use AI_NET chain!)
                let aiUser = await User.findByAddress(agent.address, 'AI_NET');
                if (!aiUser) {
                    aiUser = await User.create({
                        username: agent.name,
                        address: agent.address,
                        chain: 'AI_NET'
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

                // Create participation record (CRITICAL - this was missing!)
                await AgentGameParticipation.create({
                    agent_id: agent.id,
                    game_id: game.id,
                    user_id: aiUser.id
                });

                gamePlayers.push(player);
            }

            // Start the game (CRITICAL - set next_player_id!)
            if (gamePlayers.length >= 2) {
                await Game.update(game.id, {
                    status: 'RUNNING',
                    next_player_id: gamePlayers[0].user_id
                });

                // 🔥 START THE AUTONOMOUS GAME RUNNER
                try {
                    await agentGameRunner.startAgentGame(game.id);
                    console.log(`✅ Autonomous gameplay started for game ${game.id} (${gameCode})`);
                } catch (runnerError) {
                    console.error(`❌ Failed to start autonomous gameplay for game ${game.id}:`, runnerError);
                }
            }

        } catch (error) {
            console.error('Error creating automated game:', error);
        }
    }
}

export default new AgentSchedulerService();
