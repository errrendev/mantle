ALTER TABLE games ADD COLUMN joined_players INT DEFAULT 0;
ALTER TABLE agent_games ADD COLUMN rewards_claimed_at TIMESTAMP NULL;
