// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IBondingCurve
 * @notice Interface for bonding curve mechanism with exponential pricing
 */
interface IBondingCurve {
    /**
     * @notice Emitted when tokens are purchased through the bonding curve
     * @param buyer Address of the token buyer
     * @param ethAmount Amount of ETH spent
     * @param tokenAmount Amount of tokens received
     * @param newPrice New price per token after purchase
     */
    event TokensPurchased(
        address indexed buyer,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 newPrice
    );

    /**
     * @notice Emitted when tokens are sold through the bonding curve
     * @param seller Address of the token seller
     * @param tokenAmount Amount of tokens sold
     * @param ethAmount Amount of ETH received
     * @param newPrice New price per token after sale
     */
    event TokensSold(
        address indexed seller,
        uint256 tokenAmount,
        uint256 ethAmount,
        uint256 newPrice
    );

    /**
     * @notice Emitted when curve threshold is reached and migration to DEX occurs
     * @param liquidityAmount Amount of ETH used for DEX liquidity
     * @param tokenAmount Amount of tokens used for DEX liquidity
     */
    event CurveMigrated(uint256 liquidityAmount, uint256 tokenAmount);

    /**
     * @notice Calculate token price at current supply
     * @return price Current price per token in wei
     */
    function getCurrentPrice() external view returns (uint256 price);

    /**
     * @notice Calculate tokens received for ETH amount
     * @param ethAmount Amount of ETH to spend
     * @return tokenAmount Amount of tokens that would be received
     */
    function calculateTokensOut(uint256 ethAmount) external view returns (uint256 tokenAmount);

    /**
     * @notice Calculate ETH received for token amount
     * @param tokenAmount Amount of tokens to sell
     * @return ethAmount Amount of ETH that would be received
     */
    function calculateEthOut(uint256 tokenAmount) external view returns (uint256 ethAmount);

    /**
     * @notice Purchase tokens with ETH
     * @param minTokensOut Minimum tokens expected (slippage protection)
     * @return tokenAmount Actual tokens received
     */
    function buyTokens(uint256 minTokensOut) external payable returns (uint256 tokenAmount);

    /**
     * @notice Sell tokens for ETH
     * @param tokenAmount Amount of tokens to sell
     * @param minEthOut Minimum ETH expected (slippage protection)
     * @return ethAmount Actual ETH received
     */
    function sellTokens(uint256 tokenAmount, uint256 minEthOut) external returns (uint256 ethAmount);

    /**
     * @notice Check if curve has reached migration threshold
     * @return true if ready for DEX migration
     */
    function isReadyForMigration() external view returns (bool);

    /**
     * @notice Get current curve progress
     * @return soldSupply Amount of tokens sold through curve
     * @return totalSupply Total supply available on curve
     * @return progressBps Progress in basis points (0-10000)
     */
    function getCurveProgress() external view returns (
        uint256 soldSupply,
        uint256 totalSupply,
        uint256 progressBps
    );
}