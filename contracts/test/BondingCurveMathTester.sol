// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/BondingCurveMath.sol";

/**
 * @title BondingCurveMathTester
 * @notice Test contract that exposes BondingCurveMath library functions
 * @dev Used for testing the mathematical functions in isolation
 */
contract BondingCurveMathTester {
    using BondingCurveMath for uint256;

    /**
     * @notice Test the calculateIntegral function
     */
    function calculateIntegral(uint256 supply) external pure returns (uint256) {
        return BondingCurveMath.calculateIntegral(supply);
    }

    /**
     * @notice Test the calculatePrice function
     */
    function calculatePrice(uint256 supply) external pure returns (uint256) {
        return BondingCurveMath.calculatePrice(supply);
    }

    /**
     * @notice Test the calculateTokensOut function
     */
    function calculateTokensOut(uint256 currentSupply, uint256 ethAmount) external pure returns (uint256) {
        return BondingCurveMath.calculateTokensOut(currentSupply, ethAmount);
    }

    /**
     * @notice Test the calculateEthOut function
     */
    function calculateEthOut(uint256 currentSupply, uint256 tokenAmount) external pure returns (uint256) {
        return BondingCurveMath.calculateEthOut(currentSupply, tokenAmount);
    }

    /**
     * @notice Test the sqrt function
     */
    function sqrt(uint256 x) external pure returns (uint256) {
        return BondingCurveMath.sqrt(x);
    }

    /**
     * @notice Test the getMaxCurveSupply function
     */
    function getMaxCurveSupply() external pure returns (uint256) {
        return BondingCurveMath.getMaxCurveSupply();
    }

    /**
     * @notice Test the getBasePrice function
     */
    function getBasePrice() external pure returns (uint256) {
        return BondingCurveMath.getBasePrice();
    }

    /**
     * @notice Test the isReadyForMigration function
     */
    function isReadyForMigration(uint256 currentSupply) external pure returns (bool) {
        return BondingCurveMath.isReadyForMigration(currentSupply);
    }

    /**
     * @notice Test the calculateProgress function
     */
    function calculateProgress(uint256 currentSupply) external pure returns (uint256) {
        return BondingCurveMath.calculateProgress(currentSupply);
    }
}