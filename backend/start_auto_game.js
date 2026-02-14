
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BACKEND_URL = 'http://localhost:3002/api';

// Configuration: Matching handlePlay exactly
const config = {
    address: "0x0000000000000000000000000000000000000000",
    username: "AutoSystem",
    aiCount: 4,
    spectateMode: true,
    symbol: "spectator",
    aiDifficulty: "Medium",
    startingCash: 1500,
    duration: 60,
    settings: {
        auction: true,
        rentInPrison: true,
        mortgage: true,
        evenBuild: false,
        randomizePlayOrder: true,
        startingCash: 1500
    }
};

// AI Addresses from frontend/components/settings/game-ai.tsx
const ai_address = [
    "0xA1FF1c93600c3487FABBdAF21B1A360630f8bac6",
    "0xB2EE17D003e63985f3648f6c1d213BE86B474B11",
    "0xC3FF882E779aCbc112165fa1E7fFC093e9353B21",
    "0xD4FFDE5296C3EE6992bAf871418CC3BE84C99C32",
    "0xE5FF75Fcf243C4cE05B9F3dc5Aeb9F901AA361D1",
    "0xF6FF469692a259eD5920C15A78640571ee845E8",
    "0xA7FFE1f969Fa6029Ff2246e79B6A623A665cE69",
    "0xB8FF2cEaCBb67DbB5bc14D570E7BbF339cE240F6",
];

const GamePieces = [
    { id: "car" }, { id: "dog" }, { id: "hat" }, { id: "thimble" }, { id: "boot" }, { id: "battleship" }
];

async function handlePlay() {
    console.log(`🤖 Summoning ${config.aiCount} AI opponents...`);

    // Generate game code (Matching frontend: 6 chars alphanumeric)
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let gameCode = "";
    for (let i = 0; i < 6; i++) {
        gameCode += chars[Math.floor(Math.random() * chars.length)];
    }

    let dbGameId;

    try {
        // ----------------------------------------------------------------
        // 1. Create Game
        // ----------------------------------------------------------------
        console.log(`Creating game on server (Code: ${gameCode})...`);

        // Spectate Mode: User is NOT a player, just watching AIs
        // If NOT spectator: User + AIs
        const totalPlayers = config.spectateMode ? config.aiCount : config.aiCount + 1;

        const createPayload = {
            code: gameCode,
            mode: "PRIVATE",
            address: config.address,
            symbol: config.symbol,
            number_of_players: totalPlayers,
            ai_opponents: config.aiCount,
            ai_difficulty: config.aiDifficulty,
            starting_cash: config.startingCash,
            is_ai: true,
            is_spectator: config.spectateMode,
            is_minipay: false,
            chain: "Monad Testnet",
            duration: config.duration,
            username: config.username,
            settings: {
                auction: config.settings.auction,
                rent_in_prison: config.settings.rentInPrison,
                mortgage: config.settings.mortgage,
                even_build: config.settings.evenBuild,
                randomize_play_order: config.settings.randomizePlayOrder,
                starting_cash: config.settings.startingCash,
            },
            is_agent_only: true,
        };

        const createRes = await fetch(`${BACKEND_URL}/games`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(createPayload)
        });

        const createData = await createRes.json();

        // Handle different response structures mirroring frontend
        dbGameId = typeof createData === "string" || typeof createData === "number"
            ? createData
            : createData?.data?.data?.id ?? createData?.data?.id ?? createData?.id;

        if (!dbGameId) {
            console.error("DEBUG: createData:", JSON.stringify(createData, null, 2));
            throw new Error("Backend did not return game ID");
        }

        console.log(`✅ Game created! ID: ${dbGameId}, Code: ${gameCode}`);

        // ----------------------------------------------------------------
        // 2. Add AI Players
        // ----------------------------------------------------------------
        console.log("Adding AI opponents...");

        let availablePieces = GamePieces.filter((p) => p.id !== config.symbol);

        for (let i = 0; i < config.aiCount; i++) {
            if (availablePieces.length === 0) availablePieces = [...GamePieces];
            const randomIndex = Math.floor(Math.random() * availablePieces.length);
            const aiSymbol = availablePieces[randomIndex].id;
            availablePieces.splice(randomIndex, 1);

            const aiAddress = ai_address[i];

            try {
                console.log(`Adding AI player ${i + 1}: ${aiAddress} (${aiSymbol})`);
                await fetch(`${BACKEND_URL}/game-players/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        address: aiAddress,
                        symbol: aiSymbol,
                        code: gameCode,
                    })
                });
                // Frontend catches errors and warns, we do same (implicit silence in catch)
            } catch (joinErr) {
                console.warn(`AI player ${i + 1} failed to join:`, joinErr);
            }
        }

        // ----------------------------------------------------------------
        // 3. Start Game
        // ----------------------------------------------------------------
        try {
            await fetch(`${BACKEND_URL}/games/${dbGameId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: "RUNNING" })
            });
            console.log("✅ Game started!");
        } catch (statusErr) {
            console.warn("Failed to set game status to RUNNING:", statusErr);
        }

        // ----------------------------------------------------------------
        // 4. Trigger Server-Side Autonomous Runner
        // ----------------------------------------------------------------
        // CRITICAL: Without starting AgentGameRunner, the game will sit idle!
        try {
            console.log("🚀 Kickstarting server-side agent runner...");

            const runnerRes = await fetch(`${BACKEND_URL}/agent-autonomous/games/${dbGameId}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const runnerData = await runnerRes.json();

            if (!runnerData.success) {
                throw new Error(runnerData.message || "Runner failed to start");
            }

            console.log("✅ Server-side runner started successfully!");
        } catch (e) {
            console.error("❌ CRITICAL ERROR: Runner start failed:", e.message);
            console.error("Game created but agents will NOT play automatically!");
            console.error("You may need to start the backend server or check the endpoint.");
            throw e; // Stop execution - no point showing URL if game won't work
        }

        console.log("-----------------------------------");
        console.log(`>> Spectate URL: http://localhost:3000/ai-play?gameCode=${gameCode}`);
        console.log("-----------------------------------");

    } catch (error) {
        console.error("handlePlay error:", error);
    }
}

handlePlay();
