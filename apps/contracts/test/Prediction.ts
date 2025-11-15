import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
const DECIMALS = 8n;
const INITIAL_PRICE = 30_000n * 10n ** DECIMALS;

// Mock cUSD address for testing (on local network, this can be any valid address)
const MOCK_CUSD_ADDRESS = "0x0000000000000000000000000000000000000001";

describe("SimpleCryptoPrediction", () => {
  async function deployPredictionFixture() {
    const [owner, alice, bob] = await hre.viem.getWalletClients();

    console.log("\n=== Deploying Contract ===");
    console.log("Owner:", owner.account.address);
    console.log("Alice:", alice.account.address);
    console.log("Bob:", bob.account.address);
    console.log(
      "Initial Price:",
      INITIAL_PRICE.toString(),
      `($${Number(INITIAL_PRICE) / Number(10n ** DECIMALS)})`
    );
    console.log("Mock cUSD Address:", MOCK_CUSD_ADDRESS);

    const prediction = await hre.viem.deployContract(
      "SimpleCryptoPrediction" as any,
      [INITIAL_PRICE, MOCK_CUSD_ADDRESS] // Pass initialPrice and cUSD address
    );

    console.log("Contract deployed at:", prediction.address);

    const publicClient = await hre.viem.getPublicClient();

    return { owner, alice, bob, prediction, publicClient };
  }

  it("initialises a round on deployment", async () => {
    console.log("\n🧪 Test: initialises a round on deployment");
    const { prediction } = await loadFixture(deployPredictionFixture);
    const result = await prediction.read.getRoundDetails();
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
    ] = result as readonly [
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

    console.log("\n📊 Round Details After Deployment:");
    console.log("  Round ID:", roundId.toString());
    console.log(
      "  Start Time:",
      new Date(Number(startTime) * 1000).toISOString()
    );
    console.log("  End Time:", new Date(Number(endTime) * 1000).toISOString());
    console.log(
      "  Start Price:",
      startPrice.toString(),
      `($${Number(startPrice) / Number(10n ** DECIMALS)})`
    );
    console.log(
      "  End Price:",
      endPrice.toString(),
      endPrice === 0n
        ? "(not set)"
        : `($${Number(endPrice) / Number(10n ** DECIMALS)})`
    );
    console.log(
      "  Up Pool:",
      upPool.toString(),
      `(${Number(upPool) / 1e18} CELO)`
    );
    console.log(
      "  Down Pool:",
      downPool.toString(),
      `(${Number(downPool) / 1e18} CELO)`
    );
    console.log("  Resolved:", resolved);
    console.log("  Up Won:", upWon);

    expect(roundId).to.equal(1n);
    expect(resolved).to.equal(false);
    expect(upPool).to.equal(0n);
    expect(downPool).to.equal(0n);
    expect(startPrice).to.equal(INITIAL_PRICE);
    console.log("✅ All assertions passed!\n");
  });

  it("returns round data", async () => {
    console.log("\n🧪 Test: returns round data");
    const { prediction, alice, bob, publicClient } = await loadFixture(
      deployPredictionFixture
    );

    const minBet = (await prediction.read.minBet()) as bigint;
    console.log(
      "\n💰 Minimum Bet:",
      minBet.toString(),
      `(${Number(minBet) / 1e18} CELO)`
    );

    const predictionAsAlice = await hre.viem.getContractAt(
      "SimpleCryptoPrediction" as any,
      prediction.address,
      { client: { wallet: alice } }
    );
    console.log("\n🎲 Alice placing UP bet...");
    const aliceTx = await predictionAsAlice.write.placeBet([true], {
      value: minBet,
    });
    console.log("  Transaction hash:", aliceTx);
    await publicClient.waitForTransactionReceipt({ hash: aliceTx });
    console.log("  ✅ Alice's bet placed!");

    const predictionAsBob = await hre.viem.getContractAt(
      "SimpleCryptoPrediction" as any,
      prediction.address,
      { client: { wallet: bob } }
    );
    console.log("\n🎲 Bob placing DOWN bet...");
    const bobTx = await predictionAsBob.write.placeBet([false], {
      value: minBet,
    });
    console.log("  Transaction hash:", bobTx);
    await publicClient.waitForTransactionReceipt({ hash: bobTx });
    console.log("  ✅ Bob's bet placed!");

    // Check pool state before resolution
    const roundBefore = await prediction.read.getRoundDetails();
    const [, , , , , upPoolBefore, downPoolBefore] = roundBefore as readonly [
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
    console.log("\n📊 Pool State Before Resolution:");
    console.log(
      "  Up Pool:",
      upPoolBefore.toString(),
      `(${Number(upPoolBefore) / 1e18} CELO)`
    );
    console.log(
      "  Down Pool:",
      downPoolBefore.toString(),
      `(${Number(downPoolBefore) / 1e18} CELO)`
    );
    console.log(
      "  Total Pool:",
      (upPoolBefore + downPoolBefore).toString(),
      `(${Number(upPoolBefore + downPoolBefore) / 1e18} CELO)`
    );

    const newPrice = INITIAL_PRICE + 1_000n * 10n ** DECIMALS;
    console.log("\n⏰ Advancing time to end round...");
    const duration = (await prediction.read.roundDuration()) as bigint;
    console.log("  Round Duration:", duration.toString(), "seconds");
    await time.increase(Number(duration) + 1);

    const nextStartPrice = newPrice + 500n * 10n ** DECIMALS;
    console.log("\n🏁 Resolving Round:");
    console.log(
      "  End Price:",
      newPrice.toString(),
      `($${Number(newPrice) / Number(10n ** DECIMALS)})`
    );
    console.log(
      "  Next Start Price:",
      nextStartPrice.toString(),
      `($${Number(nextStartPrice) / Number(10n ** DECIMALS)})`
    );

    const receiptHash = await prediction.write.resolveRound([
      newPrice,
      nextStartPrice,
    ]);
    console.log("  Transaction hash:", receiptHash);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: receiptHash,
    });
    console.log("  Block number:", receipt.blockNumber.toString());
    console.log("  ✅ Round resolved!");

    const currentRoundResult = await prediction.read.getRoundDetails();
    const [
      currentRoundId,
      currentStartTime,
      currentEndTime,
      currentStartPrice,
      currentEndPrice,
      currentUpPool,
      currentDownPool,
      currentResolved,
      currentUpWon,
    ] = currentRoundResult as readonly [
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

    console.log("\n📊 New Round Details (Round #2):");
    console.log("  Round ID:", currentRoundId.toString());
    console.log(
      "  Start Price:",
      currentStartPrice.toString(),
      `($${Number(currentStartPrice) / Number(10n ** DECIMALS)})`
    );
    console.log(
      "  Up Pool:",
      currentUpPool.toString(),
      `(${Number(currentUpPool) / 1e18} CELO)`
    );
    console.log(
      "  Down Pool:",
      currentDownPool.toString(),
      `(${Number(currentDownPool) / 1e18} CELO)`
    );
    console.log("  Resolved:", currentResolved);

    expect(currentRoundId).to.equal(2n);
    console.log("✅ All assertions passed! New round started correctly.\n");
  });

  it("tracks user rounds and bets with full round details", async () => {
    console.log(
      "\n🧪 Test: tracks user rounds and bets with full round details"
    );
    const { prediction, alice, bob, publicClient } = await loadFixture(
      deployPredictionFixture
    );

    const minBet = (await prediction.read.minBet()) as bigint;
    console.log(
      "\n💰 Minimum Bet:",
      minBet.toString(),
      `(${Number(minBet) / 1e18} CELO)`
    );

    console.log("\n🎲 Alice placing UP bet...");
    const aliceContract = await hre.viem.getContractAt(
      "SimpleCryptoPrediction" as any,
      prediction.address,
      { client: { wallet: alice } }
    );
    const aliceTx1 = await aliceContract.write.placeBet([true], {
      value: minBet,
    });
    console.log("  Transaction hash:", aliceTx1);
    await publicClient.waitForTransactionReceipt({ hash: aliceTx1 });
    console.log("  ✅ Alice's UP bet placed!");

    console.log("\n🎲 Bob placing UP bet...");
    const bobContract = await hre.viem.getContractAt(
      "SimpleCryptoPrediction" as any,
      prediction.address,
      { client: { wallet: bob } }
    );
    const bobTx1 = await bobContract.write.placeBet([true], { value: minBet });
    console.log("  Transaction hash:", bobTx1);
    await publicClient.waitForTransactionReceipt({ hash: bobTx1 });
    console.log("  ✅ Bob's UP bet placed!");

    // Check pool state
    const roundBefore = await prediction.read.getRoundDetails();
    const [, , , , , upPoolBefore, downPoolBefore] = roundBefore as readonly [
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
    console.log("\n📊 Pool State Before Resolution:");
    console.log(
      "  Up Pool:",
      upPoolBefore.toString(),
      `(${Number(upPoolBefore) / 1e18} CELO)`
    );
    console.log(
      "  Down Pool:",
      downPoolBefore.toString(),
      `(${Number(downPoolBefore) / 1e18} CELO)`
    );

    const endPrice = INITIAL_PRICE - 1_000n * 10n ** DECIMALS;
    console.log("\n⏰ Advancing time to end round...");
    const duration = await prediction.read.roundDuration();
    await time.increase(Number(duration) + 1);

    console.log("\n🏁 Resolving Round:");
    console.log(
      "  Start Price:",
      INITIAL_PRICE.toString(),
      `($${Number(INITIAL_PRICE) / Number(10n ** DECIMALS)})`
    );
    console.log(
      "  End Price:",
      endPrice.toString(),
      `($${Number(endPrice) / Number(10n ** DECIMALS)})`
    );
    console.log(
      "  Price Change:",
      Number(endPrice - INITIAL_PRICE) / Number(10n ** DECIMALS),
      "(DOWN)"
    );
    const nextStartPrice = endPrice + 500n * 10n ** DECIMALS;

    const hash = await prediction.write.resolveRound([
      endPrice,
      nextStartPrice,
    ]);
    console.log("  Transaction hash:", hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("  ✅ Round resolved! (DOWN won because price decreased)");

    console.log("\n📋 Fetching Alice's bet history...");
    const aliceRoundsResult = await prediction.read.getUserRounds([
      alice.account.address,
    ]);
    const aliceRounds = aliceRoundsResult as readonly {
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

    console.log("\n👤 Alice's Rounds:", aliceRounds.length);
    if (aliceRounds.length > 0) {
      const aliceRound = aliceRounds[0];
      console.log("  Round #" + aliceRound.roundId.toString() + ":");
      console.log(
        "    Bet Amount:",
        aliceRound.amount.toString(),
        `(${Number(aliceRound.amount) / 1e18} CELO)`
      );
      console.log("    Direction:", aliceRound.direction ? "UP" : "DOWN");
      console.log(
        "    Start Price:",
        aliceRound.startPrice.toString(),
        `($${Number(aliceRound.startPrice) / Number(10n ** DECIMALS)})`
      );
      console.log(
        "    End Price:",
        aliceRound.endPrice.toString(),
        `($${Number(aliceRound.endPrice) / Number(10n ** DECIMALS)})`
      );
      console.log("    Resolved:", aliceRound.resolved);
      console.log("    Up Won:", aliceRound.upWon);
      console.log(
        "    Alice Won:",
        aliceRound.upWon === aliceRound.direction ? "✅ YES" : "❌ NO"
      );
      console.log("    Claimed:", aliceRound.claimed);
    }

    expect(aliceRounds).to.have.lengthOf(1);
    expect(aliceRounds[0].roundId).to.equal(1n);
    expect(aliceRounds[0].amount).to.equal(minBet);
    expect(aliceRounds[0].direction).to.equal(true);
    expect(aliceRounds[0].resolved).to.equal(true);
    expect(aliceRounds[0].upWon).to.equal(false);
    expect(aliceRounds[0].startPrice).to.equal(INITIAL_PRICE);
    expect(aliceRounds[0].endPrice).to.equal(endPrice);

    console.log("\n📋 Fetching Bob's bet history...");
    const bobRoundsResult = await prediction.read.getUserRounds([
      bob.account.address,
    ]);
    const bobRounds = bobRoundsResult as readonly {
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

    console.log("\n👤 Bob's Rounds:", bobRounds.length);
    if (bobRounds.length > 0) {
      const bobRound = bobRounds[0];
      console.log("  Round #" + bobRound.roundId.toString() + ":");
      console.log(
        "    Bet Amount:",
        bobRound.amount.toString(),
        `(${Number(bobRound.amount) / 1e18} CELO)`
      );
      console.log("    Direction:", bobRound.direction ? "UP" : "DOWN");
      console.log("    Resolved:", bobRound.resolved);
    }

    expect(bobRounds).to.have.lengthOf(1);
    expect(bobRounds[0].roundId).to.equal(1n);
    expect(bobRounds[0].amount).to.equal(minBet);
    expect(bobRounds[0].direction).to.equal(true);

    // A new round should automatically start
    console.log("\n📊 Checking new round...");
    const finalRoundResult = await prediction.read.getRoundDetails();
    const [
      currentRoundId,
      currentStartTime,
      currentEndTime,
      currentStartPrice,
      currentEndPrice,
      currentUpPool,
      currentDownPool,
      currentResolved,
      currentUpWon,
    ] = finalRoundResult as readonly [
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

    console.log("  Round ID:", currentRoundId.toString());
    console.log(
      "  Start Price:",
      currentStartPrice.toString(),
      `($${Number(currentStartPrice) / Number(10n ** DECIMALS)})`
    );
    console.log(
      "  Up Pool:",
      currentUpPool.toString(),
      `(${Number(currentUpPool) / 1e18} CELO)`
    );
    console.log(
      "  Down Pool:",
      currentDownPool.toString(),
      `(${Number(currentDownPool) / 1e18} CELO)`
    );

    expect(currentRoundId).to.equal(2n);
    console.log("✅ All assertions passed! User rounds tracked correctly.\n");
  });

  it("handles case where only one person bets", async () => {
    console.log("\n🧪 Test: handles case where only one person bets");
    const { prediction, alice, publicClient } = await loadFixture(
      deployPredictionFixture
    );

    const minBet = (await prediction.read.minBet()) as bigint;
    const aliceBalanceBefore = await publicClient.getBalance({
      address: alice.account.address,
    });

    console.log("\n🎲 Alice placing UP bet (only bettor)...");
    const aliceContract = await hre.viem.getContractAt(
      "SimpleCryptoPrediction" as any,
      prediction.address,
      { client: { wallet: alice } }
    );
    const aliceTx = await aliceContract.write.placeBet([true], {
      value: minBet,
    });
    console.log("  Transaction hash:", aliceTx);
    await publicClient.waitForTransactionReceipt({ hash: aliceTx });
    console.log("  ✅ Alice's bet placed!");

    // Check pool state
    const roundBefore = await prediction.read.getRoundDetails();
    const [, , , , , upPoolBefore, downPoolBefore] = roundBefore as readonly [
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
    console.log("\n📊 Pool State Before Resolution:");
    console.log(
      "  Up Pool:",
      upPoolBefore.toString(),
      `(${Number(upPoolBefore) / 1e18} CELO)`
    );
    console.log(
      "  Down Pool:",
      downPoolBefore.toString(),
      `(${Number(downPoolBefore) / 1e18} CELO)`
    );
    expect(upPoolBefore).to.equal(minBet);
    expect(downPoolBefore).to.equal(0n);

    // Advance time and resolve
    const duration = (await prediction.read.roundDuration()) as bigint;
    await time.increase(Number(duration) + 1);

    const endPrice = INITIAL_PRICE + 1_000n * 10n ** DECIMALS; // Price goes up
    const nextStartPrice = endPrice + 500n * 10n ** DECIMALS;

    console.log("\n🏁 Resolving Round (UP won, but no losers)...");
    const hash = await prediction.write.resolveRound([
      endPrice,
      nextStartPrice,
    ]);
    console.log("  Transaction hash:", hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("  ✅ Round resolved!");

    // Check Alice's balance - should get her bet back (refund)
    const aliceBalanceAfter = await publicClient.getBalance({
      address: alice.account.address,
    });
    const balanceDiff = aliceBalanceAfter - aliceBalanceBefore;
    // Account for gas costs - balance should be close to original (minus gas)
    // Since she got refunded, the difference should be approximately -gas costs
    console.log(
      "\n💰 Alice's Balance Change:",
      balanceDiff.toString(),
      `(${Number(balanceDiff) / 1e18} CELO)`
    );
    // Balance diff should be negative (gas spent) but not as negative as losing the bet
    expect(balanceDiff < 0n).to.be.true; // Gas was spent

    // Check that Alice's bet is marked as claimed
    const aliceRounds = (await prediction.read.getUserRounds([
      alice.account.address,
    ])) as readonly {
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
    expect(aliceRounds).to.have.lengthOf(1);
    expect(aliceRounds[0].claimed).to.equal(true);
    expect(aliceRounds[0].amount).to.equal(minBet);
    expect(aliceRounds[0].direction).to.equal(true);
    expect(aliceRounds[0].upWon).to.equal(true);

    console.log("✅ All assertions passed! Single bettor gets refund.\n");
  });

  it("handles case where everyone bets the same direction", async () => {
    console.log(
      "\n🧪 Test: handles case where everyone bets the same direction"
    );
    const { prediction, alice, bob, publicClient } = await loadFixture(
      deployPredictionFixture
    );

    const minBet = (await prediction.read.minBet()) as bigint;
    const aliceBalanceBefore = await publicClient.getBalance({
      address: alice.account.address,
    });
    const bobBalanceBefore = await publicClient.getBalance({
      address: bob.account.address,
    });

    console.log("\n🎲 Alice placing UP bet...");
    const aliceContract = await hre.viem.getContractAt(
      "SimpleCryptoPrediction" as any,
      prediction.address,
      { client: { wallet: alice } }
    );
    const aliceTx = await aliceContract.write.placeBet([true], {
      value: minBet,
    });
    await publicClient.waitForTransactionReceipt({ hash: aliceTx });
    console.log("  ✅ Alice's UP bet placed!");

    console.log("\n🎲 Bob placing UP bet (same direction)...");
    const bobContract = await hre.viem.getContractAt(
      "SimpleCryptoPrediction" as any,
      prediction.address,
      { client: { wallet: bob } }
    );
    const bobTx = await bobContract.write.placeBet([true], { value: minBet });
    await publicClient.waitForTransactionReceipt({ hash: bobTx });
    console.log("  ✅ Bob's UP bet placed!");

    // Check pool state - both in up pool, down pool is empty
    const roundBefore = await prediction.read.getRoundDetails();
    const [, , , , , upPoolBefore, downPoolBefore] = roundBefore as readonly [
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
    console.log("\n📊 Pool State Before Resolution:");
    console.log(
      "  Up Pool:",
      upPoolBefore.toString(),
      `(${Number(upPoolBefore) / 1e18} CELO)`
    );
    console.log(
      "  Down Pool:",
      downPoolBefore.toString(),
      `(${Number(downPoolBefore) / 1e18} CELO)`
    );
    expect(upPoolBefore).to.equal(minBet * 2n);
    expect(downPoolBefore).to.equal(0n);

    // Advance time and resolve with UP winning
    const duration = (await prediction.read.roundDuration()) as bigint;
    await time.increase(Number(duration) + 1);

    const endPrice = INITIAL_PRICE + 1_000n * 10n ** DECIMALS; // Price goes up
    const nextStartPrice = endPrice + 500n * 10n ** DECIMALS;

    console.log(
      "\n🏁 Resolving Round (UP won, but no one bet DOWN - everyone gets refund)..."
    );
    const hash = await prediction.write.resolveRound([
      endPrice,
      nextStartPrice,
    ]);
    console.log("  Transaction hash:", hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("  ✅ Round resolved!");

    // Both should get their bets back (refund)
    const aliceBalanceAfter = await publicClient.getBalance({
      address: alice.account.address,
    });
    const bobBalanceAfter = await publicClient.getBalance({
      address: bob.account.address,
    });

    const aliceBalanceDiff = aliceBalanceAfter - aliceBalanceBefore;
    const bobBalanceDiff = bobBalanceAfter - bobBalanceBefore;

    console.log(
      "\n💰 Alice's Balance Change:",
      aliceBalanceDiff.toString(),
      `(${Number(aliceBalanceDiff) / 1e18} CELO)`
    );
    console.log(
      "💰 Bob's Balance Change:",
      bobBalanceDiff.toString(),
      `(${Number(bobBalanceDiff) / 1e18} CELO)`
    );

    // Both should have their bets marked as claimed
    const aliceRounds = (await prediction.read.getUserRounds([
      alice.account.address,
    ])) as readonly {
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
    const bobRounds = (await prediction.read.getUserRounds([
      bob.account.address,
    ])) as readonly {
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

    expect(aliceRounds).to.have.lengthOf(1);
    expect(aliceRounds[0].claimed).to.equal(true);
    expect(aliceRounds[0].amount).to.equal(minBet);
    expect(aliceRounds[0].direction).to.equal(true);
    expect(aliceRounds[0].upWon).to.equal(true);

    expect(bobRounds).to.have.lengthOf(1);
    expect(bobRounds[0].claimed).to.equal(true);
    expect(bobRounds[0].amount).to.equal(minBet);
    expect(bobRounds[0].direction).to.equal(true);
    expect(bobRounds[0].upWon).to.equal(true);

    console.log(
      "✅ All assertions passed! Everyone gets refund when no losers.\n"
    );
  });
});
