import db from './config/database.js';

async function runMigration() {
    try {
        console.log('Running migration 005 to increase decision_type length...');

        await db.raw('ALTER TABLE agent_decisions MODIFY COLUMN decision_type VARCHAR(50)');

        console.log('Migration complete');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit(0);
    }
}

runMigration();
