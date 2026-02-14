import express from 'express';
import {
    getAgentActiveGames,
    getAgentConfig,
    updateAgentConfig,
    autoJoinGame,
    getGameState,
    getPlayerState,
} from '../services/agentGameplayService.js';
import db from '../config/database.js';

const router = express.Router();

/**
 * GET /api/gameplay/agents/:id/active-games
 * Get all active games for an agent
 */
router.get('/agents/:id/active-games', async (req, res) => {
    try {
        const { id } = req.params;
        const games = await getAgentActiveGames(parseInt(id));

        res.json({
            success: true,
            data: games,
        });
    } catch (error) {
        console.error('Error getting active games:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

/**
 * GET /api/gameplay/agents/:id/config
 * Get agent gameplay configuration
 */
router.get('/agents/:id/config', async (req, res) => {
    try {
        const { id } = req.params;
        const config = await getAgentConfig(parseInt(id));

        res.json({
            success: true,
            data: config,
        });
    } catch (error) {
        console.error('Error getting agent config:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

/**
 * PUT /api/gameplay/agents/:id/config
 * Update agent gameplay configuration
 */
router.put('/agents/:id/config', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        await updateAgentConfig(parseInt(id), updates);

        const updatedConfig = await getAgentConfig(parseInt(id));

        res.json({
            success: true,
            message: 'Configuration updated',
            data: updatedConfig,
        });
    } catch (error) {
        console.error('Error updating agent config:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

/**
 * POST /api/gameplay/agents/:id/auto-join
 * Automatically join or create a game
 */
router.post('/agents/:id/auto-join', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await autoJoinGame(parseInt(id));

        if (result.success) {
            res.json({
                success: true,
                message: 'Successfully joined/created game',
                data: result,
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message,
            });
        }
    } catch (error) {
        console.error('Error auto-joining game:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

/**
 * GET /api/gameplay/games/:gameId/state
 * Get game state from blockchain
 */
router.get('/games/:gameId/state', async (req, res) => {
    try {
        const { gameId } = req.params;
        const gameState = await getGameState(gameId);

        if (!gameState) {
            return res.status(404).json({
                success: false,
                message: 'Game not found',
            });
        }

        res.json({
            success: true,
            data: gameState,
        });
    } catch (error) {
        console.error('Error getting game state:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

/**
 * GET /api/gameplay/games/:gameId/player/:address
 * Get player state in a game
 */
router.get('/games/:gameId/player/:address', async (req, res) => {
    try {
        const { gameId, address } = req.params;
        const playerState = await getPlayerState(gameId, address);

        if (!playerState) {
            return res.status(404).json({
                success: false,
                message: 'Player not found in game',
            });
        }

        res.json({
            success: true,
            data: playerState,
        });
    } catch (error) {
        console.error('Error getting player state:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

/**
 * GET /api/gameplay/agents/:id/decisions
 * Get agent decision history
 */
router.get('/agents/:id/decisions', async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, gameId } = req.query;

        let query = db('agent_decisions')
            .where({ agent_id: parseInt(id) })
            .orderBy('created_at', 'desc')
            .limit(parseInt(limit));

        if (gameId) {
            query = query.where({ game_id: gameId });
        }

        const decisions = await query;

        res.json({
            success: true,
            data: decisions,
        });
    } catch (error) {
        console.error('Error getting decisions:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

/**
 * GET /api/gameplay/agents/:id/stats
 * Get agent gameplay statistics
 */
router.get('/agents/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;

        const stats = await db('agent_games')
            .where({ agent_id: parseInt(id) })
            .select(
                db.raw('COUNT(*) as total_games'),
                db.raw('SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed_games'),
                db.raw('SUM(CASE WHEN final_rank = 1 THEN 1 ELSE 0 END) as wins'),
                db.raw('SUM(winnings) as total_winnings'),
                db.raw('AVG(CASE WHEN status = "completed" THEN final_rank END) as avg_rank')
            )
            .first();

        res.json({
            success: true,
            data: {
                totalGames: parseInt(stats.total_games) || 0,
                completedGames: parseInt(stats.completed_games) || 0,
                wins: parseInt(stats.wins) || 0,
                totalWinnings: parseFloat(stats.total_winnings) || 0,
                avgRank: parseFloat(stats.avg_rank) || 0,
                winRate: stats.completed_games > 0
                    ? ((stats.wins / stats.completed_games) * 100).toFixed(2)
                    : 0,
            },
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

export default router;
