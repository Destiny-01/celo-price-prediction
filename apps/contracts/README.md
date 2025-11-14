# my-celo-app - Smart Contracts

This directory contains the smart contracts for my-celo-app, built with Hardhat and optimized for the Celo blockchain.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Compile contracts
pnpm compile

# Run tests
pnpm test

# Deploy with scripted helper and record addresses
pnpm deploy:script:sepolia
```

## 📜 Available Scripts

- `pnpm compile` - Compile smart contracts
- `pnpm test` - Run contract tests
- `pnpm deploy` - Deploy to local network
- `pnpm deploy:alfajores` - Deploy to Celo Alfajores testnet (Hardhat Ignition)
- `pnpm deploy:sepolia` - Deploy to Celo Sepolia testnet (Hardhat Ignition)
- `pnpm deploy:celo` - Deploy to Celo mainnet (Hardhat Ignition)
- `pnpm deploy:script[:network]` - Deploy with a scripted flow that also updates `config/prediction-addresses.json` for the mobile app
- `pnpm verify` - Verify contracts on Celoscan
- `pnpm clean` - Clean artifacts and cache

## 🌐 Networks

### Celo Mainnet

- **Chain ID**: 42220
- **RPC URL**: https://forno.celo.org
- **Explorer**: https://celoscan.io

### Alfajores Testnet

- **Chain ID**: 44787
- **RPC URL**: https://alfajores-forno.celo-testnet.org
- **Explorer**: https://alfajores.celoscan.io
- **Faucet**: https://faucet.celo.org

### Sepolia Testnet

- **Chain ID**: 11142220
- **RPC URL**: https://forno.celo-sepolia.celo-testnet.org
- **Explorer**: https://celo-sepolia.blockscout.com
- **Faucet**: https://faucet.celo.org/celo-sepolia

## 🔧 Environment Setup

1. Copy the environment template once it exists (or create a new `.env` file) and supply:
   ```env
   PRIVATE_KEY=your_private_key_without_0x_prefix
   CELOSCAN_API_KEY=your_celoscan_api_key
   ```

## 📁 Project Structure

```
contracts/          # Smart contract source files
├── Prediction.sol  # Simple prediction market contract

test/              # Contract tests
├── Prediction.ts        # Tests for Prediction contract

scripts/
└── deployPrediction.ts  # Deploy & persist contract metadata

hardhat.config.ts  # Hardhat configuration
tsconfig.json      # TypeScript configuration
```

## 🔐 Security Notes

- Never commit your `.env` file with real private keys
- Use a dedicated wallet for development/testing
- Test thoroughly on Sepolia before mainnet deployment
- Consider using a hardware wallet for mainnet deployments

## 📚 Learn More

- [Hardhat Documentation](https://hardhat.org/docs)
- [Celo Developer Documentation](https://docs.celo.org)
- [Celo Smart Contract Best Practices](https://docs.celo.org/developer/contractkit)
- [Viem Documentation](https://viem.sh) (Ethereum library used by Hardhat)
