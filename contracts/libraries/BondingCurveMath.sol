// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BondingCurveMath
 * @notice Mathematical functions for exponential bonding curve calculations
 * @dev Uses fixed-point arithmetic for precision
 */
library BondingCurveMath {
    uint256 private constant PRECISION = 1e18;
    uint256 private constant BASE_PRICE = 1e13; // 0.00001 ETH base price
    uint256 private constant CURVE_EXPONENT = 15e17; // 1.5 exponent (1.5 * 1e18)
    uint256 private constant MAX_SUPPLY_CURVE = 700_000_000 * 1e18; // 70% of 1B tokens

    /**
     * @notice Calculate the integral of the bonding curve price function
     * @dev Integral of y = BASE_PRICE * x^1.5 from 0 to supply
     * @param supply Token supply for integration
     * @return integral The integral value
     */
    function calculateIntegral(uint256 supply) internal pure returns (uint256 integral) {
        if (supply == 0) return 0;
        
        // Integral of x^1.5 is (2/2.5) * x^2.5 = 0.8 * x^2.5
        // We calculate x^2.5 = x^2 * sqrt(x)
        uint256 supplySquared = (supply * supply) / PRECISION;
        uint256 supplySqrt = sqrt(supply);
        uint256 supply25 = (supplySquared * supplySqrt) / PRECISION;
        
        // Apply coefficient: BASE_PRICE * 0.8
        integral = (BASE_PRICE * 8 * supply25) / (10 * PRECISION);
    }

    /**
     * @notice Calculate price at specific supply point
     * @dev y = BASE_PRICE * supply^1.5
     * @param supply Current token supply
     * @return price Price per token at given supply
     */
    function calculatePrice(uint256 supply) internal pure returns (uint256 price) {
        if (supply == 0) return BASE_PRICE;
        
        // Calculate supply^1.5 = supply * sqrt(supply)
        uint256 supplySqrt = sqrt(supply);
        uint256 supply15 = (supply * supplySqrt) / PRECISION;
        
        price = (BASE_PRICE * supply15) / PRECISION;
    }

    /**
     * @notice Calculate tokens received for ETH amount using integral method
     * @param currentSupply Current circulating supply
     * @param ethAmount ETH amount to spend
     * @return tokenAmount Tokens that would be received
     */
    function calculateTokensOut(
        uint256 currentSupply,
        uint256 ethAmount
    ) internal pure returns (uint256 tokenAmount) {
        require(currentSupply <= MAX_SUPPLY_CURVE, "Supply exceeds curve limit");
        
        uint256 currentIntegral = calculateIntegral(currentSupply);
        uint256 targetIntegral = currentIntegral + ethAmount;
        
        // Binary search to find supply that gives target integral
        uint256 low = currentSupply;
        uint256 high = MAX_SUPPLY_CURVE;
        uint256 tolerance = 1e15; // 0.001 token tolerance
        
        while (high - low > tolerance) {
            uint256 mid = (low + high) / 2;
            uint256 midIntegral = calculateIntegral(mid);
            
            if (midIntegral < targetIntegral) {
                low = mid;
            } else {
                high = mid;
            }
        }
        
        tokenAmount = low - currentSupply;
        
        // Ensure we don't exceed curve limit
        if (currentSupply + tokenAmount > MAX_SUPPLY_CURVE) {
            tokenAmount = MAX_SUPPLY_CURVE - currentSupply;
        }
    }

    /**
     * @notice Calculate ETH received for token amount using integral method
     * @param currentSupply Current circulating supply
     * @param tokenAmount Tokens to sell
     * @return ethAmount ETH that would be received
     */
    function calculateEthOut(
        uint256 currentSupply,
        uint256 tokenAmount
    ) internal pure returns (uint256 ethAmount) {
        require(tokenAmount <= currentSupply, "Cannot sell more than supply");
        
        uint256 newSupply = currentSupply - tokenAmount;
        uint256 currentIntegral = calculateIntegral(currentSupply);
        uint256 newIntegral = calculateIntegral(newSupply);
        
        ethAmount = currentIntegral - newIntegral;
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