import { createPublicClient, http } from "viem";
import type { Abi, Chain } from "viem";
import predictionAddresses from "../../../../config/prediction-addresses.json";
import predictionAbiJson from "../../../../config/simpleCryptoPrediction.abi.json";

type NetworkKey = keyof typeof predictionAddresses;

const fallbackNetwork: NetworkKey = "alfajores";

const networkKey = (process.env.EXPO_PUBLIC_PREDICTION_NETWORK ??
  fallbackNetwork) as NetworkKey;

const networkConfig = predictionAddresses[networkKey];

if (!networkConfig) {
  throw new Error(
    `Unknown network "${networkKey}" in prediction-addresses.json.`
  );
}

const chain: Chain = {
  id: networkConfig.chainId,
  name:
    networkKey === "celo"
      ? "Celo Mainnet"
      : networkKey === "sepolia"
        ? "Celo Sepolia"
        : "Celo Alfajores",
  nativeCurrency: {
    decimals: 18,
    name: "Celo",
    symbol: "CELO",
  },
  rpcUrls: {
    default: { http: [networkConfig.rpcUrl] },
    public: { http: [networkConfig.rpcUrl] },
  },
};

export const predictionAbi = predictionAbiJson as Abi;

export const predictionContractAddress =
  (networkConfig.contractAddress as `0x${string}` | "") ?? "";

export const minBetWei = networkConfig.minBet
  ? BigInt(networkConfig.minBet)
  : 0n;
export const roundDurationSeconds = networkConfig.roundDuration
  ? BigInt(networkConfig.roundDuration)
  : 0n;

export const predictionNetwork = {
  key: networkKey,
  chain,
  rpcUrl: networkConfig.rpcUrl,
  displayName: chain.name,
  lastUpdated: networkConfig.updatedAt,
};

export const publicClient = createPublicClient({
  chain,
  transport: http(networkConfig.rpcUrl),
});
