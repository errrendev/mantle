import express from "express";
import agentController from "../controllers/agentController.js";
import agentRewardController from "../controllers/agentRewardController.js";
import * as agentTransactionService from '../services/agentTransactionService.js';

const router = express.Router();

// Agent routes
router.get("/", agentController.getAll);
router.post("/", agentController.create);
router.post("/create-with-ai", agentController.createWithAIModel);
router.get("/owner/:ownerAddress", agentController.getByOwner);
router.get("/leaderboard", agentController.getLeaderboard);
router.get("/top-performers", agentController.getTopPerformers);
router.post("/update-win-rates", agentController.updateWinRates);
router.get("/:id", agentController.getById);
router.put("/:id", agentController.update);
router.put("/:id/stats", agentController.updateStats);
router.delete("/:id", agentController.delete);

// Agent reward routes
router.post("/rewards", agentRewardController.createReward);
router.get("/rewards/agent/:agentId", agentRewardController.getRewardsByAgent);
router.get("/rewards/owner/:ownerAddress", agentRewardController.getRewardsByOwner);
router.get("/rewards/status/:status", agentRewardController.getRewardsByStatus);
router.get("/rewards/claimable/:ownerAddress", agentRewardController.getClaimableRewards);
router.post("/rewards/claim", agentRewardController.claimRewards);

// Agent transaction routes (Phase 2: Transaction Capabilities)

// Approve token spending
router.post("/:id/approve-token", async (req, res) => {
    try {
        const { id } = req.params;
        const { tokenType, amount } = req.body;

        if (!tokenType || !amount) {
            return res.status(400).json({
                success: false,
                message: 'tokenType and amount are required',
            });
        }

        const result = await agentTransactionService.approveTokenForAgent(
            parseInt(id),
            tokenType,
            amount
        );

        res.json({
            success: true,
            message: 'Token approval successful',
            data: result,
        });
    } catch (error) {
        console.error('Error approving token:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

// Create game on-chain
router.post("/:id/create-game", async (req, res) => {
    try {
        const { id } = req.params;
        const gameParams = req.body;

        const result = await agentTransactionService.createGameForAgent(
            parseInt(id),
            gameParams
        );

        res.json({
            success: true,
            message: 'Game created successfully',
            data: result,
        });
    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

// Join game on-chain
router.post("/:id/join-game", async (req, res) => {
    try {
        const { id } = req.params;
        const joinParams = req.body;

        const result = await agentTransactionService.joinGameForAgent(
            parseInt(id),
            joinParams
        );

        res.json({
            success: true,
            message: 'Joined game successfully',
            data: result,
        });
    } catch (error) {
        console.error('Error joining game:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

// Get agent balances
router.get("/:id/balances", async (req, res) => {
    try {
        const { id } = req.params;

        const balances = await agentTransactionService.getAgentBalances(
            parseInt(id)
        );

        res.json({
            success: true,
            data: balances,
        });
    } catch (error) {
        console.error('Error getting balances:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

export default router;