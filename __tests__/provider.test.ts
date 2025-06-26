import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { walletProvider, getClient, resetClient } from '../src/provider';
import { AgentKit, CdpWalletProvider } from '@coinbase/agentkit';

// Mock the AgentKit module
vi.mock('@coinbase/agentkit', () => ({
    AgentKit: {
        from: vi.fn(),
    },
    CdpWalletProvider: {
        configureWithWallet: vi.fn(),
    },
}));

// Mock fs module
vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
}));

// Mock path module
vi.mock('node:path', () => ({
    join: vi.fn(() => 'mocked/path/wallet_data.txt'),
}));

describe('AgentKit Provider', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset environment variables
        process.env = {
            ...originalEnv,
            CDP_API_KEY_ID: 'test-key-id',
            CDP_API_KEY_SECRET: 'test-key-secret',
            CDP_AGENT_KIT_NETWORK: 'base-sepolia',
        };

        // Reset client before each test
        resetClient();

        // Clear all mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('getClient', () => {
        it('should throw error when missing CDP_API_KEY_ID', async () => {
            delete process.env.CDP_API_KEY_ID;

            await expect(getClient()).rejects.toThrow('Missing required CDP API credentials');
        });

        it('should throw error when missing CDP_API_KEY_SECRET', async () => {
            delete process.env.CDP_API_KEY_SECRET;

            await expect(getClient()).rejects.toThrow('Missing required CDP API credentials');
        });

        it('should create new wallet when wallet data file does not exist', async () => {
            const fs = await import('node:fs');
            const mockWalletProvider = {
                address: '0x123...',
                exportWallet: vi.fn().mockResolvedValue('wallet-data'),
            };
            const mockAgentKit = { _walletProvider: mockWalletProvider };

            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(CdpWalletProvider.configureWithWallet).mockResolvedValue(
                mockWalletProvider as unknown
            );
            vi.mocked(AgentKit.from).mockResolvedValue(mockAgentKit as unknown);

            const client = await getClient();

            expect(CdpWalletProvider.configureWithWallet).toHaveBeenCalledWith({
                networkId: 'base-sepolia',
                apiKeyId: 'test-key-id',
                apiKeyPrivate: 'test-key-secret',
            });
            expect(AgentKit.from).toHaveBeenCalledWith({
                walletProvider: mockWalletProvider,
            });
            expect(client).toBe(mockAgentKit);
        });

        it('should load existing wallet when wallet data file exists', async () => {
            const fs = await import('node:fs');
            const mockWalletProvider = { address: '0x456...' };
            const mockAgentKit = { _walletProvider: mockWalletProvider };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('existing-wallet-data');
            vi.mocked(CdpWalletProvider.configureWithWallet).mockResolvedValue(
                mockWalletProvider as unknown
            );
            vi.mocked(AgentKit.from).mockResolvedValue(mockAgentKit as unknown);

            const client = await getClient();

            expect(CdpWalletProvider.configureWithWallet).toHaveBeenCalledWith({
                cdpWalletData: 'existing-wallet-data',
                networkId: 'base-sepolia',
                apiKeyId: 'test-key-id',
                apiKeyPrivate: 'test-key-secret',
            });
            expect(client).toBe(mockAgentKit);
        });

        it('should return cached client on subsequent calls', async () => {
            const fs = await import('node:fs');
            const mockWalletProvider = {
                address: '0x789...',
                exportWallet: vi.fn().mockResolvedValue('wallet-data'),
            };
            const mockAgentKit = { _walletProvider: mockWalletProvider };

            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(CdpWalletProvider.configureWithWallet).mockResolvedValue(
                mockWalletProvider as unknown
            );
            vi.mocked(AgentKit.from).mockResolvedValue(mockAgentKit as unknown);

            const client1 = await getClient();
            const client2 = await getClient();

            expect(client1).toBe(client2);
            expect(AgentKit.from).toHaveBeenCalledTimes(1);
        });
    });

    describe('walletProvider', () => {
        it('should return wallet address from provider', async () => {
            const fs = await import('node:fs');
            const mockWalletProvider = {
                address: '0xABC123...',
                exportWallet: vi.fn().mockResolvedValue('wallet-data'),
            };
            const mockAgentKit = { _walletProvider: mockWalletProvider };

            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(CdpWalletProvider.configureWithWallet).mockResolvedValue(
                mockWalletProvider as unknown
            );
            vi.mocked(AgentKit.from).mockResolvedValue(mockAgentKit as unknown);

            const result = await walletProvider.get();

            expect(result).toBe('AgentKit Wallet Address: 0xABC123...');
        });

        it('should handle errors gracefully', async () => {
            delete process.env.CDP_API_KEY_ID;

            const result = await walletProvider.get();

            expect(result).toContain('Error:');
            expect(result).toContain('Missing required CDP API credentials');
        });

        it('should handle missing wallet address', async () => {
            const fs = await import('node:fs');
            const mockWalletProvider = {
                // No address property but include exportWallet to prevent error
                exportWallet: vi.fn().mockResolvedValue('mock-wallet-data'),
            };
            const mockAgentKit = { _walletProvider: mockWalletProvider };

            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(CdpWalletProvider.configureWithWallet).mockResolvedValue(
                mockWalletProvider as unknown
            );
            vi.mocked(AgentKit.from).mockResolvedValue(mockAgentKit as unknown);

            const result = await walletProvider.get();

            expect(result).toBe('Wallet details not available');
        });
    });
});
