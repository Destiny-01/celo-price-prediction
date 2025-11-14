import { formatEther } from "viem";
import {
  predictionAbi,
  predictionContractAddress,
  publicClient,
} from "../config/contracts";

type RoundTuple = readonly [
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

export type RoundSummary = {
  roundId: bigint;
  startTime: bigint;
  endTime: bigint;
  startPrice: bigint;
  endPrice: bigint;
  upPool: bigint;
  downPool: bigint;
  resolved: boolean;
  upWon: boolean;
};

export type RoundInfo = RoundSummary & {
  participants: readonly `0x${string}`[];
};

export type UserBet = {
  amount: bigint;
  direction: boolean;
  claimed: boolean;
};

export type UserRoundEntry = {
  round: RoundInfo;
  bet: UserBet;
};

const ensureContractAddress = () => {
  if (!predictionContractAddress) {
    throw new Error(
      "Prediction contract address missing. Deploy and update config/prediction-addresses.json."
    );
  }
  return predictionContractAddress;
};

const mapTupleToSummary = (tuple: RoundTuple): RoundSummary => {
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
  ] = tuple;

  return {
    roundId,
    startTime,
    endTime,
    startPrice,
    endPrice,
    upPool,
    downPool,
    resolved,
    upWon,
  };
};

const mapStructToInfo = (struct: RoundInfo): RoundInfo => ({
  roundId: struct.roundId,
  startTime: struct.startTime,
  endTime: struct.endTime,
  startPrice: struct.startPrice,
  endPrice: struct.endPrice,
  upPool: struct.upPool,
  downPool: struct.downPool,
  resolved: struct.resolved,
  upWon: struct.upWon,
  participants: struct.participants,
});

export const fetchCurrentRound = async (): Promise<RoundSummary> => {
  const address = ensureContractAddress();
  const tuple = (await publicClient.readContract({
    address,
    abi: predictionAbi,
    functionName: "getRoundDetails",
  })) as unknown as RoundTuple;

  return mapTupleToSummary(tuple);
};

export const fetchUserRounds = async (
  userAddress: `0x${string}`
): Promise<UserRoundEntry[]> => {
  const address = ensureContractAddress();

  try {
    const result = await publicClient.readContract({
      address,
      abi: predictionAbi,
      functionName: "getUserRounds",
      args: [userAddress],
    });

    // viem should automatically parse struct tuples into objects when ABI is correct
    // But handle both tuple (array) and object formats for safety
    const userRoundsWithBets = result as readonly {
      roundId: bigint;
      startTime: bigint;
      endTime: bigint;
      startPrice: bigint;
      endPrice: bigint;
      upPool: bigint;
      downPool: bigint;
      resolved: boolean;
      upWon: boolean;
      amount: bigint;
      direction: boolean;
      claimed: boolean;
    }[];

    if (!userRoundsWithBets || userRoundsWithBets.length === 0) {
      return [];
    }

    // Log the first item to debug structure
    if (userRoundsWithBets.length > 0) {
      console.log(
        "First userRoundWithBet:",
        JSON.stringify(userRoundsWithBets[0], (key, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      );
    }

    return userRoundsWithBets.map((userRoundWithBet, index) => {
      // Validate that we have the expected properties
      if (
        userRoundWithBet.roundId === undefined ||
        userRoundWithBet.amount === undefined ||
        userRoundWithBet.direction === undefined
      ) {
        console.error(
          `Invalid userRoundWithBet at index ${index}:`,
          userRoundWithBet
        );
        // If properties are missing, it might be a tuple - try to destructure
        // This should not happen with the correct ABI, but handle it as fallback
        const tuple = userRoundWithBet as unknown as readonly [
          bigint, // roundId
          bigint, // startTime
          bigint, // endTime
          bigint, // startPrice
          bigint, // endPrice
          bigint, // upPool
          bigint, // downPool
          boolean, // resolved
          boolean, // upWon
          bigint, // amount
          boolean, // direction
          boolean, // claimed
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
          amount,
          direction,
          claimed,
        ] = tuple;

        const round: RoundInfo = {
          roundId,
          startTime,
          endTime,
          startPrice: BigInt(startPrice),
          endPrice: BigInt(endPrice),
          upPool,
          downPool,
          resolved,
          upWon,
          participants: [],
        };

        return {
          round,
          bet: {
            amount,
            direction,
            claimed,
          },
        };
      }

      // Normal object format (expected with correct ABI)
      const round: RoundInfo = {
        roundId: userRoundWithBet.roundId,
        startTime: userRoundWithBet.startTime,
        endTime: userRoundWithBet.endTime,
        startPrice: BigInt(userRoundWithBet.startPrice),
        endPrice: BigInt(userRoundWithBet.endPrice),
        upPool: userRoundWithBet.upPool,
        downPool: userRoundWithBet.downPool,
        resolved: userRoundWithBet.resolved,
        upWon: userRoundWithBet.upWon,
        participants: [], // Not included in UserRoundWithBet
      };

      return {
        round,
        bet: {
          amount: userRoundWithBet.amount,
          direction: userRoundWithBet.direction,
          claimed: userRoundWithBet.claimed,
        },
      };
    });
  } catch (error) {
    console.error("Error fetching user rounds:", error);
    throw error;
  }
};

export const formatWeiToCelo = (value: bigint, decimals = 4) => {
  const formatted = parseFloat(formatEther(value));
  return formatted.toFixed(decimals);
};
