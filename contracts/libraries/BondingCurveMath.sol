// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BondingCurveMath
 * @notice Mathematical functions for exponential bonding curve calculations
 * @dev Uses fixed-point arithmetic for precision
 */
library BondingCurveMath {
    uint256 private constant PRECISION = 1e18;
    uint256 private constant BASE_PRICE = 1e12; // 0.000001 ETH base price (higher to prevent $0.00 prices)
    uint256 private constant CURVE_EXPONENT = 15e17; // 1.5 exponent (1.5 * 1e18)
    uint256 private constant MAX_SUPPLY_CURVE = 700_000_000 * 1e18; // 70% of 1B tokens

    /**
     * @notice Calculate the integral of the bonding curve price function
     * @dev Integral approximation for practical use in trading
     * @param supply Token supply for integration
     * @return integral The integral value
     */
    function calculateIntegral(uint256 supply) internal pure returns (uint256 integral) {
        if (supply == 0) return 0;
        
        // Simplified integral calculation for the adjusted formula
        // Using average price * supply as approximation
        uint256 startPrice = BASE_PRICE;
        uint256 endPrice = calculatePrice(supply);
        uint256 avgPrice = (startPrice + endPrice) / 2;
        
        integral = (avgPrice * supply) / PRECISION;
    }

    /**
     * @notice Calculate price at specific supply point
     * @dev y = BASE_PRICE * (1 + supply/PRECISION)^1.5
     * @param supply Current token supply
     * @return price Price per token at given supply
     */
    function calculatePrice(uint256 supply) internal pure returns (uint256 price) {
        if (supply == 0) return BASE_PRICE;
        
        // Add 1 to supply in terms of precision to avoid zero price
        // This makes the formula: BASE_PRICE * (1 + supply/PRECISION)^1.5
        uint256 adjustedSupply = PRECISION + supply;
        
        // Calculate adjustedSupply^1.5 = adjustedSupply * sqrt(adjustedSupply)
        uint256 supplySqrt = sqrt(adjustedSupply);
        uint256 supply15 = (adjustedSupply * supplySqrt) / PRECISION;
        
        // Apply base price
        price = (BASE_PRICE * supply15) / PRECISION;
        
        // Ensure minimum price
        if (price < BASE_PRICE) {
            price = BASE_PRICE;
        }
    }

    /**
     * @notice Calculate tokens received for ETH amount using average price method
     * @param currentSupply Current circulating supply
     * @param ethAmount ETH amount to spend
     * @return tokenAmount Tokens that would be received
     */
    function calculateTokensOut(
        uint256 currentSupply,
        uint256 ethAmount
    ) internal pure returns (uint256 tokenAmount) {
        require(currentSupply <= MAX_SUPPLY_CURVE, "Supply exceeds curve limit");
        require(ethAmount > 0, "ETH amount must be positive");
        
        // Calculate current price
        uint256 currentPrice = calculatePrice(currentSupply);
        
        // Estimate token amount using current price as starting point
        uint256 estimatedTokens = (ethAmount * PRECISION) / currentPrice;
        
        // Cap estimated tokens to remaining supply
        uint256 remainingSupply = MAX_SUPPLY_CURVE - currentSupply;
        if (estimatedTokens > remainingSupply) {
            estimatedTokens = remainingSupply;
        }
        
        // Use iterative approximation for accuracy
        tokenAmount = estimatedTokens;
        for (uint256 i = 0; i < 5; i++) {
            uint256 newSupply = currentSupply + tokenAmount;
            uint256 avgPrice = (calculatePrice(currentSupply) + calculatePrice(newSupply)) / 2;
            uint256 adjustedTokenAmount = (ethAmount * PRECISION) / avgPrice;
            
            if (adjustedTokenAmount > remainingSupply) {
                tokenAmount = remainingSupply;
                break;
            }
            
            tokenAmount = adjustedTokenAmount;
        }
        
        // Final safety check
        if (tokenAmount == 0 && ethAmount > 0) {
            tokenAmount = 1; // Minimum 1 wei token
        }
    }

    /**
     * @notice Calculate ETH received for token amount using average price method
     * @param currentSupply Current circulating supply
     * @param tokenAmount Tokens to sell
     * @return ethAmount ETH that would be received
     */
    function calculateEthOut(
        uint256 currentSupply,
        uint256 tokenAmount
    ) internal pure returns (uint256 ethAmount) {
        require(tokenAmount <= currentSupply, "Cannot sell more than supply");
        require(tokenAmount > 0, "Token amount must be positive");
        
        uint256 newSupply = currentSupply - tokenAmount;
        
        // Calculate average price between current and new supply
        uint256 currentPrice = calculatePrice(currentSupply);
        uint256 newPrice = calculatePrice(newSupply);
        uint256 avgPrice = (currentPrice + newPrice) / 2;
        
        // Calculate ETH amount using average price
        ethAmount = (avgPrice * tokenAmount) / PRECISION;
        
        // Ensure we return at least some ETH for any token amount
        if (ethAmount == 0 && tokenAmount > 0) {
            ethAmount = 1; // Minimum 1 wei ETH
        }
    }

    /**
     * @notice Calculate square root using Babylonian method
     * @param x Number to find square root of
     * @return y Square root of x
     */
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    /**
     * @notice Get maximum supply available on bonding curve
     * @return maxSupply Maximum supply (70% of total)
     */
    function getMaxCurveSupply() internal pure returns (uint256 maxSupply) {
        return MAX_SUPPLY_CURVE;
    }

    /**
     * @notice Get base price for bonding curve
     * @return basePrice Base price in wei
     */
    function getBasePrice() internal pure returns (uint256 basePrice) {
        return BASE_PRICE;
    }

    /**
     * @notice Check if supply has reached migration threshold
     * @param currentSupply Current token supply
     * @return ready True if ready for migration
     */
    function isReadyForMigration(uint256 currentSupply) internal pure returns (bool ready) {
        return currentSupply >= MAX_SUPPLY_CURVE;
    }

    /**
     * @notice Calculate curve progress in basis points
     * @param currentSupply Current token supply
     * @return progressBps Progress in basis points (0-10000)
     */
    function calculateProgress(uint256 currentSupply) internal pure returns (uint256 progressBps) {
        if (currentSupply >= MAX_SUPPLY_CURVE) return 10000;
        return (currentSupply * 10000) / MAX_SUPPLY_CURVE;
    }
}