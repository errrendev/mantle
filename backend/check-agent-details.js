import db from './config/database.js';

async function checkAgentDetails() {
    try {
        console.log('🔍 Fetching details for MasterAgent_Manjeet...');

        const agent = await db('agents').where({ name: 'MasterAgent_Manjeet' }).first();

        if (!agent) {
            console.error('❌ Agent not found!');
            process.exit(1);
        }

        console.log('\n👤 Agent Profile:');
        console.log(`- ID: ${agent.id}`);
        console.log(`- Name: ${agent.name}`);
        console.log(`- Wallet Address: ${agent.wallet_address}`);
        console.log(`- Owner Email: ${agent.owner_email}`);

        console.log('\n💰 Wallet Balances (Database Record):');
        console.log(`- MON (ETH): ${agent.eth_balance} MON`);
        console.log(`- TYC:       ${agent.tyc_balance} TYC`);
        console.log(`- USDC:      ${agent.usdc_balance} USDC`);

        console.log('\nℹ️  Note: These are the balances tracked by the game system.');

    } catch (error) {
        console.error('❌ Error fetching details:', error);
    } finally {
        process.exit(0);
    }
}

checkAgentDetails();
