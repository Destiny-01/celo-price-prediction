import { config as dotenvConfig } from "dotenv";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo, celoAlfajores } from "viem/chains";
import path from "node:path";
import fs from "node:fs/promises";

dotenvConfig();

// Custom chain for Celo Sepolia
const celoSepolia = {
  id: 11142220,
  name: "Celo Sepolia",
  network: "celo-sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "CELO",
    symbol: "CELO",
  },
  rpcUrls: {
    default: {
      http: ["https://forno.celo-sepolia.celo-testnet.org"],
    },
    public: {
      http: ["https://forno.celo-sepolia.celo-testnet.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Celo Sepolia Explorer",
      url: "https://celo-sepolia.blockscout.com",
    },
  },
  testnet: true,
};

type DeploymentEntry = {
  contractAddress: string;
  chainId: number;
  rpcUrl?: string;
  minBet: string;
  roundDuration: string;
  updatedAt: string;
};

const COINGECKO_ENDPOINT =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";

async function getContractConfig(network: string): Promise<{
  contractAddress: `0x${string}`;
  rpcUrl: string;
  chain: any;
}> {
  const rootDir = path.resolve(__dirname, "../../..");
  const configFile = path.join(rootDir, "config", "prediction-addresses.json");

  const raw = await fs.readFile(configFile, "utf-8");
  const config: Record<string, DeploymentEntry> = JSON.parse(raw);

  const networkConfig = config[network];
  if (!networkConfig) {
    throw new Error(
      `Network ${network} not found in config/prediction-addresses.json`
    );
  }

  if (!networkConfig.contractAddress) {
    throw new Error(
      `Contract address not set for network ${network}. Please deploy the contract first.`
    );
  }

  const rpcUrl = networkConfig.rpcUrl || "https://forno.celo.org";

  // Determine chain based on network
  let chain;
  switch (network) {
    case "celo":
      chain = celo;
      break;
    case "alfajores":
      chain = celoAlfajores;
      break;
    case "sepolia":
      chain = celoSepolia;
      break;
    default:
      throw new Error(`Unsupported network: ${network}`);
  }

  return {
    contractAddress: networkConfig.contractAddress as `0x${string}`,
    rpcUrl,
    chain,
  };
}

async function fetchBtcPrice(): Promise<number> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(COINGECKO_ENDPOINT, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(
          "CoinGecko rate limit exceeded. Please wait before retrying."
        );
      }
      throw new Error(
        `Failed to fetch BTC price from CoinGecko: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const price = data?.bitcoin?.usd;
    if (!price || typeof price !== "number") {
      throw new Error("Invalid price data from CoinGecko");
    }

    return price;
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Request to CoinGecko timed out");
    }
    if (error.message) {
      throw error;
    }
    throw new Error(
      `Failed to fetch BTC price from CoinGecko: ${error.message || "Unknown error"}`
    );
  }
}

async function loadContractABI(): Promise<any[]> {
  const rootDir = path.resolve(__dirname, "../../..");
  const abiFile = path.join(
    rootDir,
    "config",
    "simpleCryptoPrediction.abi.json"
  );

  const raw = await fs.readFile(abiFile, "utf-8");
  return JSON.parse(raw);
}

async function main() {
  console.log("=== Round Resolver Script ===\n");

  // Get environment variables
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "PRIVATE_KEY environment variable is required. Set it in GitHub Secrets or .env file."
    );
  }

  const network = process.env.NETWORK || "sepolia";
  console.log(`Network: ${network}`);

  // Get contract configuration
  const { contractAddress, rpcUrl, chain } = await getContractConfig(network);
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`RPC URL: ${rpcUrl}\n`);

  // Fetch current BTC price
  console.log("Fetching current BTC price from CoinGecko...");
  const btcPriceUsd = await fetchBtcPrice();
  console.log(`Current BTC Price: $${btcPriceUsd.toFixed(2)} USD\n`);

  // Convert price to contract format (8 decimals)
  // Contract expects int256, so we multiply by 1e8
  const priceInContractFormat = BigInt(Math.round(btcPriceUsd * 1e8));
  console.log(
    `Price in contract format: ${priceInContractFormat.toString()} (${btcPriceUsd} * 1e8)`
  );

  // Create wallet and public clients
  const account = privateKeyToAccount(
    `0x${privateKey.replace("0x", "")}` as `0x${string}`
  );
  console.log(`Using account: ${account.address}\n`);

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  // Load contract ABI
  const abi = await loadContractABI();

  // Check current round details before resolving
  console.log("Checking current round details...");
  const roundDetails = (await publicClient.readContract({
    address: contractAddress,
    abi: abi as any,
    functionName: "getRoundDetails",
    args: [],
  })) as unknown as readonly [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    boolean,
    boolean,
  ];

  const [
    roundId,
    startTime,
    endTime,
    startPrice,
    endPrice,
    upPool,
    downPool,
    resolved,
    upWon,
  ] = roundDetails;

  console.log(`Round ID: ${roundId.toString()}`);
  console.log(
    `Start Time: ${new Date(Number(startTime) * 1000).toISOString()}`
  );
  console.log(`End Time: ${new Date(Number(endTime) * 1000).toISOString()}`);
  console.log(`Start Price: ${startPrice.toString()}`);
  console.log(`Up Pool: ${upPool.toString()}`);
  console.log(`Down Pool: ${downPool.toString()}`);
  console.log(`Resolved: ${resolved}\n`);

  if (resolved) {
    console.log("⚠️  Round is already resolved. Skipping...");
    return;
  }

  // Call resolveRound
  console.log("Calling resolveRound...");
  console.log(`  End Price: ${priceInContractFormat.toString()}`);
  console.log(`  Next Start Price: ${priceInContractFormat.toString()}\n`);

  try {
    const hash = await walletClient.writeContract({
      address: contractAddress,
      abi: abi as any,
      functionName: "resolveRound",
      args: [priceInContractFormat, priceInContractFormat],
      chain: null,
    });

    console.log(`Transaction hash: ${hash}`);
    console.log("Waiting for transaction confirmation...");

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}\n`);

    // Check new round details
    console.log("Checking new round details...");
    const newRoundDetails = (await publicClient.readContract({
      address: contractAddress,
      abi: abi as any,
      functionName: "getRoundDetails",
      args: [],
    })) as unknown as readonly [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      boolean,
      boolean,
    ];

    const [newRoundId] = newRoundDetails;
    console.log(
      `✅ Round resolved successfully! New round ID: ${newRoundId.toString()}\n`
    );
  } catch (error: any) {
    console.error("❌ Error resolving round:");
    if (error.message) {
      console.error(`  ${error.message}`);
    } else {
      console.error(error);
    }
    throw error;
  }
}

main()
  .then(() => {
    console.log("Script completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
