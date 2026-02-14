import { monitorGames } from '../services/agentGameplayService.js';
import { monitorAgentTurns } from '../services/agentTurnService.js';
import { autoJoinGame } from '../services/agentGameplayService.js';
import db from '../config/database.js';

// Game monitoring interval (30 seconds)
const MONITOR_INTERVAL = 30000;

// Turn monitoring interval (10 seconds - more frequent)
const TURN_MONITOR_INTERVAL = 10000;

let monitoringInterval = null;
let turnMonitoringInterval = null;

/**
 * Monitor agent turns for all active agents
 */
async function monitorAllAgentTurns() {
    try {
        // Get all agents with auto_play enabled
        const activeAgents = await db('agent_config')
            .where({ auto_play_enabled: true })
            .select('agent_id');

        for (const { agent_id } of activeAgents) {
            await monitorAgentTurns(agent_id);
        }
    } catch (error) {
        console.error('Error monitoring agent turns:', error.message);
    }
}

/**
 * Auto-join games for all eligible agents
 */
async function autoJoinForAllAgents() {
    try {
        // Get all agents with auto_join enabled
        const agents = await db('agent_config')
            .where({ auto_join_games: true, auto_play_enabled: true })
            .select('agent_id');

        for (const { agent_id } of agents) {
            await autoJoinGame(agent_id);
        }
    } catch (error) {
        console.error('Error auto-joining games:', error.message);
    }
}

/**
 * Start the game monitoring background worker
 */
export function startGameMonitor() {
    if (monitoringInterval) {
        console.log('⚠️  Game monitor already running');
        return;
    }

    console.log('🎮 Starting game monitor...');

    // Run game monitoring immediately
    monitorGames().catch(err => {
        console.error('Error in initial game monitor:', err);
    });

    // Run auto-join immediately
    autoJoinForAllAgents().catch(err => {
        console.error('Error in initial auto-join:', err);
    });

    // Game state monitoring (every 30 seconds)
    monitoringInterval = setInterval(async () => {
        try {
            await monitorGames();
            await autoJoinForAllAgents();
        } catch (error) {
            console.error('Error in game monitor:', error);
        }
    }, MONITOR_INTERVAL);

    // Turn monitoring (every 10 seconds - more frequent)
    turnMonitoringInterval = setInterval(async () => {
        try {
            await monitorAllAgentTurns();
        } catch (error) {
            console.error('Error in turn monitor:', error);
        }
    }, TURN_MONITOR_INTERVAL);

    console.log(`✅ Game monitor started (games: ${MONITOR_INTERVAL / 1000}s, turns: ${TURN_MONITOR_INTERVAL / 1000}s)`);
}

/**
 * Stop the game monitoring background worker
 */
export function stopGameMonitor() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    if (turnMonitoringInterval) {
        clearInterval(turnMonitoringInterval);
        turnMonitoringInterval = null;
    }
    console.log('🛑 Game monitor stopped');
}

// Auto-start on module load
startGameMonitor();

// Graceful shutdown
process.on('SIGINT', () => {
    stopGameMonitor();
    process.exit(0);
});

process.on('SIGTERM', () => {
    stopGameMonitor();
    process.exit(0);
});

