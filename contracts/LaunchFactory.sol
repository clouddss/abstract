// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ILaunchFactory.sol";
import "./BaseToken.sol";
import "./BondingCurve.sol";

/**
 * @title LaunchFactory
 * @notice Factory contract for deploying tokens with bonding curves
 * @dev Uses minimal proxy pattern for gas-efficient deployments
 */
contract LaunchFactory is ILaunchFactory, Ownable, ReentrancyGuard {
    
    /// @notice Launch fee required for creating new tokens
    uint256 public launchFee = 0.01 ether;

    /// @notice Platform treasury address
    address public platformTreasury;

    // Removed template contracts - using direct deployment instead

    /// @notice Array of all launched tokens
    address[] public allTokens;

    /// @notice Mapping from token address to token info
    mapping(address => TokenInfo) public tokenInfo;

    /// @notice Token information structure
    struct TokenInfo {
        TokenMetadata metadata;
        address creator;
        address bondingCurve;
        bool migrated;
        uint256 createdAt;
    }

    /**
     * @notice Emitted when launch fee is updated
     * @param oldFee Previous launch fee
     * @param newFee New launch fee
     */
    event LaunchFeeUpdated(uint256 oldFee, uint256 newFee);

    /**
     * @notice Emitted when platform treasury is updated
     * @param oldTreasury Previous treasury address
     * @param newTreasury New treasury address
     */
    event PlatformTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /**
     * @notice Constructor deploys template contracts and sets initial parameters
     * @param owner_ Initial owner of the factory
     * @param platformTreasury_ Platform treasury address
     */
    constructor(address owner_, address platformTreasury_) Ownable(owner_) {
        require(owner_ != address(0), "Invalid owner address");
        require(platformTreasury_ != address(0), "Invalid treasury address");

        platformTreasury = platformTreasury_;
    }

    /**
     * @notice Launch a new token with bonding curve
     * @param metadata Token metadata including name, symbol, etc.
     * @return tokenAddress Address of the created token
     * @return bondingCurve Address of the bonding curve
     */
    function launchToken(TokenMetadata calldata metadata)
        external
        payable
        override
        nonReentrant
        returns (address tokenAddress, address bondingCurve)
    {
        require(msg.value >= launchFee, "Insufficient launch fee");
        require(bytes(metadata.name).length > 0, "Token name required");
        require(bytes(metadata.symbol).length > 0, "Token symbol required");
        require(bytes(metadata.symbol).length <= 10, "Token symbol too long");
        
        // Basic validation (detailed validation done off-chain)
        require(bytes(metadata.description).length <= 500, "Description too long");

        // Generate deterministic salt for CREATE2
        bytes32 salt = keccak256(abi.encodePacked(
            msg.sender,
            metadata.name,
            metadata.symbol,
            block.timestamp,
            allTokens.length
        ));

        // Deploy token contract
        tokenAddress = address(new BaseToken{salt: keccak256(abi.encodePacked(salt, "token"))}(
            metadata.name,
            metadata.symbol,
            BaseToken.TokenMetadata({
                description: metadata.description,
                imageUrl: metadata.imageUrl,
                website: metadata.website,
                twitter: metadata.twitter,
                telegram: metadata.telegram
            }),
            address(this), // Factory as temporary owner
            address(0) // Will be updated after bonding curve deployment
        ));

        // Deploy bonding curve contract
        bondingCurve = address(new BondingCurve{salt: salt}(
            tokenAddress,
            msg.sender,
            address(this),
            platformTreasury
        ));

        // Update token's bonding curve address
        BaseToken(tokenAddress).updateBondingCurve(bondingCurve);
        
        // Transfer ownership to the actual creator
        BaseToken(tokenAddress).transferOwnership(msg.sender);

        // Store token info
        tokenInfo[tokenAddress] = TokenInfo({
            metadata: metadata,
            creator: msg.sender,
            bondingCurve: bondingCurve,
            migrated: false,
            createdAt: block.timestamp
        });

        // Add to tokens array
        allTokens.push(tokenAddress);

        // Transfer launch fee to treasury
        if (msg.value > 0) {
            (bool success, ) = platformTreasury.call{value: msg.value}("");
            require(success, "Fee transfer failed");
        }

        emit TokenLaunched(tokenAddress, msg.sender, bondingCurve, metadata);
    }

    /**
     * @notice Migrate token to DEX when threshold is reached
     * @param tokenAddress Address of the token to migrate
     */
    function migrateToken(address tokenAddress) external override {
        require(tokenInfo[tokenAddress].creator != address(0), "Token not found");
        require(!tokenInfo[tokenAddress].migrated, "Token already migrated");

        BondingCurve bondingCurve = BondingCurve(payable(tokenInfo[tokenAddress].bondingCurve));
        require(bondingCurve.isReadyForMigration(), "Token not ready for migration");

        // Trigger migration on bonding curve
        bondingCurve.emergencyMigrate();

        // Update migration status
        tokenInfo[tokenAddress].migrated = true;

        // For now, we'll emit with the bonding curve address as DEX pair
        // In a full implementation, this would create a real Uniswap pair
        emit TokenMigrated(tokenAddress, tokenInfo[tokenAddress].bondingCurve, 0);
    }

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
        override
        returns (
            TokenMetadata memory metadata,
            address creator,
            address bondingCurve,
            bool migrated
        )
    {
        TokenInfo storage info = tokenInfo[tokenAddress];
        return (info.metadata, info.creator, info.bondingCurve, info.migrated);
    }

    /**
     * @notice Get all launched tokens
     * @return tokens Array of token addresses
     */
    function getAllTokens() external view override returns (address[] memory tokens) {
        return allTokens;
    }


    /**
     * @notice Get launch fee required for creating new token
     * @return fee Launch fee in wei
     */
    function getLaunchFee() external view override returns (uint256 fee) {
        return launchFee;
    }

    /**
     * @notice Get total number of launched tokens
     * @return count Total token count
     */
    function getTokenCount() external view returns (uint256 count) {
        return allTokens.length;
    }

    /**
     * @notice Update launch fee (only owner)
     * @param newFee New launch fee
     */
    function updateLaunchFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = launchFee;
        launchFee = newFee;
        emit LaunchFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Update platform treasury (only owner)
     * @param newTreasury New treasury address
     */
    function updatePlatformTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury address");
        address oldTreasury = platformTreasury;
        platformTreasury = newTreasury;
        emit PlatformTreasuryUpdated(oldTreasury, newTreasury);
    }

}