import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LineChart } from "react-native-chart-kit";
import { isAddress } from "ethers";
import {
  fetchCurrentRound,
  fetchUserRounds,
  formatWeiToCUSD,
} from "../api/prediction";
import { fetchDailyBtcHistory } from "../api/prices";
import { useCountdown } from "../hooks/useCountdown";
import {
  minBetWei,
  predictionNetwork,
  publicClient,
} from "../config/contracts";
import { useMiniPay } from "../providers/MiniPayProvider";
import { logger, type LogEntry } from "../utils/logger";

const screenWidth = Dimensions.get("window").width;
const chartWidth = screenWidth - 48;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  navBar: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  navBrand: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  navLabel: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  navMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  navPill: {
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  navPillLabel: {
    fontSize: 12,
    color: "#94a3b8",
  },
  navPillValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  navButton: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  hero: {
    alignItems: "center",
    paddingVertical: 24,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0f172a",
  },
  heroSubtitle: {
    fontSize: 16,
    color: "#475569",
    marginTop: 8,
  },
  heroCountdown: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#0ea5e9",
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  infoCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  infoLabel: {
    fontSize: 13,
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 6,
  },
  optionsRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  optionCard: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  optionSelected: {
    borderColor: "#0ea5e9",
    shadowOpacity: 0.12,
  },
  optionLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  optionText: {
    marginTop: 8,
    fontSize: 14,
    color: "#475569",
  },
  optionPrice: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  stakeInput: {
    alignSelf: "center",
    width: "70%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: "#0ea5e9",
    textAlign: "center",
    fontSize: 24,
    fontWeight: "600",
    color: "#0f172a",
    marginTop: 12,
  },
  helperText: {
    alignSelf: "center",
    marginTop: 8,
    color: "#64748b",
  },
  stakeButton: {
    marginTop: 20,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  stakeButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f8fafc",
  },
  sectionCard: {
    marginTop: 24,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  chartWrapper: {
    borderRadius: 20,
    overflow: "hidden",
  },
  historyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#f8fafc",
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  historyMeta: {
    marginTop: 6,
    color: "#475569",
  },
  historyCardWon: {
    backgroundColor: "#dcfce7",
    borderColor: "#16a34a",
  },
  historyCardLost: {
    backgroundColor: "#fee2e2",
    borderColor: "#dc2626",
  },
  historyTitleWon: {
    color: "#166534",
  },
  historyTitleLost: {
    color: "#991b1b",
  },
  historyMetaWon: {
    color: "#166534",
  },
  historyMetaLost: {
    color: "#991b1b",
  },
  historyStatus: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
  },
  historyStatusWon: {
    color: "#16a34a",
  },
  historyStatusLost: {
    color: "#dc2626",
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#94a3b8",
  },
  logButton: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0ea5e9",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    zIndex: 1000,
  },
  logButtonText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  logModal: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  logContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    padding: 20,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  logTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  logClearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fee2e2",
  },
  logClearText: {
    color: "#b91c1c",
    fontSize: 14,
    fontWeight: "600",
  },
  logList: {
    maxHeight: 400,
  },
  logEntry: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: "#f8fafc",
  },
  logEntryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  logEntryTime: {
    fontSize: 11,
    color: "#64748b",
    fontFamily: "monospace",
  },
  logEntryLevel: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logEntryMessage: {
    fontSize: 13,
    color: "#0f172a",
    fontFamily: "monospace",
  },
  logEntryData: {
    marginTop: 4,
    fontSize: 11,
    color: "#475569",
    fontFamily: "monospace",
  },
});

const formatTimestamp = (timestamp: bigint) => {
  if (!timestamp) return "-";
  return new Date(Number(timestamp) * 1000).toLocaleString();
};

const minBetInCUSD =
  minBetWei > 0n ? parseFloat(formatWeiToCUSD(minBetWei, 4)) : 0.01;

