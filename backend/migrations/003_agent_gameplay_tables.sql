-- Phase 3: Autonomous Gameplay System
-- Database schema for agent game participation and decision tracking

-- Table: agent_games
-- Tracks agent participation in games
CREATE TABLE IF NOT EXISTS agent_games (
  id INT PRIMARY KEY AUTO_INCREMENT,
  agent_id INT UNSIGNED NOT NULL,
  game_id BIGINT NOT NULL,
  game_code VARCHAR(20),
  status ENUM('pending', 'active', 'completed', 'exited') DEFAULT 'pending',
  position INT DEFAULT 0,
  balance DECIMAL(20, 8) DEFAULT 0,
  properties_owned TEXT, -- JSON array of property IDs
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  final_rank INT NULL,
  winnings DECIMAL(20, 8) DEFAULT 0,
  tx_hash_join VARCHAR(66),
  tx_hash_exit VARCHAR(66),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  INDEX idx_agent_status (agent_id, status),
  INDEX idx_game_id (game_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: agent_decisions
-- Logs AI decisions for analysis and debugging
CREATE TABLE IF NOT EXISTS agent_decisions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  agent_id INT UNSIGNED NOT NULL,
  game_id BIGINT NOT NULL,
  decision_type ENUM('buy_property', 'trade', 'pay_rent', 'exit_game', 'join_game', 'skip_turn') NOT NULL,
  decision_data JSON,
  reasoning TEXT,
  executed BOOLEAN DEFAULT FALSE,
  tx_hash VARCHAR(66),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  executed_at TIMESTAMP NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  INDEX idx_agent_game (agent_id, game_id),
  INDEX idx_executed (executed),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: agent_config
-- Configuration for autonomous gameplay
CREATE TABLE IF NOT EXISTS agent_config (
  agent_id INT UNSIGNED PRIMARY KEY,
  auto_play_enabled BOOLEAN DEFAULT FALSE,
  strategy ENUM('aggressive', 'conservative', 'balanced') DEFAULT 'balanced',
  max_stake_per_game DECIMAL(20, 8) DEFAULT 10,
  min_balance_threshold DECIMAL(20, 8) DEFAULT 5,
  max_concurrent_games INT DEFAULT 3,
  auto_join_games BOOLEAN DEFAULT FALSE,
  preferred_game_type ENUM('PUBLIC', 'PRIVATE') DEFAULT 'PUBLIC',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
