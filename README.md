# AgentKit Plugin for ElizaOS

An ElizaOS plugin that integrates Coinbase's AgentKit for onchain AI agent interactions. This plugin enables your AI agents to perform blockchain operations using the latest AgentKit framework.

## Overview

This plugin provides seamless integration between ElizaOS and Coinbase's AgentKit, allowing your AI agents to:

- Manage crypto wallets
- Execute onchain transactions 
- Deploy smart contracts and tokens
- Interact with DeFi protocols
- Trade tokens and manage NFTs
- And much more with 50+ built-in actions!

## Recent Updates (v0.25.6-alpha.2)

🎉 **Updated to support the latest AgentKit (v0.8.2)!**

### Major Changes:
- **New Package Dependencies**: Now uses `@coinbase/agentkit` and `@coinbase/agentkit-langchain`
- **Updated Environment Variables**: `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` (see migration guide below)
- **50+ Built-in Actions**: Automatic access to all AgentKit action providers
- **Enhanced Architecture**: Built on the new modular action/wallet provider system
- **Better Error Handling**: Improved error messages and validation

## Installation

```bash
npm install @elizaos-plugins/plugin-agentkit
```

## Configuration

### Environment Variables

⚠️ **Important**: Environment variable names have changed in the latest version.

```bash
# Required - CDP API Credentials
CDP_API_KEY_ID=your_api_key_id          # Previously: CDP_API_KEY_NAME
CDP_API_KEY_SECRET=your_api_key_secret  # Previously: CDP_API_KEY_PRIVATE_KEY

# Optional - Network Configuration  
NETWORK_ID=base-sepolia                 # Previously: CDP_AGENT_KIT_NETWORK

# Optional - Wallet Persistence
CDP_WALLET_SECRET=your_wallet_secret    # New: For persistent wallet management
```

### Migration from v0.0.10

If you're upgrading from the old version, update your environment variables:

```bash
# Old (v0.0.10)
CDP_API_KEY_NAME=your_key_name
CDP_API_KEY_PRIVATE_KEY=your_private_key
CDP_AGENT_KIT_NETWORK=base-sepolia

# New (v0.8.2+)
CDP_API_KEY_ID=your_key_name
CDP_API_KEY_SECRET=your_private_key
NETWORK_ID=base-sepolia
```

## Usage

### In your ElizaOS character configuration:

```typescript
import { agentKitPlugin } from "@elizaos-plugins/plugin-agentkit";

const character = {
    // ... your character config
    plugins: [agentKitPlugin],
};
```

### Available Actions

The plugin automatically provides access to all AgentKit actions, including:

#### Wallet Management
- `GET_WALLET_DETAILS` - Get wallet address and balances
- `NATIVE_TRANSFER` - Transfer native tokens (ETH, etc.)

#### Token Operations  
- `DEPLOY_TOKEN` - Deploy ERC-20 tokens
- `ERC20_TRANSFER` - Transfer ERC-20 tokens
- `ERC20_GET_BALANCE` - Check token balances

#### NFT Operations
- `DEPLOY_NFT` - Deploy ERC-721 contracts
- `ERC721_MINT` - Mint NFTs
- `ERC721_TRANSFER` - Transfer NFTs

#### DeFi Protocols
- **Compound**: `SUPPLY`, `WITHDRAW`, `BORROW`, `REPAY`
- **Morpho**: `DEPOSIT`, `WITHDRAW`
- **Uniswap**: `TRADE` - Token swaps

#### Advanced Features
- `DEPLOY_CONTRACT` - Deploy custom smart contracts
- `REGISTER_BASENAME` - Register .base.eth domains
- `WRAP_ETH` - Convert ETH to WETH
- **Cross-chain**: Bridge tokens with Across Protocol
- **Social**: Post to Twitter/Farcaster
- **Data**: Price feeds from Pyth, DeFiLlama research

And many more! The plugin automatically discovers and registers all available actions.

## Supported Networks

- **EVM Chains**: Base, Ethereum, Arbitrum, Optimism, Polygon, and more
- **Solana**: Full Solana ecosystem support
- **Testnets**: Base Sepolia, Ethereum Sepolia, Solana Devnet

## Error Handling

The plugin includes comprehensive error handling:

- **Missing Credentials**: Gracefully handles missing API keys
- **Network Issues**: Retries and fallback mechanisms  
- **Transaction Failures**: Detailed error reporting
- **Wallet Persistence**: Automatic wallet backup and recovery

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm run test
```

### Linting

```bash
npm run lint:fix
```

## Troubleshooting

### Common Issues

1. **"Missing CDP API credentials"**
   - Ensure `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` are set
   - Check that your API key is active on the Coinbase Developer Platform

2. **"AgentKit actions will not be available"**
   - This is a warning - the plugin will load but won't have onchain capabilities
   - Add your CDP credentials to enable full functionality

3. **Wallet persistence issues**
   - The plugin automatically saves wallet data to `wallet_data.txt`
   - Ensure your application has write permissions in its directory

### Getting CDP API Keys

1. Visit [Coinbase Developer Platform](https://portal.cdp.coinbase.com)
2. Create a new project
3. Generate API keys
4. Copy the Key ID and Key Secret to your environment variables

## 🐛 Troubleshooting

### "No action found for GET_WALLET_DETAILS" Error

If you encounter this error, it means ElizaOS cannot find the wallet details action. This has been addressed in version 0.25.6-alpha.5 with the following fixes:

1. **Enhanced Action Discovery**: The plugin now logs all available AgentKit tools during initialization
2. **Manual Fallback**: If `get_wallet_details` is not available from AgentKit, the plugin automatically adds a manual implementation
3. **Improved Similes**: Added more natural language variations for triggering wallet actions

**Debug Output**: When the plugin initializes, you should see logs like:
```
🔧 Available AgentKit tools: [...]
🎯 Generated ElizaOS actions: [...]
⚠️ get_wallet_details not found in tools, adding manual fallback (if needed)
```

### Actions Not Loading

If actions are not loading properly:

1. **Check Environment Variables**: Ensure `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` are set
2. **Check Logs**: Look for initialization messages in the console
3. **Async Loading**: Actions load asynchronously - they may take a moment to become available

### Plugin Version

Current version: **0.25.6-alpha.7**
- ✅ Fixed wallet details action availability
- ✅ Added comprehensive debugging
- ✅ Improved error handling
- ✅ Enhanced natural language understanding
- ✅ **NEW**: Clean code quality with proper TypeScript types
- ✅ **NEW**: Fixed all linting issues and removed `any` types
- ✅ **NEW**: Proper Node.js import protocols and type safety

## Links

- [AgentKit Documentation](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com)
- [ElizaOS Documentation](https://elizaos.github.io/eliza/)

## License

This plugin is licensed under the same terms as the AgentKit framework.

## Contributing

Contributions are welcome! Please see the AgentKit repository for contribution guidelines.

---

**Note**: This plugin is based on Coinbase's AgentKit framework and requires valid CDP API credentials for full functionality.
