import Agent from "../models/Agent.js";
import AgentReward from "../models/AgentReward.js";
import AgentGameParticipation from "../models/AgentGameParticipation.js";
import User from "../models/User.js";

const agentController = {
  async create(req, res) {
    try {
      const { name, strategy, riskProfile, config, ownerAddress, ownerEmail, registerOnChain = true } = req.body;

      if (!ownerAddress) {
        return res.status(400).json({
          success: false,
          message: "Owner address is required"
        });
      }

      // If registerOnChain is true, use wallet service for full on-chain registration
      if (registerOnChain) {
        const { createAgentWithWallet } = await import('../services/agentWalletService.js');

        const agent = await createAgentWithWallet({
          name,
          owner_address: ownerAddress,
          owner_email: ownerEmail,
          strategy: strategy || 'balanced',
          risk_profile: riskProfile || 'balanced',
          config: config || {}
        });

        // Create corresponding User entry for game participation
        await User.create({
          username: name,
          address: agent.wallet_address, // Use blockchain wallet address
          chain: 'MONAD_TESTNET'
        });

        return res.status(201).json({
          success: true,
          message: "Agent created successfully with on-chain registration",
          data: {
            ...agent,
            // Don't expose encrypted private key in response
            private_key_encrypted: undefined
          }
        });
      }

      // Legacy creation without wallet (for backwards compatibility)
      const timestamp = Date.now();
      const address = `0xAI${timestamp.toString(16).padStart(40, '0')}`;

      const agent = await Agent.create({
        name,
        address,
        owner_address: ownerAddress,
        owner_email: ownerEmail,
        strategy: strategy || 'balanced',
        risk_profile: riskProfile || 'balanced',
        config: config ? JSON.stringify(config) : null
      });

      // Create corresponding User entry for game participation
      await User.create({
        username: name,
        address,
        chain: 'AI_NET'
      });

      res.status(201).json({
        success: true,
        message: "Agent created successfully (legacy mode - no wallet)",
        data: agent
      });
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createWithAIModel(req, res) {
    try {
      const {
        name,
        modelName,
        apiKey,
        initialAmount,
        strategy = 'balanced',
        riskProfile = 'balanced',
        ownerAddress
      } = req.body;

      // Validate required fields
      if (!name || !modelName || !apiKey || !ownerAddress) {
        return res.status(400).json({
          success: false,
          message: "Name, model name, API key, and owner address are required"
        });
      }

      // Validate initial amount
      const parsedAmount = parseFloat(initialAmount) || 0;
      if (parsedAmount < 0) {
        return res.status(400).json({
          success: false,
          message: "Initial amount must be non-negative"
        });
      }

      // Create agent configuration (needed for both paths)
      const agentConfig = {
        ai_model: modelName,
        api_key: apiKey, // Note: In production, encrypt this
        initial_amount: parsedAmount,
        reasoning_engine: 'heuristic_scoring',
        decision_timeout: 5000,
        auto_play: true,
        created_with: 'ai_model_config'
      };

      const registerOnChain = req.body.registerOnChain !== false; // Default to true
      let agent;

      // If registerOnChain is true, use wallet service
      if (registerOnChain) {
        const { createAgentWithWallet } = await import('../services/agentWalletService.js');

        agent = await createAgentWithWallet({
          name,
          owner_address: ownerAddress,
          strategy,
          risk_profile: riskProfile,
          config: agentConfig
        });
      } else {
        // Legacy creation without wallet
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const address = `0xAI${timestamp.toString(16).padStart(32, '0')}${randomSuffix}`;

        agent = await Agent.create({
          name,
          address,
          owner_address: ownerAddress,
          strategy,
          risk_profile: riskProfile,
          config: JSON.stringify(agentConfig)
        });
      }

      // Create corresponding User entry for game participation
      const uniqueUsername = `${name}_${Date.now()}`;
      await User.create({
        username: uniqueUsername,
        address: agent.wallet_address || agent.address,
        chain: registerOnChain ? 'MONAD_TESTNET' : 'AI_NET'
      });

      // If initial amount > 0, create initial reward record
      if (parsedAmount > 0) {
        try {
          await AgentReward.create({
            agent_id: agent.id,
            game_id: null, // System reward, not tied to specific game
            amount: parsedAmount,
            currency: 'POINTS',
            status: 'CLAIMED',
            metadata: JSON.stringify({
              type: 'initial_funding',
              model_name: modelName,
              created_at: new Date().toISOString()
            })
          });
        } catch (rewardError) {
          // If game_id constraint fails, create without reward record
          console.warn('Could not create initial reward record (game_id constraint):', rewardError.message);
          // Update agent's total_revenue directly instead
          await Agent.update(agent.id, {
            total_revenue: parsedAmount
          });
        }
      }

      res.status(201).json({
        success: true,
        message: registerOnChain
          ? "Agent created with AI model and on-chain registration"
          : "Agent created with AI model (legacy mode)",
        data: {
          ...agent,
          config: agentConfig,
          // Don't expose sensitive data
          private_key_encrypted: undefined
        }
      });
    } catch (error) {
      console.error("Error creating agent with AI model:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create agent with AI model",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async getAll(req, res) {
    try {
      const { limit = 50, offset = 0, sortBy = 'total_revenue' } = req.query;

      const agents = await Agent.findAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        sortBy
      });

      res.json({
        success: true,
        message: "successful",
        data: agents
      });
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getByOwner(req, res) {
    try {
      const { ownerAddress } = req.params;

      const agents = await Agent.findByOwner(ownerAddress);

      res.json({
        success: true,
        message: "successful",
        data: agents
      });
    } catch (error) {
      console.error("Error fetching owner's agents:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;

      const agent = await Agent.findById(id);
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: "Agent not found"
        });
      }

      // Get additional stats
      const stats = await AgentGameParticipation.getAgentStats(id);
      const totalRewards = await AgentReward.getTotalRewardsByAgent(id);
      const claimableRewards = await AgentReward.getClaimableRewards(id);

      res.json({
        success: true,
        message: "successful",
        data: {
          ...agent,
          stats,
          totalRewards,
          claimableRewards
        }
      });
    } catch (error) {
      console.error("Error fetching agent:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, strategy, riskProfile, config, isActive } = req.body;

      const updateData = {};
      if (name) updateData.name = name;
      if (strategy) updateData.strategy = strategy;
      if (riskProfile) updateData.risk_profile = riskProfile;
      if (config) updateData.config = JSON.stringify(config);
      if (typeof isActive === 'boolean') updateData.is_active = isActive;

      const agent = await Agent.update(id, updateData);

      res.json({
        success: true,
        message: "Agent updated successfully",
        data: agent
      });
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateStats(req, res) {
    try {
      const { id } = req.params;
      const { wins = 0, matches = 0, revenue = 0 } = req.body;

      const agent = await Agent.updateStats(id, { wins, matches, revenue });

      res.json({
        success: true,
        message: "Agent stats updated successfully",
        data: agent
      });
    } catch (error) {
      console.error("Error updating agent stats:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;

      await Agent.delete(id);

      res.json({
        success: true,
        message: "Agent deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting agent:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Leaderboard endpoints
  async getLeaderboard(req, res) {
    try {
      const { limit = 50, offset = 0, metric = 'total_revenue' } = req.query;

      // Validate parameters
      const validMetrics = ['total_revenue', 'total_wins', 'win_rate', 'current_streak'];
      const sortBy = validMetrics.includes(metric) ? metric : 'total_revenue';
      const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100); // Between 1-100
      const parsedOffset = Math.max(parseInt(offset) || 0, 0); // Minimum 0

      console.log(`Fetching leaderboard with metric: ${sortBy}, limit: ${parsedLimit}, offset: ${parsedOffset}`);

      const leaderboard = await Agent.getLeaderboard({
        limit: parsedLimit,
        offset: parsedOffset,
        metric: sortBy
      });

      res.json({
        success: true,
        message: "successful",
        data: leaderboard,
        meta: {
          metric: sortBy,
          limit: parsedLimit,
          offset: parsedOffset,
          count: leaderboard.length
        }
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch leaderboard",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async getTopPerformers(req, res) {
    try {
      const { limit = 10 } = req.query;

      const topPerformers = await AgentGameParticipation.getTopPerformers(parseInt(limit));

      res.json({
        success: true,
        message: "successful",
        data: topPerformers
      });
    } catch (error) {
      console.error("Error fetching top performers:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Update win rates for all agents (maintenance endpoint)
  async updateWinRates(req, res) {
    try {
      const success = await Agent.updateAllWinRates();

      if (success) {
        res.json({
          success: true,
          message: "Win rates updated successfully for all agents"
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to update win rates"
        });
      }
    } catch (error) {
      console.error("Error updating win rates:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

export default agentController;