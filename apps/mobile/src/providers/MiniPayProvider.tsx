import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BrowserProvider, type Eip1193Provider } from "ethers";
import {
  predictionAbi,
  predictionContractAddress,
  predictionNetwork,
} from "../config/contracts";
import { logger } from "../utils/logger";
import {
  parseEther,
  createWalletClient,
  custom,
  getContract,
  type Address,
} from "viem";

type WalletType = "minipay" | "metamask" | null;

type MiniPayContextValue = {
  address: string | null;
  isConnecting: boolean;
  providerReady: boolean;
  isMiniPay: boolean;
  walletType: WalletType;
  chainId: number | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  placeBet: (direction: boolean, amountInCUSD: string) => Promise<string>;
};

const MiniPayContext = createContext<MiniPayContextValue | undefined>(
  undefined
);

type MiniPayProviderProps = {
  children: ReactNode;
};

// Declare global window.ethereum for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var window:
    | {
        ethereum?: Eip1193Provider & {
          isMiniPay?: boolean;
          isMetaMask?: boolean;
          request: (args: {
            method: string;
            params?: unknown[];
          }) => Promise<unknown>;
          on?: (event: string, handler: (...args: unknown[]) => void) => void;
          removeListener?: (
            event: string,
            handler: (...args: unknown[]) => void
          ) => void;
          chainId?: string;
        };
        location?: {
          reload: () => void;
        };
      }
    | undefined;
}

