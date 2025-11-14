// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleCryptoPrediction {
    address public owner;

    uint256 public currentRoundId;
    uint256 public roundDuration = 1 days;
    uint256 public minBet = 0.01 ether;

    struct Bet {
        uint256 amount;
        bool direction; // true = Up, false = Down
        bool claimed;
    }

    struct Round {
        uint256 startTime;
        uint256 endTime;
        int256 startPrice;
        int256 endPrice;
        uint256 upPool;
        uint256 downPool;
        bool resolved;
        bool upWon;
        address[] participants;
        mapping(address => Bet) bets;
    }

    struct UserRoundWithBet {
        uint256 roundId;
        uint256 startTime;
        uint256 endTime;
        int256 startPrice;
        int256 endPrice;
        uint256 upPool;
        uint256 downPool;
        bool resolved;
        bool upWon;
        uint256 amount;
        bool direction;
        bool claimed;
    }

    mapping(uint256 => Round) public rounds;
    mapping(address => uint256[]) public userRounds;

    event RoundStarted(uint256 indexed roundId, int256 startPrice);
    event BetPlaced(
        uint256 indexed roundId,
        address indexed user,
        bool direction,
        uint256 amount
    );
    event RoundResolved(uint256 indexed roundId, int256 endPrice, bool upWon);
    event RewardPaid(
        uint256 indexed roundId,
        address indexed user,
        uint256 reward
    );

    constructor(int256 initialPrice) {
        owner = msg.sender;
        _startNewRound(initialPrice);
    }

    function _startNewRound(int256 startPrice) internal {
        currentRoundId++;
        Round storage r = rounds[currentRoundId];
        r.startTime = block.timestamp;
        r.endTime = block.timestamp + roundDuration;
        r.startPrice = startPrice;
        emit RoundStarted(currentRoundId, r.startPrice);
    }

    function placeBet(bool _direction) external payable {
        require(currentRoundId > 0, "No active round");
        Round storage r = rounds[currentRoundId];
        require(r.startTime > 0, "Round not initialized");
        require(r.endTime > 0, "Round not initialized");
        require(block.timestamp < r.endTime, "Round closed");
        require(msg.value >= minBet, "Low stake");
        require(r.bets[msg.sender].amount == 0, "Already bet");

        r.bets[msg.sender] = Bet({
            amount: msg.value,
            direction: _direction,
            claimed: false
        });

        r.participants.push(msg.sender);
        userRounds[msg.sender].push(currentRoundId);

        if (_direction) {
            r.upPool += msg.value;
        } else {
            r.downPool += msg.value;
        }

        emit BetPlaced(currentRoundId, msg.sender, _direction, msg.value);
    }

    function resolveRound(int256 endPrice, int256 nextStartPrice) external {
        require(msg.sender == owner, "Not owner");
        require(currentRoundId > 0, "No active round");
        Round storage r = rounds[currentRoundId];
        require(r.startTime > 0, "Round not initialized");
        require(!r.resolved, "Already resolved");

        r.endPrice = endPrice;
        r.resolved = true;
        r.upWon = r.endPrice > r.startPrice;

        emit RoundResolved(currentRoundId, r.endPrice, r.upWon);

        // --- Auto-payout winners ---
        uint256 rewardPool = r.upWon ? r.downPool : r.upPool;
        uint256 winnerPool = r.upWon ? r.upPool : r.downPool;

        // Process payouts if there are winners
        if (winnerPool > 0 && r.participants.length > 0) {
            for (uint256 i = 0; i < r.participants.length; i++) {
                address player = r.participants[i];
                Bet storage b = r.bets[player];
                // Only pay out to winners who haven't claimed
                if (b.direction == r.upWon && !b.claimed && b.amount > 0) {
                    uint256 reward;

                    if (rewardPool > 0) {
                        // There are losers: winners get their bet + proportional share of loser pool
                        require(winnerPool > 0, "Winner pool is zero");
                        uint256 proportionalReward = (b.amount * rewardPool) /
                            winnerPool;
                        reward = b.amount + proportionalReward;
                    } else {
                        // No losers: winners get their original bet back (refund)
                        reward = b.amount;
                    }

                    b.claimed = true;
                    payable(player).transfer(reward);
                    emit RewardPaid(currentRoundId, player, reward);
                }
            }
        }

        _startNewRound(nextStartPrice); // Start next round automatically
    }

    function getRoundDetails()
        external
        view
        returns (
            uint256 roundId,
            uint256 startTime,
            uint256 endTime,
            int256 startPrice,
            int256 endPrice,
            uint256 upPool,
            uint256 downPool,
            bool resolved,
            bool upWon
        )
    {
        require(currentRoundId > 0, "No active round");
        Round storage r = rounds[currentRoundId];
        return (
            currentRoundId,
            r.startTime,
            r.endTime,
            r.startPrice,
            r.endPrice,
            r.upPool,
            r.downPool,
            r.resolved,
            r.upWon
        );
    }

    function getUserRounds(
        address user
    ) external view returns (UserRoundWithBet[] memory) {
        uint256[] storage roundIds = userRounds[user];
        uint256 length = roundIds.length;
        UserRoundWithBet[] memory result = new UserRoundWithBet[](length);

        for (uint256 i = 0; i < length; i++) {
            uint256 roundId = roundIds[i];
            Round storage r = rounds[roundId];
            Bet storage b = r.bets[user];
            result[i] = UserRoundWithBet({
                roundId: roundId,
                startTime: r.startTime,
                endTime: r.endTime,
                startPrice: r.startPrice,
                endPrice: r.endPrice,
                upPool: r.upPool,
                downPool: r.downPool,
                resolved: r.resolved,
                upWon: r.upWon,
                amount: b.amount,
                direction: b.direction,
                claimed: b.claimed
            });
        }

        return result;
    }
}
