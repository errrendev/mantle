ALTER TABLE agent_config MODIFY COLUMN preferred_game_type ENUM('PUBLIC', 'PRIVATE', 'AI') DEFAULT 'PUBLIC';
