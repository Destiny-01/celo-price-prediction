# GitHub Actions Setup for Round Resolver

This document explains how to set up GitHub Actions to automatically resolve prediction rounds daily at 12:00 AM UTC.

## Overview

The GitHub Actions workflow (`.github/workflows/resolve-round.yml`) automatically:

1. Runs daily at 12:00 AM UTC
2. Fetches the current BTC price from CoinGecko
3. Calls the contract's `resolveRound` function
4. Starts a new round with the current price

## Setup Instructions

### 1. Set Up GitHub Secrets

You need to add the following secrets to your GitHub repository:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add:

#### Required Secrets

- **`PRIVATE_KEY`**: The private key of the contract owner wallet (without `0x` prefix)
  - This wallet must be the owner of the contract (the one that deployed it)
  - **⚠️ WARNING**: Never commit this to your repository. Only store it in GitHub Secrets.

- **`NETWORK`** (optional): The network to use (`sepolia`, `alfajores`, or `celo`)
  - Defaults to `sepolia` if not set
  - Must match a network in `config/prediction-addresses.json`

### 2. Verify Contract Configuration

Ensure `config/prediction-addresses.json` has the contract address for your network:

```json
{
  "sepolia": {
    "contractAddress": "0x...",
    "chainId": 11142220,
    "rpcUrl": "https://forno.celo-sepolia.celo-testnet.org",
    ...
  }
}
```

### 3. Test Locally (Optional)

Before pushing to GitHub, you can test the resolver script locally:

1. Create a `.env` file in `apps/contracts/`:

   ```
   PRIVATE_KEY=your_private_key_here
   NETWORK=sepolia
   ```

2. Run the script:
   ```bash
   cd apps/contracts
   pnpm resolve-round
   ```

### 4. Manual Trigger

You can manually trigger the workflow:

1. Go to **Actions** tab in your GitHub repository
2. Select **Resolve Prediction Round** workflow
3. Click **Run workflow**

## How It Works

1. **Scheduled Execution**: GitHub Actions triggers the workflow daily at 12:00 AM UTC
2. **Price Fetching**: The script fetches the current BTC price from CoinGecko's simple price API
3. **Contract Interaction**: Uses viem to connect to the Celo network and call `resolveRound`
4. **Transaction**: Signs and sends the transaction using the private key from GitHub Secrets
5. **New Round**: The contract automatically starts a new round after resolution

## Monitoring

- Check the **Actions** tab in your GitHub repository to see workflow runs
- Each run shows logs of the execution
- Failed runs will show error messages in the logs

## Troubleshooting

### "PRIVATE_KEY environment variable is required"

- Make sure you've added `PRIVATE_KEY` to GitHub Secrets
- Verify the secret name matches exactly (case-sensitive)

### "Network not found in config"

- Ensure the network name in `NETWORK` secret matches a key in `config/prediction-addresses.json`
- Valid values: `sepolia`, `alfajores`, `celo`

### "Contract address not set"

- Deploy the contract first using the deployment scripts
- Verify the contract address is in `config/prediction-addresses.json`

### "Round is already resolved"

- This is normal if the workflow runs multiple times
- The script will skip resolution if the round is already resolved

### "Round has not ended yet"

- The script checks if the round has ended before resolving
- This prevents premature resolution

## Security Notes

- **Never commit private keys** to your repository
- Use GitHub Secrets for all sensitive data
- The private key must be from the contract owner wallet
- Consider using a dedicated wallet for the resolver with minimal funds
