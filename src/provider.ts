import { Provider, IAgentRuntime, ProviderError } from '@elizaos/core';
import { CdpWalletProvider } from '@coinbase/agentkit';
import { AgentKit } from '@coinbase/agentkit';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Define the client variable to store the AgentKit instance
let client: AgentKit | null = null;

// Export for testing purposes
export const resetClient = () => {
    client = null;
};

export const getClient = async (): Promise<AgentKit> => {
    if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
        throw new Error(
            'Missing required CDP API credentials. Please set CDP_API_KEY_ID and CDP_API_KEY_SECRET environment variables.'
        );
    }

    if (client) {
        return client;
    }

    const networkId = process.env.CDP_AGENT_KIT_NETWORK || 'base-sepolia';
    const walletDataPath = path.join(process.cwd(), 'wallet_data.txt');

    try {
        let walletProvider: CdpWalletProvider;

        // Check if wallet data file exists
        if (fs.existsSync(walletDataPath)) {
            try {
                const walletDataStr = fs.readFileSync(walletDataPath, 'utf8');
                console.log('Loading existing wallet...');
                
                walletProvider = await CdpWalletProvider.configureWithWallet({
                    cdpWalletData: walletDataStr,
                    networkId,
                    apiKeyId: process.env.CDP_API_KEY_ID,
                    apiKeyPrivate: process.env.CDP_API_KEY_SECRET,
                });
            } catch (error) {
                console.error('Error reading wallet data:', error);
                throw error;
            }
        } else {
            console.log('Creating new wallet...');
            walletProvider = await CdpWalletProvider.configureWithWallet({
                networkId,
                apiKeyId: process.env.CDP_API_KEY_ID,
                apiKeyPrivate: process.env.CDP_API_KEY_SECRET,
            });

            // Save wallet data for persistence
            const exportedWallet = await walletProvider.exportWallet();
            const walletDataToSave =
                typeof exportedWallet === 'string'
                    ? exportedWallet
                    : JSON.stringify(exportedWallet);
            
            fs.writeFileSync(walletDataPath, walletDataToSave);
            console.log('Wallet data saved to wallet_data.txt');
        }

        client = await AgentKit.from({
            walletProvider,
        });

        // Store wallet provider for later access
        (client as AgentKit & { _walletProvider?: CdpWalletProvider })._walletProvider = walletProvider;

        console.log('✅ AgentKit initialized successfully');
        return client;
    } catch (error) {
        console.error('Failed to initialize AgentKit:', error);
        throw error;
    }
};

export const walletProvider: Provider = {
    async get(): Promise<string | null> {
        try {
            const client = await getClient();
            // Get wallet address from the stored wallet provider
            const storedWalletProvider = (client as AgentKit & { _walletProvider?: { address?: string } })
                ._walletProvider;
            if (storedWalletProvider?.address) {
                return `AgentKit Wallet Address: ${storedWalletProvider.address}`;
            }
            return 'Wallet details not available';
        } catch (error) {
            console.error('Error in AgentKit provider:', error);
            return `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
    },
};
