import AgentGameRunner from './agentGameRunner.js';
import Agent from '../models/Agent.js';

/**
 * AgentGameScheduler - Automated game creation service
 * 
 * Monitors free agents and automatically creates games when enough agents are available.
 * Runs in the background and continuously creates games as agents become free.
 */
class AgentGameScheduler {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.config = {
            enabled: process.env.AGENT_SCHEDULER_ENABLED !== 'false', // Default: true
            checkInterval: parseInt(process.env.AGENT_SCHEDULER_INTERVAL) || 30000, // 30 seconds
            minAgents: parseInt(process.env.AGENT_SCHEDULER_MIN_AGENTS) || 4,
            maxAgents: parseInt(process.env.AGENT_SCHEDULER_MAX_AGENTS) || 6,
            startingCash: parseInt(process.env.AGENT_SCHEDULER_STARTING_CASH) || 1500,
            settings: {
                auction: process.env.AGENT_SCHEDULER_AUCTION !== 'false',
                rent_in_prison: process.env.AGENT_SCHEDULER_RENT_IN_PRISON !== 'false',
                mortgage: process.env.AGENT_SCHEDULER_MORTGAGE !== 'false',
                even_build: process.env.AGENT_SCHEDULER_EVEN_BUILD === 'true',
                randomize_play_order: process.env.AGENT_SCHEDULER_RANDOM_ORDER !== 'false',
            }
        };
    }

    /**
     * Start the scheduler
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️  [SCHEDULER] Already running');
            return;
        }

        if (!this.config.enabled) {
            console.log('ℹ️  [SCHEDULER] Disabled via configuration');
            return;
        }

        console.log('🚀 [SCHEDULER] Starting automated agent game scheduler...');
        console.log(`   Check interval: ${this.config.checkInterval / 1000}s`);
        console.log(`   Min agents: ${this.config.minAgents}`);
        console.log(`   Max agents: ${this.config.maxAgents}`);

        this.isRunning = true;

        // Run immediately on start
        this.checkAndCreateGame();

        // Then run on interval
        this.intervalId = setInterval(() => {
            this.checkAndCreateGame();
        }, this.config.checkInterval);
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (!this.isRunning) {
            console.log('⚠️  [SCHEDULER] Not running');
            return;
        }

        console.log('🛑 [SCHEDULER] Stopping scheduler...');

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.isRunning = false;
        console.log('✅ [SCHEDULER] Stopped');
    }

    /**
     * Check for free agents and create game if enough are available
     */
    async checkAndCreateGame() {
        try {
            console.log('\n🔍 [SCHEDULER] Checking for free agents...');

            // Get busy agent IDs from active games
            const busyAgentIds = AgentGameRunner.getBusyAgentIds();
            console.log(`   Busy agents: ${busyAgentIds.length}`);

            // Get all agents from database
            const allAgents = await Agent.findAll({ limit: 100 });
            console.log(`   Total agents: ${allAgents.length}`);

            // Filter out busy agents
            const freeAgents = allAgents.filter(agent => !busyAgentIds.includes(agent.id));
            console.log(`   Free agents: ${freeAgents.length}`);

            // Check if we have enough free agents
            if (freeAgents.length < this.config.minAgents) {
                console.log(`   ⏸️  Not enough free agents (need ${this.config.minAgents})`);
                return;
            }

            // Select agents for the game
            const gameAgentCount = Math.min(freeAgents.length, this.config.maxAgents);
            const selectedAgents = freeAgents
                .sort(() => 0.5 - Math.random()) // Shuffle
                .slice(0, gameAgentCount);

            console.log(`   ✅ Creating game with ${gameAgentCount} agents:`);
            selectedAgents.forEach(agent => {
                console.log(`      - ${agent.name} (${agent.strategy})`);
            });

            // Create the game using the auto-start endpoint
            await this.createAutonomousGame(selectedAgents);

        } catch (error) {
            console.error('❌ [SCHEDULER] Error in check cycle:', error.message);
        }
    }

    /**
     * Create an autonomous game with selected agents
     */
    async createAutonomousGame(agents) {
        try {
            const fetch = (await import('node-fetch')).default;
            const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002/api';

            console.log('   🎮 Creating autonomous game...');

            const response = await fetch(`${BACKEND_URL}/agent-autonomous/games/auto-start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentCount: agents.length,
                    settings: {
                        ...this.config.settings,
                        starting_cash: this.config.startingCash
                    }
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to create game');
            }

            console.log('   ✅ Game created successfully!');
            console.log(`   Game ID: ${data.data.game_id}`);
            console.log(`   Game Code: ${data.data.game_code}`);
            console.log(`   Spectate URL: ${data.data.spectate_url}`);
            console.log('   🤖 Agents are now playing autonomously!\n');

        } catch (error) {
            console.error('   ❌ Failed to create game:', error.message);
            throw error;
        }
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            running: this.isRunning,
            config: this.config,
            nextCheck: this.isRunning ? new Date(Date.now() + this.config.checkInterval) : null
        };
    }
}

// Export singleton instance
export default new AgentGameScheduler();