const PredictionScreen = () => {
  const {
    address,
    connect,
    disconnect,
    isConnecting,
    providerReady,
    isMiniPay,
    walletType,
    chainId,
    switchNetwork,
    placeBet,
  } = useMiniPay();
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [stake, setStake] = useState<string>(minBetInCUSD.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    logger.info("PredictionScreen mounted");
    setLogs(logger.getLogs());
    const unsubscribe = logger.subscribe(() => {
      setLogs(logger.getLogs());
    });
    return unsubscribe;
  }, []);

  const {
    data: currentRound,
    isFetching: fetchingRound,
    refetch: refetchRound,
  } = useQuery({
    queryKey: ["prediction", "currentRound"],
    queryFn: fetchCurrentRound,
    refetchInterval: 15000,
  });

  const { data: priceHistory, isFetching: fetchingPrices } = useQuery({
    queryKey: ["prediction", "priceHistory"],
    queryFn: fetchDailyBtcHistory,
    staleTime: 1 * 30 * 1000, // 10 minutes - data is considered fresh for 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache for 30 minutes
    refetchInterval: 1 * 30 * 1000, // Refetch every 10 minutes (aligned with staleTime)
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
    refetchOnMount: false, // Don't refetch on component mount if data is fresh
    refetchOnReconnect: false, // Don't refetch on reconnect
    retry: 1, // Reduced to 1 retry to avoid hitting rate limit on retries
    retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 60000), // Exponential backoff with longer delays
  });

  const {
    data: userRounds,
    isFetching: fetchingHistory,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["prediction", "userRounds", address],
    queryFn: () => fetchUserRounds(address as `0x${string}`),
    enabled: Boolean(address && isAddress(address)),
    refetchInterval: 30000,
  });

  // Get cUSD balance from ERC20 token
  const { data: walletBalance, isFetching: fetchingBalance } = useQuery({
    queryKey: ["prediction", "walletBalance", address],
    queryFn: async () => {
      if (!address) {
        return 0n;
      }
      // Get cUSD address for current network
      const cUSDAddresses: Record<number, string> = {
        44787: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1", // Alfajores
        42220: "0x765DE816845861e75A25fCA122bb6898B8B1282a", // Mainnet
        11142220: "0xde9e4c3ce781b4ba68120d6261cbad65ce0ab00b", // Sepolia
      };
      const cUSDAddress = cUSDAddresses[predictionNetwork.chain.id];
      if (!cUSDAddress) return 0n;

      // ERC20 balanceOf ABI
      const erc20Abi = [
        {
          inputs: [{ name: "account", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ] as const;

      // Get cUSD balance
      return (await publicClient.readContract({
        address: cUSDAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      })) as bigint;
    },
    enabled: Boolean(address),
    refetchInterval: 60000, // Refresh every 60 seconds instead of 20
  });

  const countdown = useCountdown(currentRound ? currentRound.endTime : null);

  const shortenedAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : walletType === "metamask"
      ? "MetaMask not connected"
      : walletType === "minipay"
        ? "MiniPay not connected"
        : "Wallet not connected";

  const walletLabel =
    walletType === "metamask"
      ? "MetaMask"
      : walletType === "minipay"
        ? "MiniPay"
        : "Wallet";

  const isCorrectNetwork = chainId === predictionNetwork.chain.id;
  const networkStatus = address
    ? isCorrectNetwork
      ? "✓ Connected"
      : `⚠ Wrong Network (${chainId || "Unknown"})`
    : "";

  const walletBalanceLabel =
    walletBalance && walletBalance > 0n
      ? formatWeiToCUSD(walletBalance, 3)
      : "0.000";

  const roundIdLabel = currentRound
    ? `Round #${currentRound.roundId.toString()}`
    : "Round loading…";
  const countdownLabel = currentRound
    ? currentRound.resolved
      ? "Settled"
      : countdown.totalMilliseconds > 0
        ? countdown.label
        : "Resolving"
    : "Awaiting data";

  const startPriceLabel = currentRound
    ? `$${(Number(currentRound.startPrice) / 1e8).toFixed(2)}`
    : "--";
  const endPriceLabel =
    currentRound && currentRound.resolved
      ? `$${(Number(currentRound.endPrice) / 1e8).toFixed(2)}`
      : "-";
  // Get current price from the latest price history data point
  const currentPriceLabel = useMemo(() => {
    if (priceHistory && priceHistory.length > 0) {
      // Get the most recent price (last item in the array)
      const latestPrice = priceHistory[priceHistory.length - 1].price;
      return `$${latestPrice.toFixed(2)}`;
    }
    return "--";
  }, [priceHistory]);
  const endTimeLabel = currentRound
    ? formatTimestamp(currentRound.endTime)
    : "--";

  const optionStats = useMemo(() => {
    if (!currentRound) {
      return {
        upPool: "--",
        downPool: "--",
        upPayout: "--",
        downPayout: "--",
      };
    }

    const upPool = parseFloat(formatWeiToCUSD(currentRound.upPool, 4));
    const downPool = parseFloat(formatWeiToCUSD(currentRound.downPool, 4));
    const total = upPool + downPool;
    const safeUpPayout =
      upPool > 0 && Number.isFinite(total / upPool)
        ? (total / upPool).toFixed(2)
        : "1.00";
    const safeDownPayout =
      downPool > 0 && Number.isFinite(total / downPool)
        ? (total / downPool).toFixed(2)
        : "1.00";

    return {
      upPool: `${formatWeiToCUSD(currentRound.upPool)} cUSD`,
      downPool: `${formatWeiToCUSD(currentRound.downPool)} cUSD`,
      upPayout: `1 cUSD → ${safeUpPayout} cUSD`,
      downPayout: `1 cUSD → ${safeDownPayout} cUSD`,
    };
  }, [currentRound]);

  const navButtonLabel = address
    ? "Disconnect"
    : isConnecting
      ? "Connecting…"
      : `Connect ${walletLabel}`;

  const navButtonBackground = address ? "#fee2e2" : "#0ea5e9";
  const navButtonTextColor = address ? "#b91c1c" : "#f8fafc";

  const isRoundLoading = fetchingRound && !currentRound;

  const chartData = useMemo(() => {
    if (!priceHistory || priceHistory.length === 0) {
      return {
        labels: [],
        datasets: [{ data: [], strokeWidth: 2, color: () => "#38bdf8" }],
      };
    }

    const dataset = priceHistory.map((point) => point.price);

    // Reduce labels for mobile - only show every Nth label to avoid cramping
    // For 30 minutes of data, show ~5-6 labels max
    const labelInterval = Math.max(1, Math.floor(priceHistory.length / 5));
    const labels = priceHistory.map((point, index) => {
      // Only show label for every Nth point, or first/last
      if (
        index === 0 ||
        index === priceHistory.length - 1 ||
        index % labelInterval === 0
      ) {
        return new Date(point.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return ""; // Empty string for skipped labels
    });

    return {
      labels,
      datasets: [
        {
          data: dataset,
          strokeWidth: 2,
          color: () => "#38bdf8",
        },
      ],
    };
  }, [priceHistory]);

  const onPlaceBet = async () => {
    logger.info("onPlaceBet invoked", { address, direction, stake });
    if (!address) {
      logger.info("No address detected, attempting connection");
      try {
        await connect();
      } catch (error) {
        logger.error("Connection failed", error);
      }
      return;
    }

    const numericStake = Number(stake);
    logger.debug("Parsed stake value", { numericStake, original: stake });
    if (!Number.isFinite(numericStake) || numericStake <= 0) {
      logger.warn("Invalid stake value", { numericStake });
      Alert.alert("Invalid stake", "Enter a valid cUSD amount.");
      return;
    }

    if (numericStake < minBetInCUSD) {
      logger.warn("Stake below minimum", { numericStake, minBetInCUSD });
      Alert.alert(
        "Stake too low",
        `Minimum stake is ${minBetInCUSD.toFixed(4)} cUSD.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      logger.info("Sending bet to contract", {
        direction: direction === "up" ? "UP" : "DOWN",
        numericStake,
        stakeInWei: (numericStake * 1e18).toString(),
      });
      const txHash = await placeBet(
        direction === "up",
        numericStake.toString()
      );
      logger.info("Bet transaction submitted", { txHash });
      Alert.alert("Bet placed", "Your prediction was submitted to MiniPay.");
      logger.info("Refreshing round and history data");
      await Promise.all([refetchRound(), refetchHistory()]);
      logger.info("Data refresh complete");
    } catch (error) {
      logger.error("Bet failed", error);
      const message =
        error instanceof Error ? error.message : "Bet failed. Try again.";
      Alert.alert("Bet failed", message);
    } finally {
      setIsSubmitting(false);
      logger.debug("Submission flow finished");
    }
  };

  const getLogLevelStyle = (level: string) => {
    switch (level) {
      case "error":
        return { backgroundColor: "#fee2e2", color: "#b91c1c" };
      case "warn":
        return { backgroundColor: "#fef3c7", color: "#d97706" };
      case "debug":
        return { backgroundColor: "#e0e7ff", color: "#6366f1" };
      default:
        return { backgroundColor: "#dbeafe", color: "#0ea5e9" };
    }
  };

  const formatLogData = (data: unknown): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  // Check if user has already placed a bet in the current round
  const hasBetInCurrentRound = useMemo(() => {
    if (!address || !currentRound || !userRounds) {
      return false;
    }
    // Check if any user round matches the current round ID and has a bet
    return userRounds.some(
      (entry) =>
        entry.round.roundId === currentRound.roundId && entry.bet.amount > 0n
    );
  }, [address, currentRound, userRounds]);

  const betButtonLabel = address
    ? isCorrectNetwork
      ? `Stake ${stake || "0"} cUSD`
      : "Switch Network First"
    : `Connect ${walletLabel}`;

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <View>
          <Text style={styles.navBrand}>MiniPay Predictor</Text>
          <Text style={styles.navLabel}>{shortenedAddress}</Text>
          {networkStatus ? (
            <Text
              style={[
                styles.navLabel,
                {
                  fontSize: 10,
                  marginTop: 2,
                  color: isCorrectNetwork ? "#16a34a" : "#dc2626",
                },
              ]}
            >
              {networkStatus} · {walletLabel} · Chain: {chainId || "?"}
            </Text>
          ) : null}
        </View>
        <View style={styles.navMeta}>
          <View style={styles.navPill}>
            <Text style={styles.navPillLabel}>Balance</Text>
            <Text style={styles.navPillValue}>
              {address
                ? fetchingBalance
                  ? "…"
                  : `${walletBalanceLabel} cUSD`
                : "--"}
            </Text>
          </View>
          {address && !isCorrectNetwork && walletType === "metamask" ? (
            <TouchableOpacity
              style={[
                styles.navButton,
                {
                  marginLeft: 12,
                  backgroundColor: "#f59e0b",
                  opacity: isConnecting ? 0.7 : 1,
                },
              ]}
              onPress={switchNetwork}
              disabled={isConnecting}
            >
              <Text style={[styles.navButtonText, { color: "#ffffff" }]}>
                Switch Network
              </Text>
            </TouchableOpacity>
          ) : null}
          {!isMiniPay && (
            <TouchableOpacity
              style={[
                styles.navButton,
                {
                  marginLeft: 12,
                  backgroundColor: navButtonBackground,
                  opacity: isConnecting && !address ? 0.7 : 1,
                },
              ]}
              onPress={address ? disconnect : connect}
              disabled={isConnecting && !address}
            >
              <Text
                style={[styles.navButtonText, { color: navButtonTextColor }]}
              >
                {navButtonLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            tintColor="#0ea5e9"
            refreshing={fetchingRound || fetchingHistory}
            onRefresh={() => {
              refetchRound();
              if (address) {
                refetchHistory();
              }
            }}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>MiniPay Predictor</Text>
          <Text style={styles.heroSubtitle}>
            BTC Price Prediction · {roundIdLabel}
          </Text>
          {isRoundLoading ? (
            <ActivityIndicator style={{ marginTop: 12 }} color="#0ea5e9" />
          ) : (
            <Text style={styles.heroCountdown}>{countdownLabel}</Text>
          )}
        </View>

        <View style={styles.infoRow}>
          <View style={[styles.infoCard, { marginRight: 8 }]}>
            <Text style={styles.infoLabel}>Network</Text>
            <Text style={styles.infoValue}>
              {predictionNetwork.displayName}
            </Text>
          </View>
          <View style={[styles.infoCard, { marginLeft: 8 }]}>
            <Text style={styles.infoLabel}>Start Price</Text>
            <Text style={styles.infoValue}>{startPriceLabel}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={[styles.infoCard, { marginRight: 8 }]}>
            <Text style={styles.infoLabel}>Ends At</Text>
            <Text style={styles.infoValue}>{endTimeLabel}</Text>
          </View>
          <View style={[styles.infoCard, { marginLeft: 8 }]}>
            <Text style={styles.infoLabel}>Current Price</Text>
            <Text style={styles.infoValue}>{currentPriceLabel}</Text>
          </View>
        </View>

        <View style={styles.optionsRow}>
          {(["up", "down"] as const).map((option) => {
            const isSelected = direction === option;
            const isUp = option === "up";
            const optionColor = isUp ? "#16a34a" : "#dc2626";
            const textColor = isSelected ? optionColor : "#0f172a";
            const poolLabel = isUp ? optionStats.upPool : optionStats.downPool;
            const payoutLabel = isUp
              ? optionStats.upPayout
              : optionStats.downPayout;

            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.optionCard,
                  option === "up" ? { marginRight: 8 } : { marginLeft: 8 },
                  isSelected ? styles.optionSelected : undefined,
                ]}
                onPress={() => setDirection(option)}
                activeOpacity={0.9}
              >
                <Text style={[styles.optionLabel, { color: textColor }]}>
                  {isUp ? "Price Up" : "Price Down"}
                </Text>
                <Text style={styles.optionText}>
                  {isUp
                    ? "BTC closes higher this round."
                    : "BTC settles lower than it started."}
                </Text>
                <Text style={styles.optionText}>Pool · {poolLabel}</Text>
                <Text style={[styles.optionPrice, { color: textColor }]}>
                  {payoutLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!hasBetInCurrentRound && (
          <>
            <TextInput
              style={styles.stakeInput}
              keyboardType="decimal-pad"
              placeholder={`Stake (min ${minBetInCUSD.toFixed(2)} cUSD)`}
              placeholderTextColor="#94a3b8"
              value={stake}
              onChangeText={setStake}
            />
            <Text style={styles.helperText}>
              {`Predicting ${direction.toUpperCase()} · Minimum ${minBetInCUSD.toFixed(
                2
              )} cUSD`}
            </Text>
          </>
        )}

        <TouchableOpacity
          style={[
            styles.stakeButton,
            {
              backgroundColor: hasBetInCurrentRound
                ? "#6b7280"
                : address && isCorrectNetwork
                  ? "#0ea5e9"
                  : address && !isCorrectNetwork
                    ? "#f59e0b"
                    : "#6366f1",
              opacity:
                hasBetInCurrentRound ||
                isSubmitting ||
                (address && !isCorrectNetwork)
                  ? 0.7
                  : 1,
            },
          ]}
          onPress={
            hasBetInCurrentRound
              ? undefined
              : address && !isCorrectNetwork && walletType === "metamask"
                ? switchNetwork
                : onPlaceBet
          }
          disabled={Boolean(
            hasBetInCurrentRound ||
              isSubmitting ||
              (address && !isCorrectNetwork && walletType !== "metamask")
          )}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.stakeButtonText}>
              {hasBetInCurrentRound ? "Already Staked" : betButtonLabel}
            </Text>
          )}
        </TouchableOpacity>

        {hasBetInCurrentRound && (
          <Text style={styles.helperText}>
            You have already placed a bet in this round
          </Text>
        )}
        {!providerReady && address ? (
          <Text style={styles.helperText}>
            Waiting for {walletLabel} session to become ready…
          </Text>
        ) : null}
        {address && !isCorrectNetwork ? (
          <Text style={[styles.helperText, { color: "#dc2626" }]}>
            ⚠ Please switch to {predictionNetwork.displayName} (Chain ID:{" "}
            {predictionNetwork.chain.id}) to place bets.
          </Text>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>BTC 30m Trend</Text>
              <Text style={styles.sectionSubtitle}>
                Updated live every few seconds
              </Text>
            </View>
            {fetchingPrices ? <ActivityIndicator color="#0ea5e9" /> : null}
          </View>
          {priceHistory && priceHistory.length > 0 ? (
            <View style={styles.chartWrapper}>
              <LineChart
                data={chartData}
                width={chartWidth}
                height={220}
                withInnerLines={false}
                withDots={false}
                segments={4}
                chartConfig={{
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
                  labelColor: (opacity = 1) =>
                    `rgba(100, 116, 139, ${opacity})`,
                  propsForBackgroundLines: {
                    strokeDasharray: "",
                    strokeWidth: 0,
                  },
                  propsForLabels: {
                    fontSize: 10,
                  },
                }}
                bezier
                style={{ borderRadius: 20 }}
                formatXLabel={(label) => {
                  // Return empty string for empty labels to skip rendering
                  if (!label || label.trim() === "") return "";
                  return label;
                }}
              />
            </View>
          ) : (
            <Text style={styles.sectionSubtitle}>
              Unable to fetch recent BTC price history.
            </Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your predictions</Text>
            {fetchingHistory ? <ActivityIndicator color="#0ea5e9" /> : null}
          </View>
          {address ? (
            userRounds && userRounds.length > 0 ? (
              <>
                {userRounds
                  .sort(
                    (a, b) => Number(b.round.roundId) - Number(a.round.roundId)
                  )
                  .map((item) => {
                    // Calculate if user won
                    const isResolved = item.round.resolved;
                    const userWon =
                      isResolved && item.round.upWon === item.bet.direction;
                    const userLost = isResolved && !userWon;

                    // Calculate reward for winners
                    let rewardAmount = 0n;
                    if (userWon) {
                      const rewardPool = item.round.upWon
                        ? item.round.downPool
                        : item.round.upPool;
                      const winnerPool = item.round.upWon
                        ? item.round.upPool
                        : item.round.downPool;

                      if (rewardPool > 0n && winnerPool > 0n) {
                        // Winners get bet back + proportional share of loser pool
                        const proportionalReward =
                          (item.bet.amount * rewardPool) / winnerPool;
                        rewardAmount = item.bet.amount + proportionalReward;
                      } else {
                        // No losers: just get bet back
                        rewardAmount = item.bet.amount;
                      }
                    }

                    // Determine card style based on status
                    const cardStyle = [
                      styles.historyCard,
                      userWon && styles.historyCardWon,
                      userLost && styles.historyCardLost,
                    ];

                    return (
                      <View
                        key={`${item.round.roundId.toString()}-${
                          item.bet.direction
                        }`}
                        style={cardStyle}
                      >
                        <Text
                          style={[
                            styles.historyTitle,
                            userWon && styles.historyTitleWon,
                            userLost && styles.historyTitleLost,
                          ]}
                        >
                          Round #{item.round.roundId.toString()}
                        </Text>
                        <Text
                          style={[
                            styles.historyMeta,
                            userWon && styles.historyMetaWon,
                            userLost && styles.historyMetaLost,
                          ]}
                        >
                          {item.bet.direction ? "⬆️ Up" : "⬇️ Down"} ·{" "}
                          {formatWeiToCUSD(item.bet.amount)} cUSD
                        </Text>
                        {isResolved ? (
                          userWon ? (
                            <>
                              <Text
                                style={[
                                  styles.historyStatus,
                                  styles.historyStatusWon,
                                ]}
                              >
                                ✅ Won
                              </Text>
                              <Text
                                style={[
                                  styles.historyMeta,
                                  styles.historyMetaWon,
                                ]}
                              >
                                Bet: {formatWeiToCUSD(item.bet.amount)} cUSD
                              </Text>
                              <Text
                                style={[
                                  styles.historyMeta,
                                  styles.historyMetaWon,
                                ]}
                              >
                                Received: {formatWeiToCUSD(rewardAmount)} cUSD
                              </Text>
                              <Text
                                style={[
                                  styles.historyMeta,
                                  styles.historyMetaWon,
                                ]}
                              >
                                Profit:{" "}
                                {formatWeiToCUSD(
                                  rewardAmount - item.bet.amount
                                )}{" "}
                                cUSD
                              </Text>
                            </>
                          ) : (
                            <>
                              <Text
                                style={[
                                  styles.historyStatus,
                                  styles.historyStatusLost,
                                ]}
                              >
                                ❌ Lost
                              </Text>
                              <Text
                                style={[
                                  styles.historyMeta,
                                  styles.historyMetaLost,
                                ]}
                              >
                                Lost: {formatWeiToCUSD(item.bet.amount)} cUSD
                              </Text>
                            </>
                          )
                        ) : (
                          <Text
                            style={[
                              styles.historyMeta,
                              userWon && styles.historyMetaWon,
                              userLost && styles.historyMetaLost,
                            ]}
                          >
                            Pending resolution
                          </Text>
                        )}
                        <Text
                          style={[
                            styles.historyMeta,
                            userWon && styles.historyMetaWon,
                            userLost && styles.historyMetaLost,
                          ]}
                        >
                          {isResolved
                            ? `Resolved ${formatTimestamp(item.round.endTime)}`
                            : `Ends ${formatTimestamp(item.round.endTime)}`}
                        </Text>
                      </View>
                    );
                  })}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  No MiniPay predictions yet. Place your first bet above.
                </Text>
              </View>
            )
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                Connect MiniPay to see your history.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.logButton}
        onPress={() => setShowLogs(true)}
      >
        <Text style={styles.logButtonText}>📋</Text>
      </TouchableOpacity>

      <Modal
        visible={showLogs}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLogs(false)}
      >
        <View style={styles.logModal}>
          <View style={styles.logContainer}>
            <View style={styles.logHeader}>
              <Text style={styles.logTitle}>Debug Logs</Text>
              <View style={{ flexDirection: "row" }}>
                <TouchableOpacity
                  style={styles.logClearButton}
                  onPress={() => {
                    logger.clearLogs();
                  }}
                >
                  <Text style={styles.logClearText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.logClearButton,
                    { backgroundColor: "#e2e8f0", marginLeft: 8 },
                  ]}
                  onPress={() => setShowLogs(false)}
                >
                  <Text style={[styles.logClearText, { color: "#475569" }]}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.logList}>
              {logs.length === 0 ? (
                <Text style={styles.emptyText}>No logs yet</Text>
              ) : (
                logs.map((log) => {
                  const levelStyle = getLogLevelStyle(log.level);
                  return (
                    <View key={log.id} style={styles.logEntry}>
                      <View style={styles.logEntryHeader}>
                        <Text style={styles.logEntryTime}>
                          {new Date(log.timestamp).toLocaleTimeString("en-US", {
                            hour12: false,
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            fractionalSecondDigits: 3,
                          })}
                        </Text>
                        <View
                          style={[
                            styles.logEntryLevel,
                            {
                              backgroundColor: levelStyle.backgroundColor,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.logEntryLevel,
                              {
                                color: levelStyle.color,
                                backgroundColor: "transparent",
                              },
                            ]}
                          >
                            {log.level.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.logEntryMessage}>{log.message}</Text>
                      {log.data !== undefined && (
                        <Text style={styles.logEntryData}>
                          {formatLogData(log.data)}
                        </Text>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
            <View
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: "#e2e8f0",
              }}
            >
              <Text
                style={{ fontSize: 12, color: "#64748b", textAlign: "center" }}
              >
                💡 Logs also appear in your terminal where you ran `expo start`
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default PredictionScreen;