export const MiniPayProvider = ({ children }: MiniPayProviderProps) => {
  const [browserProvider, setBrowserProvider] =
    useState<BrowserProvider | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const targetChainId = predictionNetwork.chain.id;
  const targetChainIdHex = `0x${targetChainId.toString(16)}`;

  // cUSD token addresses for fee currency (MiniPay requirement)
  const cUSDAddresses: Record<number, Address> = {
    44787: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1", // Alfajores
    42220: "0x765DE816845861e75A25fCA122bb6898B8B1282a", // Mainnet
    11142220: "0xde9e4c3ce781b4ba68120d6261cbad65ce0ab00b", // Sepolia (same as Alfajores)
  };

  // Network configuration for MetaMask (supports all Celo networks)
  const celoNetworkConfig = useMemo(() => {
    // Determine block explorer based on chain ID
    let blockExplorerUrl = "https://celo-sepolia.blockscout.com"; // Default to Sepolia
    if (targetChainId === 44787) {
      // Alfajores
      blockExplorerUrl = "https://alfajores.celoscan.io";
    } else if (targetChainId === 42220) {
      // Celo Mainnet
      blockExplorerUrl = "https://celoscan.io";
    } else if (targetChainId === 11142220) {
      // Celo Sepolia
      blockExplorerUrl = "https://celo-sepolia.blockscout.com";
    }

    return {
      chainId: targetChainIdHex,
      chainName: predictionNetwork.displayName,
      nativeCurrency: {
        name: "CELO",
        symbol: "CELO",
        decimals: 18,
      },
      rpcUrls: [predictionNetwork.rpcUrl],
      blockExplorerUrls: [blockExplorerUrl],
    };
  }, [
    targetChainIdHex,
    targetChainId,
    predictionNetwork.displayName,
    predictionNetwork.rpcUrl,
  ]);

  // Check for wallet availability and detect type
  useEffect(() => {
    const checkWallet = async () => {
      if (
        typeof globalThis !== "undefined" &&
        (globalThis as any).window?.ethereum
      ) {
        const ethereum = (globalThis as any).window.ethereum;

        // Detect wallet type
        if (ethereum.isMiniPay) {
          setIsMiniPay(true);
          setWalletType("minipay");
          logger.info("MiniPay detected");
        } else if (ethereum.isMetaMask) {
          setIsMiniPay(false);
          setWalletType("metamask");
          logger.info("MetaMask detected");
        } else {
          setWalletType("metamask"); // Default to MetaMask for any ethereum provider
          logger.info("Generic Ethereum provider detected");
        }

        // Check current chain ID
        try {
          const currentChainId = await ethereum.request({
            method: "eth_chainId",
          });
          const currentChainIdNum = parseInt(currentChainId as string, 16);
          setChainId(currentChainIdNum);
          logger.info("Current chain ID", { currentChainIdNum, targetChainId });
        } catch (error) {
          logger.error("Failed to get chain ID", error);
        }
      } else {
        logger.warn("No Ethereum provider found");
      }
    };

    checkWallet();
  }, [targetChainId]);

  // Auto-connect MiniPay when detected (separate effect to avoid dependency issues)
  useEffect(() => {
    const autoConnectMiniPay = async () => {
      if (
        typeof globalThis !== "undefined" &&
        (globalThis as any).window?.ethereum?.isMiniPay &&
        !address &&
        !isConnecting
      ) {
        try {
          logger.info("Auto-connecting to MiniPay");
          setIsConnecting(true);

          const ethereum = (globalThis as any).window.ethereum;
          const provider = new BrowserProvider(
            ethereum as Eip1193Provider,
            targetChainId
          );

          await ethereum.request({ method: "eth_requestAccounts" });
          const accounts = await provider.listAccounts();

          if (accounts.length > 0) {
            const connectedAddress = accounts[0].address;
            logger.info("MiniPay auto-connected", {
              address: connectedAddress,
            });
            setAddress(connectedAddress);
            setBrowserProvider(provider);

            const currentChainId = await ethereum.request({
              method: "eth_chainId",
            });
            const currentChainIdNum = parseInt(currentChainId as string, 16);
            setChainId(currentChainIdNum);
          }

          setIsConnecting(false);
        } catch (error) {
          logger.error("Auto-connect failed", error);
          setIsConnecting(false);
        }
      }
    };

    autoConnectMiniPay();
  }, [address, isConnecting, targetChainId]);

  // Listen for account and chain changes
  useEffect(() => {
    const win = (globalThis as any).window;
    if (!win?.ethereum) {
      return;
    }

    const handleAccountsChanged = (accounts: string[]) => {
      logger.info("Accounts changed", { accounts });
      setAddress(accounts[0] ?? null);
    };

    const handleChainChanged = (chainIdHex: string) => {
      const chainIdNum = parseInt(chainIdHex, 16);
      logger.info("Chain changed", { chainIdHex, chainIdNum, targetChainId });
      setChainId(chainIdNum);
      if (isMiniPay) {
        // Reload on chain change for MiniPay
        win.location?.reload();
      }
    };

    // Listen to events
    win.ethereum.on?.("accountsChanged", handleAccountsChanged);
    win.ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      win.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      win.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [isMiniPay, targetChainId]);

  const disconnect = useCallback(async () => {
    logger.info("Disconnecting wallet");
    setAddress(null);
    setBrowserProvider(null);
    setChainId(null);
    // Don't reset walletType - keep it so we know what wallet was used
  }, []);

  const switchNetwork = useCallback(async () => {
    const win = (globalThis as any).window;
    if (!win?.ethereum) {
      throw new Error("No Ethereum provider found.");
    }

    logger.info("Switching to network", {
      chainId: targetChainId,
      chainIdHex: targetChainIdHex,
      networkName: predictionNetwork.displayName,
    });

    try {
      // Try to switch to the network
      await win.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetChainIdHex }],
      });
      logger.info("Network switched successfully");
      setChainId(targetChainId);
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902 || switchError.code === -32603) {
        logger.info("Network not found, adding network");
        try {
          // Add the network
          await win.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [celoNetworkConfig],
          });
          logger.info("Network added successfully");
          setChainId(targetChainId);
        } catch (addError: any) {
          logger.error("Failed to add network", addError);
          throw new Error(
            `Failed to add ${predictionNetwork.displayName} network. Please add it manually in MetaMask.`
          );
        }
      } else {
        logger.error("Failed to switch network", switchError);
        throw switchError;
      }
    }
  }, [targetChainId, targetChainIdHex, celoNetworkConfig]);

  const connect = useCallback(async () => {
    if (address || isConnecting) {
      return;
    }

    const win = (globalThis as any).window;
    if (typeof globalThis === "undefined" || !win?.ethereum) {
      throw new Error(
        "No Ethereum provider found. Please install MetaMask or use MiniPay."
      );
    }

    setIsConnecting(true);
    logger.info("Connecting wallet", {
      isMiniPay: win.ethereum.isMiniPay,
      isMetaMask: win.ethereum.isMetaMask,
    });

    try {
      const ethereum = win.ethereum;

      // Detect wallet type
      if (ethereum.isMiniPay) {
        setIsMiniPay(true);
        setWalletType("minipay");
        logger.info("Connecting to MiniPay");
      } else {
        setIsMiniPay(false);
        setWalletType("metamask");
        logger.info("Connecting to MetaMask");

        // Check and switch network for MetaMask
        try {
          const currentChainId = await ethereum.request({
            method: "eth_chainId",
          });
          const currentChainIdNum = parseInt(currentChainId as string, 16);
          setChainId(currentChainIdNum);

          if (currentChainIdNum !== targetChainId) {
            logger.info("Network mismatch, switching network", {
              current: currentChainIdNum,
              target: targetChainId,
            });
            await switchNetwork();
          }
        } catch (networkError: any) {
          logger.error("Network switch error", networkError);
          // Continue with connection even if network switch fails
          // User can switch manually
        }
      }

      // Create provider
      const provider = new BrowserProvider(
        ethereum as Eip1193Provider,
        targetChainId
      );

      // Request account access
      logger.info("Requesting account access");
      await ethereum.request({ method: "eth_requestAccounts" });

      const accounts = await provider.listAccounts();
      if (accounts.length === 0) {
        throw new Error("No accounts found. Please unlock your wallet.");
      }

      const connectedAddress = accounts[0].address;
      logger.info("Wallet connected", { address: connectedAddress });

      setAddress(connectedAddress);
      setBrowserProvider(provider);

      // Verify chain ID
      const currentChainId = await ethereum.request({ method: "eth_chainId" });
      const currentChainIdNum = parseInt(currentChainId as string, 16);
      setChainId(currentChainIdNum);

      if (currentChainIdNum !== targetChainId && !ethereum.isMiniPay) {
        logger.warn("Chain ID mismatch", {
          current: currentChainIdNum,
          target: targetChainId,
        });
      }
    } catch (error: any) {
      logger.error("Connection failed", error);
      await disconnect();
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [address, targetChainId, disconnect, isConnecting, switchNetwork]);

  const placeBet = useCallback(
    async (direction: boolean, amountInCUSD: string) => {
      if (!address) {
        throw new Error(
          `Connect ${walletType === "metamask" ? "MetaMask" : "MiniPay"} before placing a bet.`
        );
      }

      const win = (globalThis as any).window;
      if (!win?.ethereum) {
        throw new Error("No Ethereum provider found.");
      }

      // Verify network for MetaMask
      if (walletType === "metamask" && chainId !== targetChainId) {
        throw new Error(
          `Wrong network. Please switch to ${predictionNetwork.displayName} (Chain ID: ${targetChainId}).`
        );
      }

      if (!predictionContractAddress) {
        throw new Error(
          "Prediction contract address not configured. Deploy and update config/prediction-addresses.json."
        );
      }

      // Parse amount to wei (same as parseEther, but for cUSD we use same decimals)
      const amount = parseEther(amountInCUSD.toString());
      logger.info("Preparing bet transaction", {
        direction,
        amountInCUSD,
        amountWei: amount.toString(),
        contractAddress: predictionContractAddress,
        isMiniPay,
      });

      try {
        // Create viem wallet client
        const walletClient = createWalletClient({
          chain: predictionNetwork.chain,
          transport: custom(win.ethereum),
        });

        // Get account from wallet
        const [account] = await walletClient.getAddresses();
        if (!account) {
          throw new Error("No account found in wallet");
        }

        // Get cUSD address
        const cUSDAddress = cUSDAddresses[targetChainId];
        if (!cUSDAddress) {
          throw new Error("cUSD address not found for chain");
        }

        // ERC20 ABI for approve
        const erc20Abi = [
          {
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            name: "approve",
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
            type: "function",
          },
        ] as const;

        // Step 1: Approve cUSD transfer
        logger.info("Approving cUSD transfer", {
          cUSDAddress,
          predictionContractAddress,
          amount: amount.toString(),
        });

        const cUSDContract = getContract({
          address: cUSDAddress,
          abi: erc20Abi,
          client: walletClient,
        });

        const approveTxHash = await cUSDContract.write.approve(
          [predictionContractAddress as Address, amount] as readonly [
            Address,
            bigint,
          ],
          {
            // @ts-ignore - feeCurrency is a Celo-specific property
            feeCurrency: cUSDAddress,
          }
        );

        logger.info("Waiting for approve confirmation", { approveTxHash });
        if (browserProvider) {
          await browserProvider.waitForTransaction(approveTxHash);
        }
        logger.info("cUSD approval confirmed");

        // Step 2: Place bet using writeContract
        logger.info("Placing bet", {
          direction,
          amount: amount.toString(),
          account,
        });

        const predictionContract = getContract({
          address: predictionContractAddress as Address,
          abi: predictionAbi as any,
          client: walletClient,
        });

        const txHash = await predictionContract.write.placeBet(
          [direction, amount],
          {
            account,
            // @ts-ignore - feeCurrency is a Celo-specific property
            feeCurrency: cUSDAddress,
          }
        );

        logger.info("Bet transaction sent", { txHash });

        // Wait for confirmation
        if (browserProvider) {
          const receipt = await browserProvider.waitForTransaction(txHash);
          if (receipt) {
            logger.info("Bet confirmed", {
              txHash: receipt.hash,
              blockNumber: receipt.blockNumber?.toString(),
            });
          }
        }

        return txHash;
      } catch (error: any) {
        logger.error("Bet transaction failed", {
          error: error.message,
          code: error.code,
          data: error.data,
          reason: error.reason,
        });

        // Provide more helpful error messages
        if (error.message?.includes("divide by zero")) {
          throw new Error(
            "Contract error: Division by zero detected. This might indicate the contract round hasn't been properly initialized. Please contact support or check the contract state."
          );
        }
        if (
          error.message?.includes("Round closed") ||
          error.message?.includes("ended")
        ) {
          throw new Error(
            "This round has ended. Please wait for the next round."
          );
        }
        if (error.message?.includes("Already bet")) {
          throw new Error("You have already placed a bet in this round.");
        }
        if (error.message?.includes("Low stake")) {
          const errorDetails = {
            amountInCUSD,
            amountWei: amount.toString(),
            minBet: "0.01 cUSD (10000000000000000 wei)",
            isMiniPay,
            feeCurrency: isMiniPay ? cUSDAddresses[targetChainId] : "N/A",
          };
          logger.error("Low stake error details", errorDetails);
          throw new Error(
            `Transaction failed: Low stake error. Sent: ${amountInCUSD} cUSD (${amount.toString()} wei), Minimum: 0.01 cUSD. ` +
              `This might be a MiniPay transaction formatting issue. Check transaction on block explorer.`
          );
        }
        if (error.code === -32603 || error.code === "UNKNOWN_ERROR") {
          // Check if it's a divide by zero error from RPC simulation
          const errorMessage =
            error.message ||
            error.error?.message ||
            JSON.stringify(error.error || {});
          logger.error("RPC error details", {
            errorMessage,
            fullError: error,
            errorCode: error.code,
          });

          if (
            errorMessage.includes("divide by zero") ||
            errorMessage.includes("BigInteger divide by zero") ||
            errorMessage.includes("biginteger divide by zerio")
          ) {
            throw new Error(
              "❌ Transaction Failed: Divide by Zero Error\n\n" +
                "The RPC provider detected a contract state issue during transaction validation. " +
                "This typically means:\n" +
                "1. The deployed contract needs to be updated\n" +
                "2. The contract state is inconsistent\n" +
                "3. The contract at " +
                predictionContractAddress +
                " may be an older version\n\n" +
                "Solution: Redeploy the contract with the latest fixes.\n" +
                "Run: INITIAL_PRICE=3000000000000 pnpm contracts:deploy:script:sepolia"
            );
          }
          throw new Error(
            `RPC error: ${errorMessage || "Internal JSON-RPC error"}. This might be a temporary network issue. Please try again.`
          );
        }

        throw error;
      }
    },
    [
      address,
      browserProvider,
      walletType,
      isMiniPay,
      chainId,
      targetChainId,
      predictionContractAddress,
      predictionNetwork.chain,
    ]
  );

  const contextValue = useMemo<MiniPayContextValue>(
    () => ({
      address,
      isConnecting,
      providerReady: Boolean(browserProvider && address),
      isMiniPay,
      walletType,
      chainId,
      connect,
      disconnect,
      switchNetwork,
      placeBet,
    }),
    [
      address,
      browserProvider,
      connect,
      disconnect,
      isConnecting,
      isMiniPay,
      walletType,
      chainId,
      switchNetwork,
      placeBet,
    ]
  );

  return (
    <MiniPayContext.Provider value={contextValue}>
      {children}
    </MiniPayContext.Provider>
  );
};

export const useMiniPay = () => {
  const context = useContext(MiniPayContext);
  if (!context) {
    throw new Error("useMiniPay must be used within MiniPayProvider");
  }
  return context;
};
