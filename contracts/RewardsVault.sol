// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title RewardsVault
 * @notice Vault for distributing trading fee rewards to token holders
 * @dev Uses epoch-based snapshots and merkle proofs for gas-efficient claiming
 */
contract RewardsVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Epoch duration (1 day)
    uint256 public constant EPOCH_DURATION = 1 days;

    /// @notice Minimum holding percentage to qualify for rewards (0.1%)
    uint256 public constant MIN_HOLDING_BPS = 10;

    /// @notice Maximum number of top holders to reward per token
    uint256 public constant MAX_TOP_HOLDERS = 50;

    /// @notice Claim deadline (30 days after epoch)
    uint256 public constant CLAIM_DEADLINE = 30 days;

    /// @notice Supported reward tokens (ETH and USDC.e)
    address public constant ETH_ADDRESS = address(0);
    address public usdcToken;

    /// @notice Current epoch number
    uint256 public currentEpoch;

    /// @notice Epoch start timestamp
    uint256 public epochStartTime;

    /// @notice Platform router address (authorized to deposit rewards)
    address public platformRouter;

    /// @notice Snapshot oracle address (authorized to submit snapshots)
    address public snapshotOracle;

    struct EpochRewards {
        uint256 totalEthRewards;
        uint256 totalUsdcRewards;
        bytes32 merkleRoot;
        mapping(address => bool) claimed;
        uint256 claimDeadline;
        bool finalized;
    }

    struct HolderReward {
        address holder;
        address token;
        uint256 ethAmount;
        uint256 usdcAmount;
        uint256 weight; // Based on time-weighted average balance
    }

    /// @notice Mapping from epoch to rewards data
    mapping(uint256 => EpochRewards) public epochRewards;

    /// @notice Mapping from token to current snapshot data
    mapping(address => mapping(address => uint256)) public holderBalances;
    mapping(address => mapping(address => uint256)) public holderWeights;
    mapping(address => address[]) public topHolders;

    /// @notice Unclaimed rewards pool for redistribution
    mapping(address => uint256) public unclaimedPool; // token => amount

    /**
     * @notice Emitted when rewards are deposited for an epoch
     * @param epoch Epoch number
     * @param token Token address generating rewards
     * @param ethAmount ETH rewards amount
     * @param usdcAmount USDC rewards amount
     */
    event RewardsDeposited(
        uint256 indexed epoch,
        address indexed token,
        uint256 ethAmount,
        uint256 usdcAmount
    );

    /**
     * @notice Emitted when epoch snapshot is submitted
     * @param epoch Epoch number
     * @param token Token address
     * @param merkleRoot Merkle root for claims
     * @param totalHolders Number of qualifying holders
     */
    event SnapshotSubmitted(
        uint256 indexed epoch,
        address indexed token,
        bytes32 merkleRoot,
        uint256 totalHolders
    );

    /**
     * @notice Emitted when rewards are claimed
     * @param epoch Epoch number
     * @param claimer Address claiming rewards
     * @param ethAmount ETH amount claimed
     * @param usdcAmount USDC amount claimed
     */
    event RewardsClaimed(
        uint256 indexed epoch,
        address indexed claimer,
        uint256 ethAmount,
        uint256 usdcAmount
    );

    /**
     * @notice Emitted when unclaimed rewards are redistributed
     * @param epoch Epoch number
     * @param ethAmount ETH amount redistributed
     * @param usdcAmount USDC amount redistributed
     */
    event UnclaimedRewardsRedistributed(
        uint256 indexed epoch,
        uint256 ethAmount,
        uint256 usdcAmount
    );

    /**
     * @notice Constructor initializes the rewards vault
     * @param owner_ Initial owner address
     * @param platformRouter_ Platform router address
     * @param snapshotOracle_ Snapshot oracle address
     * @param usdcToken_ USDC token address
     */
    constructor(
        address owner_,
        address platformRouter_,
        address snapshotOracle_,
        address usdcToken_
    ) Ownable(owner_) {
        require(owner_ != address(0), "Invalid owner");
        require(platformRouter_ != address(0), "Invalid router");
        require(snapshotOracle_ != address(0), "Invalid oracle");
        require(usdcToken_ != address(0), "Invalid USDC token");

        platformRouter = platformRouter_;
        snapshotOracle = snapshotOracle_;
        usdcToken = usdcToken_;
        
        epochStartTime = block.timestamp;
        currentEpoch = 1;
    }

    /**
     * @notice Deposit rewards for current epoch (called by platform router)
     * @param token Token address generating the rewards
     * @param ethAmount ETH rewards amount
     * @param usdcAmount USDC rewards amount
     */
    function depositRewards(
        address token,
        uint256 ethAmount,
        uint256 usdcAmount
    ) external payable nonReentrant {
        require(msg.sender == platformRouter, "Only platform router");
        require(ethAmount > 0 || usdcAmount > 0, "No rewards to deposit");

        uint256 epoch = getCurrentEpoch();

        if (ethAmount > 0) {
            require(msg.value == ethAmount, "Incorrect ETH amount");
            epochRewards[epoch].totalEthRewards += ethAmount;
        }

        if (usdcAmount > 0) {
            IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), usdcAmount);
            epochRewards[epoch].totalUsdcRewards += usdcAmount;
        }

        emit RewardsDeposited(epoch, token, ethAmount, usdcAmount);
    }

    /**
     * @notice Submit epoch snapshot with merkle root (called by oracle)
     * @param epoch Epoch number
     * @param token Token address
     * @param merkleRoot Merkle root of holder rewards
     * @param totalHolders Number of qualifying holders
     */
    function submitSnapshot(
        uint256 epoch,
        address token,
        bytes32 merkleRoot,
        uint256 totalHolders
    ) external {
        require(msg.sender == snapshotOracle, "Only snapshot oracle");
        require(epoch < getCurrentEpoch(), "Cannot snapshot future epoch");
        require(!epochRewards[epoch].finalized, "Epoch already finalized");
        require(merkleRoot != bytes32(0), "Invalid merkle root");
        require(totalHolders <= MAX_TOP_HOLDERS, "Too many holders");

        epochRewards[epoch].merkleRoot = merkleRoot;
        epochRewards[epoch].claimDeadline = block.timestamp + CLAIM_DEADLINE;
        epochRewards[epoch].finalized = true;

        emit SnapshotSubmitted(epoch, token, merkleRoot, totalHolders);
    }

    /**
     * @notice Claim rewards for specific epoch with merkle proof
     * @param epoch Epoch number
     * @param ethAmount ETH amount to claim
     * @param usdcAmount USDC amount to claim
     * @param merkleProof Merkle proof of eligibility
     */
    function claimRewards(
        uint256 epoch,
        uint256 ethAmount,
        uint256 usdcAmount,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        require(epochRewards[epoch].finalized, "Epoch not finalized");
        require(block.timestamp <= epochRewards[epoch].claimDeadline, "Claim deadline passed");
        require(!epochRewards[epoch].claimed[msg.sender], "Already claimed");
        require(ethAmount > 0 || usdcAmount > 0, "Nothing to claim");

        // Verify merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, ethAmount, usdcAmount));
        require(
            MerkleProof.verify(merkleProof, epochRewards[epoch].merkleRoot, leaf),
            "Invalid merkle proof"
        );

        // Mark as claimed
        epochRewards[epoch].claimed[msg.sender] = true;

        // Transfer rewards
        if (ethAmount > 0) {
            require(address(this).balance >= ethAmount, "Insufficient ETH balance");
            (bool success, ) = msg.sender.call{value: ethAmount}("");
            require(success, "ETH transfer failed");
        }

        if (usdcAmount > 0) {
            require(IERC20(usdcToken).balanceOf(address(this)) >= usdcAmount, "Insufficient USDC balance");
            IERC20(usdcToken).safeTransfer(msg.sender, usdcAmount);
        }

        emit RewardsClaimed(epoch, msg.sender, ethAmount, usdcAmount);
    }

    /**
     * @notice Batch claim rewards for multiple epochs
     * @param epochs Array of epoch numbers
     * @param ethAmounts Array of ETH amounts to claim
     * @param usdcAmounts Array of USDC amounts to claim
     * @param merkleProofs Array of merkle proofs
     */
    function batchClaimRewards(
        uint256[] calldata epochs,
        uint256[] calldata ethAmounts,
        uint256[] calldata usdcAmounts,
        bytes32[][] calldata merkleProofs
    ) external {
        require(epochs.length == ethAmounts.length, "Array length mismatch");
        require(epochs.length == usdcAmounts.length, "Array length mismatch");
        require(epochs.length == merkleProofs.length, "Array length mismatch");

        for (uint256 i = 0; i < epochs.length; i++) {
            claimRewards(epochs[i], ethAmounts[i], usdcAmounts[i], merkleProofs[i]);
        }
    }

    /**
     * @notice Redistribute unclaimed rewards to next epoch
     * @param epoch Epoch with unclaimed rewards
     */
    function redistributeUnclaimedRewards(uint256 epoch) external {
        require(epochRewards[epoch].finalized, "Epoch not finalized");
        require(block.timestamp > epochRewards[epoch].claimDeadline, "Claim period not ended");

        uint256 unclaimedEth = epochRewards[epoch].totalEthRewards;
        uint256 unclaimedUsdc = epochRewards[epoch].totalUsdcRewards;

        // Calculate claimed amounts (simplified - in practice would track this)
        // For now, add to unclaimed pool for manual redistribution
        unclaimedPool[ETH_ADDRESS] += unclaimedEth;
        unclaimedPool[usdcToken] += unclaimedUsdc;

        emit UnclaimedRewardsRedistributed(epoch, unclaimedEth, unclaimedUsdc);
    }

    /**
     * @notice Check if user has claimed rewards for epoch
     * @param epoch Epoch number
     * @param user User address
     * @return claimed True if user has claimed
     */
    function hasClaimed(uint256 epoch, address user) external view returns (bool claimed) {
        return epochRewards[epoch].claimed[user];
    }

    /**
     * @notice Get current epoch number
     * @return epoch Current epoch
     */
    function getCurrentEpoch() public view returns (uint256 epoch) {
        return ((block.timestamp - epochStartTime) / EPOCH_DURATION) + 1;
    }

    /**
     * @notice Get epoch info
     * @param epoch Epoch number
     * @return totalEthRewards Total ETH rewards for epoch
     * @return totalUsdcRewards Total USDC rewards for epoch
     * @return merkleRoot Merkle root for claims
     * @return claimDeadline Claim deadline timestamp
     * @return finalized Whether epoch is finalized
     */
    function getEpochInfo(uint256 epoch) external view returns (
        uint256 totalEthRewards,
        uint256 totalUsdcRewards,
        bytes32 merkleRoot,
        uint256 claimDeadline,
        bool finalized
    ) {
        EpochRewards storage rewards = epochRewards[epoch];
        return (
            rewards.totalEthRewards,
            rewards.totalUsdcRewards,
            rewards.merkleRoot,
            rewards.claimDeadline,
            rewards.finalized
        );
    }

    /**
     * @notice Calculate time until next epoch
     * @return timeRemaining Seconds until next epoch
     */
    function getTimeToNextEpoch() external view returns (uint256 timeRemaining) {
        uint256 currentEpochStart = epochStartTime + ((getCurrentEpoch() - 1) * EPOCH_DURATION);
        uint256 nextEpochStart = currentEpochStart + EPOCH_DURATION;
        
        if (block.timestamp >= nextEpochStart) {
            return 0;
        }
        
        return nextEpochStart - block.timestamp;
    }

    /**
     * @notice Update platform router address
     * @param newRouter New router address
     */
    function updatePlatformRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "Invalid router address");
        platformRouter = newRouter;
    }

    /**
     * @notice Update snapshot oracle address
     * @param newOracle New oracle address
     */
    function updateSnapshotOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        snapshotOracle = newOracle;
    }

    /**
     * @notice Update USDC token address
     * @param newUsdcToken New USDC token address
     */
    function updateUsdcToken(address newUsdcToken) external onlyOwner {
        require(newUsdcToken != address(0), "Invalid USDC token");
        usdcToken = newUsdcToken;
    }

    /**
     * @notice Emergency withdraw function
     * @param token Token address (address(0) for ETH)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = owner().call{value: amount}("");
            require(success, "ETH withdrawal failed");
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {
        // Allow receiving ETH for rewards
    }
}