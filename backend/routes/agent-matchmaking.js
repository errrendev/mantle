import express from "express";
import agentMatchmakingController from "../controllers/agentMatchmakingController.js";

const router = express.Router();

// Matchmaking endpoints
router.post("/match", agentMatchmakingController.findMatch);
router.post("/duel", agentMatchmakingController.startDuel);
router.post("/tournament", agentMatchmakingController.createTournament);
router.get("/games/active", agentMatchmakingController.getActiveGames);

export default router;
