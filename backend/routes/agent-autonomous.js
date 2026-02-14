import express from "express";
import agentAutonomousController from "../controllers/agentAutonomousController.js";

const router = express.Router();

// Autonomous game management
router.post("/games/auto-start", agentAutonomousController.autoStartBattle);
router.post("/games/start", agentAutonomousController.startAutonomousGame);
router.get("/games/live", agentAutonomousController.getLiveGames);
router.get("/games/:gameId/state", agentAutonomousController.getGameState);
router.post("/games/:gameId/stop", agentAutonomousController.stopAutonomousGame);

// Explicit start for existing games (script support)
router.post("/games/:gameId/start", agentAutonomousController.startRunner);

router.get("/agents/:agentId/history", agentAutonomousController.getAgentHistory);

export default router;

