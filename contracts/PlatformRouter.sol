// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PlatformRouter
 * @notice Router that intercepts swaps and collects platform fees
 * @dev Supports both Uniswap V2 and V3 routing with MEV resistance
 */
contract PlatformRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Platform fee in basis points (0.5%)
    uint256 public constant PLATFORM_FEE_BPS = 50;

    /// @notice Fee distribution percentages
    uint256 public constant TREASURY_SHARE_BPS = 5000; // 50%
    uint256 public constant CREATOR_SHARE_BPS = 2000;  // 20%
    uint256 public constant HOLDERS_SHARE_BPS = 3000;  // 30%

    /// @notice Platform treasury address
    address public platformTreasury;

    /// @notice Rewards vault address
    address public rewardsVault;

    /// @notice Uniswap V2 router address
    address public uniswapV2Router;

    /// @notice Uniswap V3 router address
    address public uniswapV3Router;

    /// @notice Mapping from token to creator address
    mapping(address => address) public tokenCreators;

    /// @notice Mapping to track registered platform tokens
    mapping(address => bool) public platformTokens;

    /// @notice Minimum swap amount to avoid dust
    uint256 public constant MIN_SWAP_AMOUNT = 1e15; // 0.001 ETH

    /// @notice Maximum slippage allowed (5%)
    uint256 public constant MAX_SLIPPAGE_BPS = 500;

    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMin;
        address to;
        uint256 deadline;
        bytes routerCalldata;
        bool useV3;
    }

    /**
     * @notice Emitted when a swap is executed with fees collected
     * @param user Address executing the swap
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Input amount
     * @param amountOut Output amount received
     * @param feeAmount Platform fee collected
     */
    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 feeAmount
    );

    /**
     * @notice Emitted when fees are distributed
     * @param token Token for which fees were distributed
     * @param treasuryAmount Amount sent to treasury
     * @param creatorAmount Amount sent to creator
     * @param holdersAmount Amount sent to rewards vault
     */
    event FeesDistributed(
        address indexed token,
        uint256 treasuryAmount,
        uint256 creatorAmount,
        uint256 holdersAmount
    );

    /**
     * @notice Emitted when a token is registered
     * @param token Token address
     * @param creator Creator address
     */
    event TokenRegistered(address indexed token, address indexed creator);

    /**
     * @notice Constructor sets up router with initial parameters
     * @param owner_ Initial owner address
     * @param platformTreasury_ Platform treasury address
     * @param rewardsVault_ Rewards vault address
     * @param uniswapV2Router_ Uniswap V2 router address
     * @param uniswapV3Router_ Uniswap V3 router address
     */
    constructor(
        address owner_,
        address platformTreasury_,
        address rewardsVault_,
        address uniswapV2Router_,
        address uniswapV3Router_
    ) Ownable(owner_) {
        require(owner_ != address(0), "Invalid owner");
        require(platformTreasury_ != address(0), "Invalid treasury");
        require(rewardsVault_ != address(0), "Invalid rewards vault");
        require(uniswapV2Router_ != address(0), "Invalid V2 router");
        require(uniswapV3Router_ != address(0), "Invalid V3 router");

        platformTreasury = platformTreasury_;
        rewardsVault = rewardsVault_;
        uniswapV2Router = uniswapV2Router_;
        uniswapV3Router = uniswapV3Router_;
    }

    /**
     * @notice Register a platform token with creator info
     * @param token Token address to register
     * @param creator Creator address
     */
    function registerToken(address token, address creator) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(creator != address(0), "Invalid creator address");
        require(!platformTokens[token], "Token already registered");

        platformTokens[token] = true;
        tokenCreators[token] = creator;

        emit TokenRegistered(token, creator);
    }

    /**
     * @notice Execute swap with platform fee collection
     * @param params Swap parameters
     * @return amountOut Amount of output tokens received
     */
    function swapWithFee(SwapParams calldata params) 
        external 
        payable 
        nonReentrant 
        returns (uint256 amountOut) 
    {
        require(params.amountIn >= MIN_SWAP_AMOUNT, "Swap amount too small");
        require(params.deadline >= block.timestamp, "Swap deadline exceeded");
        require(params.to != address(0), "Invalid recipient");

        // Determine if this involves a platform token
        bool isPlatformTokenSwap = platformTokens[params.tokenIn] || platformTokens[params.tokenOut];
        
        if (isPlatformTokenSwap) {
            return _swapWithPlatformFee(params);
        } else {
            return _swapWithoutFee(params);
        }
    }

    /**
     * @notice Execute swap for platform tokens with fee collection
     * @param params Swap parameters
     * @return amountOut Amount received after fees
     */
    function _swapWithPlatformFee(SwapParams calldata params) 
        internal 
        returns (uint256 amountOut) 
    {
        // Calculate platform fee
        uint256 feeAmount = (params.amountIn * PLATFORM_FEE_BPS) / 10000;
        uint256 swapAmount = params.amountIn - feeAmount;

        // Handle ETH vs ERC20 input
        if (params.tokenIn == address(0)) {
            require(msg.value == params.amountIn, "Incorrect ETH amount");
        } else {
            IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        }

        // Execute the swap with reduced amount
        SwapParams memory adjustedParams = params;
        adjustedParams.amountIn = swapAmount;
        adjustedParams.amountOutMin = _adjustMinAmountOut(params.amountOutMin, feeAmount, params.amountIn);

        amountOut = _executeSwap(adjustedParams);

        // Distribute fees
        _distributeFees(params.tokenIn, params.tokenOut, feeAmount);

        emit SwapExecuted(
            msg.sender,
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            amountOut,
            feeAmount
        );
    }

    /**
     * @notice Execute swap without platform fees (for non-platform tokens)
     * @param params Swap parameters
     * @return amountOut Amount received
     */
    function _swapWithoutFee(SwapParams calldata params) 
        internal 
        returns (uint256 amountOut) 
    {
        // Handle ETH vs ERC20 input
        if (params.tokenIn == address(0)) {
            require(msg.value == params.amountIn, "Incorrect ETH amount");
        } else {
            IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        }

        amountOut = _executeSwap(params);

        emit SwapExecuted(
            msg.sender,
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            amountOut,
            0
        );
    }

    /**
     * @notice Execute the actual swap on Uniswap
     * @param params Swap parameters
     * @return amountOut Amount received from swap
     */
    function _executeSwap(SwapParams memory params) 
        internal 
        returns (uint256 amountOut) 
    {
        address router = params.useV3 ? uniswapV3Router : uniswapV2Router;
        
        // Approve tokens if needed
        if (params.tokenIn != address(0)) {
            IERC20(params.tokenIn).safeIncreaseAllowance(router, params.amountIn);
        }

        // Get balance before swap
        uint256 balanceBefore;
        if (params.tokenOut == address(0)) {
            balanceBefore = params.to.balance;
        } else {
            balanceBefore = IERC20(params.tokenOut).balanceOf(params.to);
        }

        // Execute swap via low-level call
        (bool success, ) = router.call{value: params.tokenIn == address(0) ? params.amountIn : 0}(
            params.routerCalldata
        );
        require(success, "Swap execution failed");

        // Calculate amount received
        if (params.tokenOut == address(0)) {
            amountOut = params.to.balance - balanceBefore;
        } else {
            amountOut = IERC20(params.tokenOut).balanceOf(params.to) - balanceBefore;
        }

        require(amountOut >= params.amountOutMin, "Insufficient output amount");
    }

    /**
     * @notice Distribute collected fees to treasury, creator, and holders
     * @param tokenIn Input token (fee collection token)
     * @param tokenOut Output token (to determine creator)
     * @param feeAmount Total fee amount to distribute
     */
    function _distributeFees(address tokenIn, address tokenOut, uint256 feeAmount) 
        internal 
    {
        if (feeAmount == 0) return;

        // Determine which token to use for creator lookup
        address platformToken = platformTokens[tokenIn] ? tokenIn : tokenOut;
        address creator = tokenCreators[platformToken];

        // Calculate distribution amounts
        uint256 treasuryAmount = (feeAmount * TREASURY_SHARE_BPS) / 10000;
        uint256 creatorAmount = (feeAmount * CREATOR_SHARE_BPS) / 10000;
        uint256 holdersAmount = feeAmount - treasuryAmount - creatorAmount;

        // Distribute to treasury
        if (treasuryAmount > 0) {
            _transferFee(tokenIn, platformTreasury, treasuryAmount);
        }

        // Distribute to creator
        if (creatorAmount > 0 && creator != address(0)) {
            _transferFee(tokenIn, creator, creatorAmount);
        }

        // Distribute to rewards vault for holders
        if (holdersAmount > 0) {
            _transferFee(tokenIn, rewardsVault, holdersAmount);
        }

        emit FeesDistributed(platformToken, treasuryAmount, creatorAmount, holdersAmount);
    }

    /**
     * @notice Transfer fee amount to recipient
     * @param token Token to transfer (address(0) for ETH)
     * @param to Recipient address
     * @param amount Amount to transfer
     */
    function _transferFee(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    /**
     * @notice Adjust minimum amount out based on fee deduction
     * @param originalMinOut Original minimum amount out
     * @param feeAmount Fee amount deducted
     * @param totalAmountIn Total input amount
     * @return adjustedMinOut Adjusted minimum amount out
     */
    function _adjustMinAmountOut(
        uint256 originalMinOut,
        uint256 feeAmount,
        uint256 totalAmountIn
    ) internal pure returns (uint256 adjustedMinOut) {
        // Proportionally reduce min out based on fee
        uint256 feeRatio = (feeAmount * 10000) / totalAmountIn;
        adjustedMinOut = originalMinOut - ((originalMinOut * feeRatio) / 10000);
    }

    /**
     * @notice Update platform treasury address
     * @param newTreasury New treasury address
     */
    function updatePlatformTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury address");
        platformTreasury = newTreasury;
    }

    /**
     * @notice Update rewards vault address
     * @param newRewardsVault New rewards vault address
     */
    function updateRewardsVault(address newRewardsVault) external onlyOwner {
        require(newRewardsVault != address(0), "Invalid rewards vault address");
        rewardsVault = newRewardsVault;
    }

    /**
     * @notice Update Uniswap router addresses
     * @param newV2Router New V2 router address
     * @param newV3Router New V3 router address
     */
    function updateRouters(address newV2Router, address newV3Router) external onlyOwner {
        require(newV2Router != address(0), "Invalid V2 router");
        require(newV3Router != address(0), "Invalid V3 router");
        uniswapV2Router = newV2Router;
        uniswapV3Router = newV3Router;
    }

    /**
     * @notice Emergency withdraw function for stuck tokens
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
        // Allow receiving ETH for swaps
    }
}