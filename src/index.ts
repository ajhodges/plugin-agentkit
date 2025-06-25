import type { Plugin, Action } from '@elizaos/core';
import { walletProvider, getClient } from './provider';
import { getAgentKitActions } from './actions';

// Initial banner
console.log('\n┌════════════════════════════════════════┐');
console.log('│          AGENTKIT PLUGIN               │');
console.log('├────────────────────────────────────────┤');
console.log('│  Initializing AgentKit Plugin...       │');
console.log('│  Version: 0.25.6-alpha.7               │');
console.log('└════════════════════════════════════════┘');

const initializeActions = async (): Promise<Action[]> => {
    try {
        // Validate environment variables
        const apiKeyId = process.env.CDP_API_KEY_ID;
        const apiKeySecret = process.env.CDP_API_KEY_SECRET;

        if (!apiKeyId || !apiKeySecret) {
            console.warn('⚠️ Missing CDP API credentials - AgentKit actions will not be available');
            console.warn(
                '   Please set CDP_API_KEY_ID and CDP_API_KEY_SECRET environment variables'
            );
            return [];
        }

        console.log('🚀 Initializing AgentKit client...');
        const actions = await getAgentKitActions({
            getClient,
        });
        console.log('✔ AgentKit actions initialized successfully.');
        console.log(`✔ Loaded ${actions.length} AgentKit actions.`);
        return actions;
    } catch (error) {
        console.error('❌ Failed to initialize AgentKit actions:', error);
        return []; // Return empty array instead of failing
    }
};

// Initialize actions synchronously using top-level await
const actions = await initializeActions();

export const agentKitPlugin: Plugin = {
    name: '[AgentKit] Integration',
    description: 'AgentKit integration plugin for onchain AI agent actions',
    providers: [walletProvider],
    evaluators: [],
    services: [],
    actions,
};

export default agentKitPlugin;
