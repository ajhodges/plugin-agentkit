import { Plugin } from '@elizaos/core';
import { getClient, walletProvider } from './provider.js';
import { getAgentKitActions } from './actions.js';

// Environment variable validation
const requiredEnvVars = ['CDP_API_KEY_ID', 'CDP_API_KEY_SECRET'];

function validateEnvironment(): void {
    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
        console.error('❌ Missing required environment variables for AgentKit plugin:');
        for (const varName of missingVars) {
            console.error(`   - ${varName}`);
        }
        console.error('\n📝 Please set these environment variables to use the AgentKit plugin.');
        console.error('   Example: CDP_API_KEY_ID=your_key_id CDP_API_KEY_SECRET=your_secret');
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
}

async function initializeActions() {
    try {
        console.log('\n┌════════════════════════════════════════┐');
        console.log('│          AGENTKIT PLUGIN               │');
        console.log('├────────────────────────────────────────┤');
        console.log('│  Initializing AgentKit Plugin...       │');
        console.log('│  Version: 0.25.6-alpha.18 (1.x Compat)│');
        console.log('└════════════════════════════════════════┘');

        console.log('🚀 Initializing AgentKit client...');

        const actions = await getAgentKitActions({
            getClient,
        });

        console.log('✔ AgentKit actions initialized successfully.');
        console.log(`✔ Loaded ${actions.length} AgentKit actions.`);

        return actions;
    } catch (error) {
        console.error('❌ Failed to initialize AgentKit actions:', error);
        throw error;
    }
}

// Initialize actions synchronously using top-level await
validateEnvironment();
const actions = await initializeActions();

// Plugin export following ElizaOS 1.x format
export const agentKitPlugin: Plugin = {
    name: 'agentkit',
    description: 'AgentKit integration for ElizaOS - enables blockchain and crypto operations',
    actions,
    providers: [walletProvider],
    evaluators: [],
    services: [],
};

// Export the plugin as default for compatibility
export default agentKitPlugin;
