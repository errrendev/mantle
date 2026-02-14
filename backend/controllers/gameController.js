import Game from "../models/Game.js";
import GameSetting from "../models/GameSetting.js";
import GamePlayer from "../models/GamePlayer.js";
import GameProperty from "../models/GameProperty.js";
import User from "../models/User.js";
import GamePlayHistory from "../models/GamePlayHistory.js";
import Chat from "../models/Chat.js";

/**
 * Game Controller
 *
 * Handles requests related to game sessions.
 */
const gameController = {
  // -------------------------
  // 🔹 CRUD
  // -------------------------

  async create(req, res) {
    try {
      const { code, mode, address, symbol, number_of_players, settings, chain, username } = req.body;

      // Default to "Monad Testnet" if chain is not provided
      const searchChain = chain || "Monad Testnet";

      let user = await User.findByAddress(address, searchChain);

      // Fallback to BASE if not found on requested chain
      if (!user) {
        user = await User.findByAddress(address, "BASE");
      }

      // Auto-create user if still not found but we have a username (Self-Healing)
      if (!user && username) {
        console.log(`User not found for ${address} on ${searchChain}. Auto-creating...`);
        try {
          // Check if username is taken first (optional, but good practice, though create might fail)
          // For now let's just try to create.
          user = await User.create({
            username,
            address,
            chain: searchChain,
            // Add other default fields if necessary, e.g. status
          });
        } catch (createErr) {
          console.error("Auto-creation failed:", createErr);
          // If creation failed (Maybe username taken?), we can't proceed.
          return res.status(200).json({
            success: false,
            message: "User not found and auto-creation failed: " + createErr.message
          });
        }
      }

      if (!user) {
        return res
          .status(200)
          .json({ success: false, message: "User not found" });
      }

      // check if code exist
      // Check if creator is a spectator (not playing)
      const is_spectator = String(req.body.is_spectator) === "true";

      // If spectator, the number of players is just the AI count
      // If playing, it's AI count + 1 (the creator)
      // The frontend should send the correct number_of_players, but let's be safe

      const game = await Game.create({
        code,
        mode,
        creator_id: user.id,
        next_player_id: user.id, // Initial next_player, will be updated when AIs join
        number_of_players,
        status: "PENDING",
        is_agent_only: req.body.is_agent_only || false
      });

      const chat = await Chat.create({
        game_id: game.id,
        status: "open"
      });

      const gameSettingsPayload = {
        game_id: game.id,
        auction: settings.auction,
        rent_in_prison: settings.rent_in_prison,
        mortgage: settings.mortgage,
        even_build: settings.even_build,
        randomize_play_order: settings.randomize_play_order,
        starting_cash: settings.starting_cash,
      };

      const game_settings = await GameSetting.create(gameSettingsPayload);

      // Only add creator as player if NOT spectator
      if (!is_spectator) {
        const gamePlayersPayload = {
          game_id: game.id,
          user_id: user.id,
          address: user.address,
          balance: settings.starting_cash,
          position: 0,
          turn_order: 1,
          symbol: symbol,
          chance_jail_card: false,
          community_chest_jail_card: false,
        };

        await GamePlayer.create(gamePlayersPayload);
      }

      // -----------------------------
      // 🤖 AI Opponent Generation
      // -----------------------------
      const ai_opponents = req.body.ai_opponents;
      if (ai_opponents && Number(ai_opponents) > 0) {
        const aiCount = Number(ai_opponents);
        console.log(`Generating ${aiCount} AI bots for game ${game.id}`);

        for (let i = 0; i < aiCount; i++) {
          const botNum = i + 1;
          // Create unique bot identity for this game to avoid collisions
          // Address format: 0xAI[GameID_Hex][BotNum] to be roughly valid hex
          // Pad to ensure it looks like an address (42 chars total usually)
          // GameId to hex
          const gIdHex = game.id.toString(16).padStart(4, '0');
          const bNumHex = botNum.toString(16).padStart(2, '0');
          // 0x + AI + 00... + GID + BN
          const fakeAddress = `0xAI000000000000000000000000000000${gIdHex}${bNumHex}`;

          const botUsername = `AI_Bot_${botNum}`;

          // Create Bot User if needed
          let botUser = await User.findByAddress(fakeAddress, "AI_NET");
          if (!botUser) {
            try {
              botUser = await User.create({
                username: `${botUsername}_${game.code}`, // Unique name per game
                address: fakeAddress,
                chain: "AI_NET"
              });
            } catch (err) {
              console.error(`Failed to create bot user ${botNum}:`, err);
              // If failed (collision?), try to fetch again or skip
              botUser = await User.findByAddress(fakeAddress, "AI_NET");
            }
          }

          if (botUser) {
            // Add Bot as Game Player
            // Turn order: If spectator, start from 1. If playing, start from 2 (since creator is 1)
            const turnOrder = is_spectator ? botNum : botNum + 1;

            await GamePlayer.create({
              game_id: game.id,
              user_id: botUser.id,
              address: botUser.address,
              balance: settings.starting_cash,
              position: 0,
              turn_order: turnOrder,
              symbol: botNum, // Simple symbol assignment
              chance_jail_card: false,
              community_chest_jail_card: false,
            });
          }
        }

        // Check if game is now full.
        // If spectator: AI Count == number_of_players
        // If playing: 1 + AI Count == number_of_players
        const currentPlayersCount = is_spectator ? aiCount : 1 + aiCount;

        if (currentPlayersCount >= Number(number_of_players)) {
          console.log(`Game ${game.id} is full (AI). Starting...`);

          await Game.update(game.id, { status: "RUNNING" });
          game.status = "RUNNING"; // Update local object for response

          // If spectator mode, we need to set next_player_id to the first AI
          if (is_spectator) {
            const firstAi = await GamePlayer.findByGameId(game.id).then(players =>
              players.find(p => p.turn_order === 1)
            );
            if (firstAi) {
              await Game.update(game.id, { next_player_id: firstAi.user_id });
              game.next_player_id = firstAi.user_id;
            }
          }
        }
      }

      const game_players = await GamePlayer.findByGameId(game.id);

      res.status(201).json({
        success: true,
        message: "successful",
        data: {
          ...game,
          settings: game_settings,
          players: game_players,
        },
      });
    } catch (error) {
      console.error("Error creating game with settings:", error);
      res.status(200).json({ success: false, message: error.message });
    }
  },

  async findById(req, res) {
    try {
      const game = await Game.findById(req.params.id);
      if (!game) return res.status(404).json({ error: "Game not found" });

      // Attach settings
      const settings = await GameSetting.findByGameId(game.id);
      const players = await GamePlayer.findByGameId(game.id);
      const game_properties = await GameProperty.findByGameId(game.id);

      res.json({
        success: true,
        message: "successful",
        data: { ...game, settings, players, game_properties },
      });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },

  async findAll(req, res) {
    try {
      const { limit, offset } = req.query;
      const games = await Game.findAll({
        limit: Number.parseInt(limit) || 10000,
        offset: Number.parseInt(offset) || 0,
      });

      // Eager load settings for each game
      const withSettingsAndPlayers = await Promise.all(
        games.map(async (g) => ({
          ...g,
          settings: await GameSetting.findByGameId(g.id),
          players: await GamePlayer.findByGameId(g.id),
        }))
      );

      res.json({
        success: true,
        message: "successful",
        data: withSettingsAndPlayers,
      });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },

  async update(req, res) {
    try {
      await Game.update(req.params.id, req.body);
      res.json({ success: true, message: "Game updated" });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },

  async remove(req, res) {
    try {
      await Game.delete(req.params.id);
      res.json({ success: true, message: "Game deleted" });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },

  // -------------------------
  // 🔹 Extra Endpoints
  // -------------------------

  async findByCode(req, res) {
    try {
      const game = await Game.findByCode(req.params.code);
      if (!game) return res.status(404).json({ error: "Game not found" });
      const settings = await GameSetting.findByGameId(game.id);
      const players = await GamePlayer.findByGameId(game.id);
      const history = await GamePlayHistory.findByGameId(game.id);
      const game_properties = await GameProperty.findByGameId(game.id);

      res.json({
        success: true,
        message: "successful",
        data: { ...game, settings, players, history, game_properties },
      });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },

  async findByWinner(req, res) {
    try {
      const { limit, offset } = req.query;
      const games = await Game.findByWinner(req.params.userId, {
        limit: Number.parseInt(limit) || 500,
        offset: Number.parseInt(offset) || 0,
      });
      res.json({
        success: true,
        message: "successful",
        data: games,
      });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },

  async findByCreator(req, res) {
    try {
      const { limit, offset } = req.query;
      const games = await Game.findByCreator(req.params.userId, {
        limit: Number.parseInt(limit) || 500,
        offset: Number.parseInt(offset) || 0,
      });
      res.json({
        success: true,
        message: "successful",
        data: games,
      });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },
  async findActive(req, res) {
    try {
      const { limit, offset, timeframe } = req.query;

      const games = await Game.findActiveGames({
        limit: Number.parseInt(limit) || 50,
        offset: Number.parseInt(offset) || 0,
        timeframe: timeframe ? Number(timeframe) : null,
      });

      const withSettingsAndPlayers = await Promise.all(
        games.map(async (g) => {
          const players = await GamePlayer.findByGameId(g.id);

          // Transform players to include nested agent object if agent data exists
          const enrichedPlayers = players.map(p => {
            if (p.agent_id && p.agent_name) {
              return {
                ...p,
                agent: {
                  id: p.agent_id,
                  name: p.agent_name,
                  strategy: p.agent_strategy,
                  risk_profile: p.agent_risk_profile,
                  total_wins: p.agent_total_wins,
                  total_matches: p.agent_total_matches
                }
              };
            }
            return p;
          });

          return {
            ...g,
            settings: await GameSetting.findByGameId(g.id),
            players: enrichedPlayers,
            // Calculate current player for display
            current_player: enrichedPlayers.find(p => p.id === g.next_player_id)?.turn_order || 1,
            total_players: g.number_of_players || enrichedPlayers.length
          };
        })
      );

      res.json({
        success: true,
        message: "successful",
        data: withSettingsAndPlayers,
      });
    } catch (error) {
      res.status(200).json({
        success: false,
        message: error.message,
      });
    }
  },

  async findPending(req, res) {
    try {
      const { limit, offset } = req.query;
      const games = await Game.findPendingGames({
        limit: Number.parseInt(limit) || 50,
        offset: Number.parseInt(offset) || 0,
      });
      // Eager load settings for each game
      const withSettingsAndPlayers = await Promise.all(
        games.map(async (g) => ({
          ...g,
          settings: await GameSetting.findByGameId(g.id),
          players: await GamePlayer.findByGameId(g.id),
        }))
      );

      res.json({
        success: true,
        message: "successful",
        data: withSettingsAndPlayers,
      });
    } catch (error) {
      res.status(200).json({ success: false, message: error.message });
    }
  },
  async findMyGames(req, res) {
    try {
      let userId;

      // 1. Try to get user from auth middleware
      if (req.user) {
        userId = req.user.id;
      }
      // 2. Fallback: try to get user from query param (address)
      else if (req.query.address) {
        const chain = req.query.chain || "Monad Testnet"; // Default to Monad Testnet if not specified
        const user = await User.findByAddress(req.query.address, chain);
        if (user) {
          userId = user.id;
        }
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User not identified. Please provide auth token or address.",
        });
      }

      // 3. Find games where user is a player
      const gamesPlayed = await GamePlayer.findByUserId(userId);
      const gameIds = gamesPlayed.map((gp) => gp.game_id);

      // Remove duplicates
      const uniqueGameIds = [...new Set(gameIds)];

      if (uniqueGameIds.length === 0) {
        return res.json({
          success: true,
          message: "successful",
          data: [],
        });
      }

      // 4. Fetch full game details for these IDs
      // We can use Game.findAll with a "whereIn" clause if it supported it, 
      // but since Game.findAll determines logic internally, we might need a custom query 
      // or just iterate (less efficient but works for now).
      // BETTER: Let's fetch them.
      // Actually, GamePlayer.findByUserId (which we called) returns:
      // "gp.*", "g.code as game_code", "g.status as game_status"
      // But the frontend expects the full Game object with settings and players.

      // Let's create a helper to fetch active games details.
      // For now, let's just fetch the Game objects for these IDs.
      const games = await Promise.all(
        uniqueGameIds.map((id) => Game.findById(id))
      );

      // Filter out nulls (if any game was deleted)
      const validGames = games.filter((g) => g);

      // 5. Eager load settings/players
      const withSettingsAndPlayers = await Promise.all(
        validGames.map(async (g) => ({
          ...g,
          settings: await GameSetting.findByGameId(g.id),
          players: await GamePlayer.findByGameId(g.id),
        }))
      );

      res.json({
        success: true,
        message: "successful",
        data: withSettingsAndPlayers,
      });
    } catch (error) {
      console.error("Error in findMyGames:", error);
      res.status(200).json({ success: false, message: error.message });
    }
  },
};

export const create = async (req, res) => {
  try {
    const { code, mode, address, symbol, number_of_players, settings, chain } =
      req.body;

    // Default to Monad Testnet if chain is not provided, or use the one from request
    // This fixes the issue where users on Monad Testnet were not found in DB (because they were saved with chain="Monad Testnet" but looked up with default "BASE")
    const searchChain = chain || "Monad Testnet";
    const user = await User.findByAddress(address, searchChain);

    if (!user) {
      console.log(`User not found for address: ${address}, chain: ${searchChain}`);
      // Fallback: Try "BASE" just in case legacy user
      const userBase = await User.findByAddress(address, "BASE");
      if (!userBase) {
        return res
          .status(200)
          .json({ success: false, message: `User not found on chain ${searchChain}` });
      }
      // If found on BASE, use it (or maybe we should migrate them? For now just use it)
    }

    const finalUser = user || (await User.findByAddress(address, "BASE"));

    // Check if game code already exists
    const existingGame = await Game.findByCode(code);
    if (existingGame) {
      return res
        .status(200)
        .json({ success: false, message: "Game code already exists" });
    }

    const game = await Game.create({
      code,
      mode,
      creator_id: finalUser.id,
      next_player_id: finalUser.id,
      number_of_players,
      status: "PENDING",
    });

    console.log("Game created:", game); // DEBUG LOG to see if ID exists

    const gameSettingsPayload = {
      game_id: game.id,
      auction: settings.auction,
      rent_in_prison: settings.rent_in_prison,
      mortgage: settings.mortgage,
      even_build: settings.even_build,
      randomize_play_order: settings.randomize_play_order,
      starting_cash: settings.starting_cash,
    };

    const game_settings = await GameSetting.create(gameSettingsPayload);

    const gamePlayersPayload = {
      game_id: game.id,
      user_id: finalUser.id,
      address: finalUser.address,
      balance: settings.starting_cash,
      position: 0,
      turn_order: 1,
      symbol: symbol,
      chance_jail_card: false,
      community_chest_jail_card: false,
    };

    const add_to_game_players = await GamePlayer.create(gamePlayersPayload);

    const game_players = await GamePlayer.findByGameId(game.id);

    // Emit game created event
    const io = req.app.get("io");
    io.to(game.code).emit("game-created", {
      game: { ...game, settings: game_settings, players: game_players },
    });

    res.status(201).json({
      success: true,
      message: "successful",
      data: {
        ...game,
        settings: game_settings,
        players: game_players,
      },
    });
  } catch (error) {
    console.error("Error creating game with settings:", error);
    res.status(200).json({ success: false, message: error.message });
  }
};

export const join = async (req, res) => {
  try {
    const { address, code, symbol } = req.body;

    // find user
    const user = await User.findByAddress(address);
    if (!user) {
      return res
        .status(200)
        .json({ success: false, message: "User not found" });
    }

    // find game
    const game = await Game.findByCode(code);
    if (!game) {
      return res
        .status(200)
        .json({ success: false, message: "Game not found" });
    }

    // Check if game is full
    const currentPlayers = await GamePlayer.findByGameId(game.id);
    if (currentPlayers.length >= game.number_of_players) {
      return res.status(200).json({ success: false, message: "Game is full" });
    }

    // Check if user is already in the game
    const existingPlayer = currentPlayers.find(
      (player) => player.user_id === user.id
    );
    if (existingPlayer) {
      return res
        .status(200)
        .json({ success: false, message: "Player already in game" });
    }

    // find settings
    const settings = await GameSetting.findByGameId(game.id);
    if (!settings) {
      return res
        .status(200)
        .json({ success: false, message: "Game settings not found" });
    }

    // find max turn order
    const maxTurnOrder =
      currentPlayers.length > 0
        ? Math.max(...currentPlayers.map((p) => p.turn_order || 0))
        : 0;

    // assign next turn_order
    const nextTurnOrder = maxTurnOrder + 1;

    // create new player
    const player = await GamePlayer.create({
      address,
      symbol,
      user_id: user.id,
      game_id: game.id,
      balance: settings.starting_cash,
      position: 0,
      chance_jail_card: false,
      community_chest_jail_card: false,
      turn_order: nextTurnOrder,
      circle: 0,
      rolls: 0,
    });

    // Get updated players list
    const updatedPlayers = await GamePlayer.findByGameId(game.id);

    // Emit player joined event
    const io = req.app.get("io");
    io.to(game.code).emit("player-joined", {
      player: player,
      players: updatedPlayers,
      game: game,
    });

    // If game is now full, update status and emit
    if (updatedPlayers.length === game.number_of_players) {
      await Game.update(game.id, { status: "RUNNING" });
      const updatedGame = await Game.findByCode(code);

      io.to(game.code).emit("game-ready", {
        game: updatedGame,
        players: updatedPlayers,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Player added to game successfully",
      data: player,
    });
  } catch (error) {
    console.error("Error creating game player:", error);
    return res.status(200).json({ success: false, message: error.message });
  }
};

export const leave = async (req, res) => {
  try {
    const { address, code } = req.body;
    const user = await User.findByAddress(address);
    if (!user) {
      return res
        .status(200)
        .json({ success: false, message: "User not found" });
    }

    const game = await Game.findByCode(code);
    if (!game) {
      return res
        .status(200)
        .json({ success: false, message: "Game not found" });
    }

    const player = await GamePlayer.leave(game.id, user.id);

    // Get updated players list
    const updatedPlayers = await GamePlayer.findByGameId(game.id);

    // Emit player left event
    const io = req.app.get("io");
    io.to(game.code).emit("player-left", {
      player: player,
      players: updatedPlayers,
      game: game,
    });

    // If no players left, delete the game
    if (updatedPlayers.length === 0) {
      await Game.delete(game.id);
      io.to(game.code).emit("game-ended", { gameCode: code });
    }

    res.status(200).json({
      success: true,
      message: "Player removed from game successfully",
    });
  } catch (error) {
    console.error("Error removing game player:", error);
    res.status(200).json({ success: false, message: error.message });
  }
};

export default gameController;
