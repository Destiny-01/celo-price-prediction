## MiniPay Prediction Mobile App

This Expo React Native app presents the on-chain BTC prediction market powered by `SimpleCryptoPrediction`

### Quick start

1. **Install dependencies:**

```bash
# From workspace root
pnpm install
```

2. **Set environment variables:**
   Create a `.env` file in `apps/mobile/` or set them in your shell:

```bash
EXPO_PUBLIC_PREDICTION_NETWORK=sepolia  # or alfajores, celo
```

3. **Verify contract deployment:**
   Ensure `config/prediction-addresses.json` has the contract address for your selected network. For sepolia, it should look like:

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

4. **Start the Expo development server:**

```bash
# From workspace root
pnpm --filter mobile start

# Or from apps/mobile directory
cd apps/mobile
pnpm start:tunnel
```

5. **Run on minipay:**

- Scan the qr code, or access the link (replace exp:// with https:// inside the minipay app)

**Troubleshooting:**

- If you get a 500 error, try the static build approach (Option 1)
- If you see a white screen, check the browser console for errors
- Make sure you're using the HTTPS URL, not HTTP
- For free ngrok accounts, the URL changes each time you restart

### Features

- Auto-connect to MiniPay when running in MiniPay's WebView (detects `window.ethereum.isMiniPay`)
- Display live round status, pools, and countdown
- Place predictions with the configured minimum stake
- Show personal bet history with outcomes
- Render a lightweight 24h BTC price chart using CoinGecko data
