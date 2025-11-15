import hre from "hardhat";
import path from "node:path";
import fs from "node:fs/promises";
import axios from "axios";

type DeploymentEntry = {
  contractAddress: string;
  chainId: number;
  rpcUrl?: string;
  minBet: string;
  roundDuration: string;
  updatedAt: string;
};

async function writeDeploymentToDisk(entry: DeploymentEntry) {
  const rootDir = path.resolve(__dirname, "../../..");
  const configDir = path.join(rootDir, "config");
  const outputFile = path.join(configDir, "prediction-addresses.json");

  await fs.mkdir(configDir, { recursive: true });

  let existing: Record<string, DeploymentEntry> = {};
  try {
    const raw = await fs.readFile(outputFile, "utf-8");
    existing = JSON.parse(raw);
  } catch {
    existing = {};
  }

  existing[hre.network.name] = entry;

  await fs.writeFile(outputFile, JSON.stringify(existing, null, 2));

  console.log(`\nUpdated ${outputFile} with ${hre.network.name} deployment.\n`);
}

async function fetchBtcPriceFromCoinGecko(): Promise<bigint> {
  try {
    console.log("Fetching BTC price from CoinGecko...");
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price",
      {
        params: {
          ids: "bitcoin",
          vs_currencies: "usd",
        },
        timeout: 10000,
      }
    );

    const price = response.data?.bitcoin?.usd;
    if (!price || typeof price !== "number") {
      throw new Error("Invalid price data from CoinGecko");
    }

    // Convert to 8 decimal places (e.g., $30,000 -> 3000000000000)
    const priceWithDecimals = BigInt(Math.round(price * 1e8));
    console.log(
      `Fetched BTC price: $${price} (${priceWithDecimals.toString()} with 8 decimals)`
    );
    return priceWithDecimals;
  } catch (error) {
    console.error("Failed to fetch price from CoinGecko:", error);
    throw new Error(
      "Failed to fetch BTC price from CoinGecko. Please check your internet connection or set INITIAL_PRICE environment variable as fallback."
    );
  }
}

// cUSD token addresses for each network
const cUSDAddresses: Record<string, string> = {
  alfajores: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
  celo: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  sepolia: "0xde9e4c3ce781b4ba68120d6261cbad65ce0ab00b",
};

async function main() {
  // Fetch initial price from CoinGecko, or use environment variable as fallback
  const initialPrice = await fetchBtcPriceFromCoinGecko();
  if (!initialPrice) {
    throw new Error("Failed to fetch BTC price from CoinGecko");
  }

  const networkName = hre.network.name;
  const cUSDAddress = cUSDAddresses[networkName];
  if (!cUSDAddress) {
    throw new Error(
      `cUSD address not configured for network: ${networkName}. Please add it to the deployment script.`
    );
  }

  const [deployer] = await hre.viem.getWalletClients();
  console.log(`Deploying with account: ${deployer.account.address}`);
  console.log(`Using cUSD address: ${cUSDAddress}`);

  const prediction = await hre.viem.deployContract(
    "SimpleCryptoPrediction" as any,
    [initialPrice, cUSDAddress] // Pass initialPrice and cUSD address
  );

  const contractAddress = prediction.address;
  console.log(
    `SimpleCryptoPrediction deployed to ${contractAddress} on ${hre.network.name}`
  );

  const publicClient = await hre.viem.getPublicClient();
  const minBet = (await publicClient.readContract({
    address: contractAddress,
    abi: prediction.abi,
    functionName: "minBet",
  })) as bigint;
  const roundDuration = (await publicClient.readContract({
    address: contractAddress,
    abi: prediction.abi,
    functionName: "roundDuration",
  })) as bigint;

  const networkConfig = hre.network.config as any;
  const entry: DeploymentEntry = {
    contractAddress,
    chainId: hre.network.config.chainId ?? 0,
    rpcUrl: networkConfig.url,
    minBet: minBet.toString(),
    roundDuration: roundDuration.toString(),
    updatedAt: new Date().toISOString(),
  };

  await writeDeploymentToDisk(entry);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
