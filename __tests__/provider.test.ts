import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getClient, walletProvider, resetClient } from '../src/provider';
import { AgentKit, CdpWalletProvider } from '@coinbase/agentkit';
import * as fs from 'node:fs';
import path from 'node:path';

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

vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
}));

describe('AgentKit Provider', () => {
    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();
        // Reset environment variables
        process.env.CDP_API_KEY_ID = 'test-api-key-id';
        process.env.CDP_API_KEY_SECRET = 'test-api-key-secret';
        process.env.CDP_AGENT_KIT_NETWORK = 'base-sepolia';

        // Reset the client singleton
        resetClient();
    });

    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
        delete process.env.CDP_AGENT_KIT_NETWORK;
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
                path.join(process.cwd(), 'wallet_data.txt'),
                JSON.stringify({ walletId: 'test-wallet', seed: 'test-seed' })
            );
            expect(client).toBeDefined();
        });

        it('should use existing wallet data when available', async () => {
            const mockWalletProvider = { address: '0x123' };
            const mockClient = {};

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('{"walletId":"existing-wallet"}');
            vi.mocked(CdpWalletProvider.configureWithWallet).mockResolvedValue(mockWalletProvider);
            vi.mocked(AgentKit.from).mockResolvedValue(mockClient);

            const client = await getClient();

            expect(CdpWalletProvider.configureWithWallet).toHaveBeenCalledWith({
                cdpWalletData: '{"walletId":"existing-wallet"}',
                networkId: 'base-sepolia',
                apiKeyId: 'test-api-key-id',
                apiKeyPrivate: 'test-api-key-secret',
            });
            // Should NOT write wallet data when using existing wallet
            expect(fs.writeFileSync).not.toHaveBeenCalled();
            expect(client).toBe(mockClient);
        });

        it('should handle file read errors gracefully', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockImplementation(() => {
                throw new Error('File read error');
            });

            await expect(getClient()).rejects.toThrow('File read error');
        });

        it('should use custom network from environment variable', async () => {
            process.env.CDP_AGENT_KIT_NETWORK = 'custom-network';

            const mockWalletProvider = {
                address: '0x123',
                exportWallet: vi
                    .fn()
                    .mockResolvedValue({ walletId: 'test-wallet', seed: 'test-seed' }),
            };

            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(CdpWalletProvider.configureWithWallet).mockResolvedValue(mockWalletProvider);
            vi.mocked(AgentKit.from).mockResolvedValue({});

            await getClient();

            expect(CdpWalletProvider.configureWithWallet).toHaveBeenCalledWith({
                networkId: 'custom-network',
                apiKeyId: 'test-api-key-id',
                apiKeyPrivate: 'test-api-key-secret',
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

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join(process.cwd(), 'wallet_data.txt'),
                'string-wallet-data'
            );
            expect(client).toBeDefined();
        });
    });

    describe('walletProvider', () => {
        it('should return wallet address', async () => {
            const mockClient = {
                _walletProvider: { address: '0x1234567890abcdef' },
            };

            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(CdpWalletProvider.configureWithWallet).mockResolvedValue({
                address: '0x1234567890abcdef',
                exportWallet: vi.fn().mockResolvedValue({ walletId: 'test', seed: 'test' }),
            });
            vi.mocked(AgentKit.from).mockResolvedValue(mockClient);

            const result = await walletProvider.get();
            expect(result).toBe('AgentKit Wallet Address: 0x1234567890abcdef');
        });

        it('should handle errors and return error message', async () => {
            delete process.env.CDP_API_KEY_ID;
            delete process.env.CDP_API_KEY_SECRET;

            const result = await walletProvider.get();
            expect(result).toContain('Error: Missing required CDP API credentials');
        });
    });
});
