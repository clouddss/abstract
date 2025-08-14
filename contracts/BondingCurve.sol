// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IBondingCurve.sol";
import "./libraries/BondingCurveMath.sol";
import "./BaseToken.sol";

/**
 * @title BondingCurve
 * @notice Virtual AMM implementing exponential bonding curve for token sales
 * @dev Uses mathematical formula: price = basePrice * supply^1.5
 */
contract BondingCurve is IBondingCurve, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using BondingCurveMath for uint256;

    /// @notice The token being sold through this curve
    BaseToken public token;

    /// @notice Address of the launch factory
    address public immutable factory;

    /// @notice Token creator address
    address public immutable creator;

    /// @notice Current circulating supply on the curve
    uint256 public soldSupply;

    /// @notice Whether curve has been migrated to DEX
    bool public migrated;

    /// @notice Minimum purchase amount (0.01 ETH)
    uint256 public constant MIN_PURCHASE = 0.01 ether;

    /// @notice Maximum purchase percentage (10% of remaining curve supply)
    uint256 public constant MAX_PURCHASE_BPS = 1000; // 10%

    /// @notice Platform fee in basis points (0.5%)
    uint256 public constant PLATFORM_FEE_BPS = 50;

    /// @notice Creator fee in basis points (0.5%)
    uint256 public constant CREATOR_FEE_BPS = 50;

    /// @notice Slippage tolerance in basis points (2%)
    uint256 public constant MAX_SLIPPAGE_BPS = 200;

    /// @notice Platform treasury address
    address public platformTreasury;

    /// @notice Mapping to track user purchases (for anti-MEV)
    mapping(address => uint256) public lastPurchaseBlock;

    /**
     * @notice Emitted when platform treasury is updated
     * @param oldTreasury Previous treasury address
     * @param newTreasury New treasury address
     */
    event PlatformTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /**
     * @notice Emitted when fees are collected
     * @param recipient Fee recipient
     * @param amount Fee amount
     * @param feeType Type of fee (platform/creator)
     */
    event FeesCollected(address indexed recipient, uint256 amount, string feeType);

    /**
     * @notice Constructor initializes bonding curve for a token
     * @param token_ Address of the token contract
     * @param creator_ Address of the token creator
     * @param factory_ Address of the launch factory
     * @param platformTreasury_ Address of platform treasury
     */
    constructor(
        address token_,
        address creator_,
        address factory_,
        address platformTreasury_
    ) Ownable(factory_) {
        require(token_ != address(0), "Invalid token address");
        require(creator_ != address(0), "Invalid creator address");
        require(factory_ != address(0), "Invalid factory address");
        require(platformTreasury_ != address(0), "Invalid treasury address");

        if (token_ != address(0)) {
            token = BaseToken(token_);
        }
        creator = creator_;
        factory = factory_;
        platformTreasury = platformTreasury_;
    }

    /**
     * @notice Calculate current price per token
     * @return price Current price in wei
     */
    function getCurrentPrice() external view override returns (uint256 price) {
        return BondingCurveMath.calculatePrice(soldSupply);
    }

    /**
     * @notice Calculate tokens received for ETH amount
     * @param ethAmount Amount of ETH to spend
     * @return tokenAmount Amount of tokens that would be received
     */
    function calculateTokensOut(uint256 ethAmount) external view override returns (uint256 tokenAmount) {
        if (migrated) return 0;
        
        // Subtract fees from ETH amount
        uint256 netEthAmount = ethAmount - _calculateFees(ethAmount);
        return BondingCurveMath.calculateTokensOut(soldSupply, netEthAmount);
    }

    /**
     * @notice Calculate ETH received for token amount
     * @param tokenAmount Amount of tokens to sell
     * @return ethAmount Amount of ETH that would be received
     */
    function calculateEthOut(uint256 tokenAmount) external view override returns (uint256 ethAmount) {
        if (migrated || tokenAmount > soldSupply) return 0;
        
        uint256 grossEthAmount = BondingCurveMath.calculateEthOut(soldSupply, tokenAmount);
        // Subtract fees from ETH amount
        return grossEthAmount - _calculateFees(grossEthAmount);
    }

    /**
     * @notice Purchase tokens with ETH
     * @param minTokensOut Minimum tokens expected (slippage protection)
     * @return tokenAmount Actual tokens received
     */
    function buyTokens(uint256 minTokensOut) external payable override nonReentrant returns (uint256 tokenAmount) {
        require(!migrated, "Curve has migrated to DEX");
        require(msg.value >= MIN_PURCHASE, "Purchase amount too small");
        require(msg.value > 0, "ETH amount must be greater than 0");
        
        // Anti-MEV: prevent multiple purchases in same block
        require(lastPurchaseBlock[msg.sender] != block.number, "Cannot purchase multiple times per block");
        lastPurchaseBlock[msg.sender] = block.number;

        // Calculate fees and net ETH amount
        uint256 totalFees = _calculateFees(msg.value);
        uint256 netEthAmount = msg.value - totalFees;

        // Calculate tokens to receive
        tokenAmount = BondingCurveMath.calculateTokensOut(soldSupply, netEthAmount);
        require(tokenAmount > 0, "Token amount too small");
        require(tokenAmount >= minTokensOut, "Slippage tolerance exceeded");

        // Check maximum purchase limit (10% of remaining supply)
        uint256 remainingSupply = BondingCurveMath.getMaxCurveSupply() - soldSupply;
        uint256 maxPurchase = (remainingSupply * MAX_PURCHASE_BPS) / 10000;
        require(tokenAmount <= maxPurchase, "Purchase exceeds maximum limit");

        // Update sold supply
        soldSupply += tokenAmount;

        // Transfer tokens to buyer
        IERC20(address(token)).safeTransfer(msg.sender, tokenAmount);

        // Distribute fees
        _distributeFees(totalFees);

        // Check if ready for migration
        if (BondingCurveMath.isReadyForMigration(soldSupply)) {
            _triggerMigration();
        }

        emit TokensPurchased(msg.sender, msg.value, tokenAmount, BondingCurveMath.calculatePrice(soldSupply));
    }

    /**
     * @notice Sell tokens for ETH
     * @param tokenAmount Amount of tokens to sell
     * @param minEthOut Minimum ETH expected (slippage protection)
     * @return ethAmount Actual ETH received
     */
    function sellTokens(uint256 tokenAmount, uint256 minEthOut) external override nonReentrant returns (uint256 ethAmount) {
        require(!migrated, "Curve has migrated to DEX");
        require(tokenAmount > 0, "Token amount must be greater than 0");
        require(tokenAmount <= soldSupply, "Cannot sell more than circulating supply");
        require(token.balanceOf(msg.sender) >= tokenAmount, "Insufficient token balance");

        // Calculate ETH to receive (before fees)
        uint256 grossEthAmount = BondingCurveMath.calculateEthOut(soldSupply, tokenAmount);
        uint256 totalFees = _calculateFees(grossEthAmount);
        ethAmount = grossEthAmount - totalFees;

        require(ethAmount >= minEthOut, "Slippage tolerance exceeded");
        require(address(this).balance >= ethAmount, "Insufficient contract ETH balance");

        // Update sold supply
        soldSupply -= tokenAmount;

        // Transfer tokens from seller
        IERC20(address(token)).safeTransferFrom(msg.sender, address(this), tokenAmount);

        // Transfer ETH to seller
        (bool success, ) = msg.sender.call{value: ethAmount}("");
        require(success, "ETH transfer failed");

        // Distribute fees
        _distributeFees(totalFees);

        emit TokensSold(msg.sender, tokenAmount, ethAmount, BondingCurveMath.calculatePrice(soldSupply));
    }

    /**
     * @notice Check if curve has reached migration threshold
     * @return ready True if ready for DEX migration
     */
    function isReadyForMigration() external view override returns (bool ready) {
        return BondingCurveMath.isReadyForMigration(soldSupply);
    }

    /**
     * @notice Get current curve progress
     * @return soldSupply_ Amount of tokens sold through curve
     * @return totalSupply Total supply available on curve
     * @return progressBps Progress in basis points (0-10000)
     */
    function getCurveProgress() external view override returns (
        uint256 soldSupply_,
        uint256 totalSupply,
        uint256 progressBps
    ) {
        soldSupply_ = soldSupply;
        totalSupply = BondingCurveMath.getMaxCurveSupply();
        progressBps = BondingCurveMath.calculateProgress(soldSupply);
    }

    /**
     * @notice Update platform treasury address (only factory)
     * @param newTreasury New treasury address
     */
    function updatePlatformTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury address");
        address oldTreasury = platformTreasury;
        platformTreasury = newTreasury;
        emit PlatformTreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Update token address (only factory, only once)
     * @param tokenAddress Address of the token contract
     */
    function updateTokenAddress(address tokenAddress) external onlyOwner {
        require(address(token) == address(0), "Token already set");
        require(tokenAddress != address(0), "Invalid token address");
        token = BaseToken(tokenAddress);
    }

    /**
     * @notice Emergency function to migrate manually (only factory)
     */
    function emergencyMigrate() external onlyOwner {
        require(!migrated, "Already migrated");
        _triggerMigration();
    }

    /**
     * @notice Calculate total fees for an amount
     * @param amount Amount to calculate fees for
     * @return totalFees Total fees to be deducted
     */
    function _calculateFees(uint256 amount) internal pure returns (uint256 totalFees) {
        uint256 platformFee = (amount * PLATFORM_FEE_BPS) / 10000;
        uint256 creatorFee = (amount * CREATOR_FEE_BPS) / 10000;
        totalFees = platformFee + creatorFee;
    }

    /**
     * @notice Distribute fees to platform and creator
     * @param totalFees Total fees to distribute
     */
    function _distributeFees(uint256 totalFees) internal {
        if (totalFees == 0) return;

        uint256 platformFee = (totalFees * PLATFORM_FEE_BPS) / (PLATFORM_FEE_BPS + CREATOR_FEE_BPS);
        uint256 creatorFee = totalFees - platformFee;

        // Transfer platform fee
        if (platformFee > 0) {
            (bool success1, ) = platformTreasury.call{value: platformFee}("");
            require(success1, "Platform fee transfer failed");
            emit FeesCollected(platformTreasury, platformFee, "platform");
        }

        // Transfer creator fee
        if (creatorFee > 0) {
            (bool success2, ) = creator.call{value: creatorFee}("");
            require(success2, "Creator fee transfer failed");
            emit FeesCollected(creator, creatorFee, "creator");
        }
    }

    /**
     * @notice Trigger migration to DEX
     */
    function _triggerMigration() internal {
        require(!migrated, "Already migrated");
        migrated = true;

        // Calculate liquidity amounts (80% of ETH balance for liquidity)
        uint256 liquidityEth = (address(this).balance * 8000) / 10000;
        uint256 liquidityTokens = token.balanceOf(address(this));

        // Mark token as migrated
        token.markMigrated(address(this), liquidityEth);

        emit CurveMigrated(liquidityEth, liquidityTokens);
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {
        // Allow receiving ETH for liquidity
    }
}