import type { Provider, IAgentRuntime } from '@elizaos/core';
import { AgentKit, CdpWalletProvider } from '@coinbase/agentkit';
import * as fs from 'node:fs';

const WALLET_DATA_FILE = 'wallet_data.txt';

export async function getClient(): Promise<AgentKit> {
    // Validate required environment variables first
    const apiKeyId = process.env.CDP_API_KEY_ID;
    const apiKeySecret = process.env.CDP_API_KEY_SECRET;

    if (!apiKeyId || !apiKeySecret) {
        throw new Error(
            'Missing required CDP API credentials. Please set CDP_API_KEY_ID and CDP_API_KEY_SECRET environment variables.'
        );
    }

    const networkId = process.env.NETWORK_ID || 'base-sepolia';
    const _walletSecret = process.env.CDP_WALLET_SECRET;

    let walletDataStr: string | null = null;

    // Read existing wallet data if available
    if (fs.existsSync(WALLET_DATA_FILE)) {
        try {
            walletDataStr = fs.readFileSync(WALLET_DATA_FILE, 'utf8');
        } catch (error) {
            console.error('Error reading wallet data:', error);
            // Continue without wallet data
        }
    }

    try {
        // Create wallet provider
        const walletProvider = await CdpWalletProvider.configureWithWallet({
            apiKeyId: apiKeyId,
            apiKeyPrivate: apiKeySecret,
            networkId: networkId,
            cdpWalletData: walletDataStr || undefined,
        });

        // Create AgentKit instance
        const agentKit = await AgentKit.from({
            walletProvider,
        });

        // Store wallet provider for later access
        (agentKit as { _walletProvider?: { address?: string } })._walletProvider = walletProvider;

        // Save wallet data for persistence - convert object to JSON string
        const exportedWallet = await walletProvider.exportWallet();
        const walletDataToSave =
            typeof exportedWallet === 'string' ? exportedWallet : JSON.stringify(exportedWallet);
        fs.writeFileSync(WALLET_DATA_FILE, walletDataToSave);

        return agentKit;
    } catch (error) {
        console.error('Failed to initialize AgentKit:', error);
        throw new Error(`Failed to initialize AgentKit: ${error.message || 'Unknown error'}`);
    }
}

export const walletProvider: Provider = {
    async get(_runtime: IAgentRuntime): Promise<string | null> {
        try {
            const client = await getClient();
            // Get wallet address from the stored wallet provider
            const storedWalletProvider = (client as { _walletProvider?: { address?: string } })
                ._walletProvider;
            if (storedWalletProvider?.address) {
                return `AgentKit Wallet Address: ${storedWalletProvider.address}`;
            }

            // Fallback: Try to get address from the CDP wallet provider configuration
            const apiKeyId = process.env.CDP_API_KEY_ID;
            const apiKeySecret = process.env.CDP_API_KEY_SECRET;
            const networkId = process.env.NETWORK_ID || 'base-sepolia';

            if (apiKeyId && apiKeySecret) {
                let walletDataStr: string | null = null;
                if (fs.existsSync(WALLET_DATA_FILE)) {
                    try {
                        walletDataStr = fs.readFileSync(WALLET_DATA_FILE, 'utf8');
                    } catch (_error) {
                        // Ignore read errors
                    }
                }

                const walletProvider = await CdpWalletProvider.configureWithWallet({
                    apiKeyId,
                    apiKeyPrivate: apiKeySecret,
                    networkId,
                    cdpWalletData: walletDataStr || undefined,
                });

                return `AgentKit Wallet Address: ${walletProvider.address}`;
            }

            return 'AgentKit Wallet: Unable to determine address';
        } catch (error) {
            console.error('Error in AgentKit provider:', error);
            return `Error initializing AgentKit wallet: ${error.message}`;
        }
    },
};
