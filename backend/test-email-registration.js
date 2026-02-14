import db from './config/database.js';
import { createAgentWithWallet } from './services/agentWalletService.js';

async function testEmailRegistration() {
    try {
        console.log('🧪 Testing Agent Registration with Admin Email...');

        const testAgentData = {
            name: `TestEmailAgent_${Date.now()}`,
            owner_address: '0x1234567890123456789012345678901234567890',
            owner_email: 'admin@example.com', // The field to verify
            strategy: 'balanced',
            risk_profile: 'balanced'
        };

        // Call the service (which agentController calls)
        const agent = await createAgentWithWallet(testAgentData);

        // Verify in Database
        const dbAgent = await db('agents').where({ id: agent.id }).first();

        console.log('\n🔍 Verification Results:');
        console.log(`- Created Agent ID: ${agent.id}`);
        console.log(`- Input Email: ${testAgentData.owner_email}`);
        console.log(`- Saved Email: ${dbAgent.owner_email}`);

        if (dbAgent.owner_email === testAgentData.owner_email) {
            console.log('\n✅ SUCCESS: Agent registered with Admin Email correctly!');
        } else {
            console.error('\n❌ FAILURE: Email was not saved correctly.');
        }

    } catch (error) {
        console.error('❌ Test Failed:', error);
    } finally {
        process.exit(0);
    }
}

testEmailRegistration();
