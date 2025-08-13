// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILaunchFactory
 * @notice Interface for token launch factory
 */
interface ILaunchFactory {
    struct TokenMetadata {
        string name;
        string symbol;
        string description;
        string imageUrl;
        string website;
        string twitter;
        string telegram;
    }

    /**
     * @notice Emitted when a new token is launched
     * @param tokenAddress Address of the newly created token
     * @param creator Address of the token creator
     * @param bondingCurve Address of the bonding curve contract
     * @param metadata Token metadata
     */
    event TokenLaunched(
        address indexed tokenAddress,
        address indexed creator,
        address indexed bondingCurve,
        TokenMetadata metadata
    );

    /**
     * @notice Emitted when a token migrates to DEX
     * @param tokenAddress Address of the migrated token
     * @param dexPair Address of the created DEX pair
     * @param liquidityAmount Amount of liquidity added
     */
    event TokenMigrated(
        address indexed tokenAddress,
        address indexed dexPair,
        uint256 liquidityAmount
    );

    /**
     * @notice Launch a new token with bonding curve
     * @param metadata Token metadata including name, symbol, etc.
     * @return tokenAddress Address of the created token
     * @return bondingCurve Address of the bonding curve
     */
    function launchToken(TokenMetadata calldata metadata)
        external
        payable
        returns (address tokenAddress, address bondingCurve);

    /**
     * @notice Migrate token to DEX when threshold is reached
     * @param tokenAddress Address of the token to migrate
     */
    function migrateToken(address tokenAddress) external;

    /**
     * @notice Get token info by address
     * @param tokenAddress Address of the token
     * @return metadata Token metadata
     * @return creator Creator address
     * @return bondingCurve Bonding curve address
     * @return migrated Whether token has migrated to DEX
     */
    function getTokenInfo(address tokenAddress)
        external
        view
        returns (
            TokenMetadata memory metadata,
            address creator,
            address bondingCurve,
            bool migrated
        );

    /**
     * @notice Get all launched tokens
     * @return tokens Array of token addresses
     */
    function getAllTokens() external view returns (address[] memory tokens);

    /**
     * @notice Get launch fee required for creating new token
     * @return fee Launch fee in wei
     */
    function getLaunchFee() external view returns (uint256 fee);
}