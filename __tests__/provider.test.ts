import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getClient, walletProvider } from '../src/provider';
import { AgentKit, CdpWalletProvider } from '@coinbase/agentkit';
import * as fs from 'node:fs';

// Mock dependencies
vi.mock('@coinbase/agentkit', () => ({
    AgentKit: {
        from: vi.fn().mockImplementation(async ({ walletProvider: _walletProvider }) => ({
            // AgentKit instance doesn't need getWalletDetails anymore
        })),
    },
    CdpWalletProvider: {
        configureWithWallet: vi.fn().mockImplementation(async (_config) => ({
            exportWallet: vi.fn().mockResolvedValue({ walletId: 'test-wallet', seed: 'test-seed' }),
            address: '0x123...abc',
        })),
    },
}));

vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
}));

describe('AgentKit Provider', () => {
    const mockRuntime = {
        name: 'test-runtime',
        memory: new Map(),
        getMemory: vi.fn(),
        setMemory: vi.fn(),
        clearMemory: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CDP_API_KEY_ID = 'test-api-key-id';
        process.env.CDP_API_KEY_SECRET = 'test-api-key-secret';
        process.env.NETWORK_ID = 'base-sepolia';
    });

    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
        delete process.env.NETWORK_ID;
        delete process.env.CDP_WALLET_SECRET;
    });

    describe('getClient', () => {
        it('should create new wallet when no existing wallet data', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const client = await getClient();

            expect(CdpWalletProvider.configureWithWallet).toHaveBeenCalledWith({
                apiKeyId: 'test-api-key-id',
                apiKeyPrivate: 'test-api-key-secret',
                networkId: 'base-sepolia',
                cdpWalletData: undefined,
            });
            expect(AgentKit.from).toHaveBeenCalledWith({
                walletProvider: expect.any(Object),
            });
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                'wallet_data.txt',
                JSON.stringify({ walletId: 'test-wallet', seed: 'test-seed' })
            );
            expect(client).toBeDefined();
        });

        it('should use existing wallet data when available', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('existing-wallet-data');

            const client = await getClient();

            expect(CdpWalletProvider.configureWithWallet).toHaveBeenCalledWith({
                apiKeyId: 'test-api-key-id',
                apiKeyPrivate: 'test-api-key-secret',
                networkId: 'base-sepolia',
                cdpWalletData: 'existing-wallet-data',
            });
            expect(AgentKit.from).toHaveBeenCalledWith({
                walletProvider: expect.any(Object),
            });
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                'wallet_data.txt',
                JSON.stringify({ walletId: 'test-wallet', seed: 'test-seed' })
            );
            expect(client).toBeDefined();
        });

        it('should handle file read errors gracefully', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockImplementation(() => {
                throw new Error('File read error');
            });

            const client = await getClient();

            expect(CdpWalletProvider.configureWithWallet).toHaveBeenCalledWith({
                apiKeyId: 'test-api-key-id',
                apiKeyPrivate: 'test-api-key-secret',
                networkId: 'base-sepolia',
                cdpWalletData: undefined,
            });
            expect(AgentKit.from).toHaveBeenCalledWith({
                walletProvider: expect.any(Object),
            });
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                'wallet_data.txt',
                JSON.stringify({ walletId: 'test-wallet', seed: 'test-seed' })
            );
            expect(client).toBeDefined();
        });

        it('should use custom network from environment variable', async () => {
            process.env.NETWORK_ID = 'custom-network';
            vi.mocked(fs.existsSync).mockReturnValue(false);

            await getClient();

            expect(CdpWalletProvider.configureWithWallet).toHaveBeenCalledWith({
                apiKeyId: 'test-api-key-id',
                apiKeyPrivate: 'test-api-key-secret',
                networkId: 'custom-network',
                cdpWalletData: undefined,
            });
        });

        it('should throw error when missing API credentials', async () => {
            delete process.env.CDP_API_KEY_ID;
            delete process.env.CDP_API_KEY_SECRET;

            await expect(getClient()).rejects.toThrow(
                'Missing required CDP API credentials. Please set CDP_API_KEY_ID and CDP_API_KEY_SECRET environment variables.'
            );
        });

        it('should handle exportWallet returning a string', async () => {
            // Mock exportWallet to return a string instead of object
            const mockWalletProvider = {
                exportWallet: vi.fn().mockResolvedValue('string-wallet-data'),
                address: '0x123...abc',
            };

            vi.mocked(CdpWalletProvider.configureWithWallet).mockResolvedValueOnce(
                mockWalletProvider
            );
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const client = await getClient();

            expect(fs.writeFileSync).toHaveBeenCalledWith('wallet_data.txt', 'string-wallet-data');
            expect(client).toBeDefined();
        });
    });

    describe('walletProvider', () => {
        it('should return wallet address', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            // Mock AgentKit.from to return an instance with _walletProvider
            const mockAgentKit = {
                _walletProvider: {
                    address: '0x123...abc',
                },
            };
            vi.mocked(AgentKit.from).mockResolvedValueOnce(mockAgentKit);

            const result = await walletProvider.get(mockRuntime);
            expect(result).toBe('AgentKit Wallet Address: 0x123...abc');
        });

        it('should handle errors and return error message', async () => {
            delete process.env.CDP_API_KEY_ID;
            delete process.env.CDP_API_KEY_SECRET;

            const result = await walletProvider.get(mockRuntime);
            expect(result).toContain('Error initializing AgentKit wallet:');
        });
    });
});
