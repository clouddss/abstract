// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BaseToken
 * @notice ERC-20 token with metadata storage and permit functionality
 * @dev Deployed by LaunchFactory with initial supply on bonding curve
 */
contract BaseToken is ERC20, ERC20Permit, Ownable, ReentrancyGuard {
    /// @notice Maximum total supply (1 billion tokens)
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;

    /// @notice Token metadata structure
    struct TokenMetadata {
        string description;
        string imageUrl;
        string website;
        string twitter;
        string telegram;
    }

    /// @notice Token metadata
    TokenMetadata public metadata;

    /// @notice Address of the bonding curve contract
    address public bondingCurve;

    /// @notice Whether the token has migrated to DEX
    bool public migrated;

    /// @notice Timestamp when liquidity was locked
    uint256 public liquidityLockTime;

    /// @notice Duration for liquidity lock (30 days)
    uint256 public constant LIQUIDITY_LOCK_DURATION = 30 days;

    /**
     * @notice Emitted when token metadata is updated
     * @param updater Address that updated metadata
     * @param newMetadata Updated metadata
     */
    event MetadataUpdated(address indexed updater, TokenMetadata newMetadata);

    /**
     * @notice Emitted when token migrates to DEX
     * @param dexPair Address of the created DEX pair
     * @param liquidityAmount Amount of liquidity locked
     */
    event TokenMigrated(address indexed dexPair, uint256 liquidityAmount);

    /**
     * @notice Emitted when ownership is renounced after migration
     * @param previousOwner Previous owner address
     */
    event OwnershipRenounced(address indexed previousOwner);

    /**
     * @notice Constructor sets up token with metadata
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param metadata_ Token metadata
     * @param creator_ Token creator (initial owner)
     * @param bondingCurve_ Bonding curve contract address
     */
    constructor(
        string memory name_,
        string memory symbol_,
        TokenMetadata memory metadata_,
        address creator_,
        address bondingCurve_
    ) ERC20(name_, symbol_) ERC20Permit(name_) Ownable(creator_) {
        require(bytes(name_).length > 0, "Name cannot be empty");
        require(bytes(symbol_).length > 0, "Symbol cannot be empty");
        require(creator_ != address(0), "Invalid creator address");
        require(bondingCurve_ != address(0), "Invalid bonding curve address");

        metadata = metadata_;
        bondingCurve = bondingCurve_;

        // Mint entire supply to bonding curve
        _mint(bondingCurve_, MAX_SUPPLY);
    }

    /**
     * @notice Update token metadata (only owner before migration)
     * @param newMetadata New metadata to set
     */
    function updateMetadata(TokenMetadata calldata newMetadata) external onlyOwner {
        require(!migrated, "Cannot update metadata after migration");
        metadata = newMetadata;
        emit MetadataUpdated(msg.sender, newMetadata);
    }

    /**
     * @notice Mark token as migrated and lock liquidity
     * @param dexPair Address of the DEX pair
     * @param liquidityAmount Amount of liquidity locked
     */
    function markMigrated(address dexPair, uint256 liquidityAmount) external {
        require(msg.sender == bondingCurve, "Only bonding curve can migrate");
        require(!migrated, "Already migrated");
        require(dexPair != address(0), "Invalid DEX pair");

        migrated = true;
        liquidityLockTime = block.timestamp;

        emit TokenMigrated(dexPair, liquidityAmount);
    }

    /**
     * @notice Renounce ownership after liquidity lock period
     * @dev Can only be called after migration and lock period
     */
    function renounceOwnershipAfterLock() external onlyOwner {
        require(migrated, "Token not migrated yet");
        require(
            block.timestamp >= liquidityLockTime + LIQUIDITY_LOCK_DURATION,
            "Liquidity lock period not ended"
        );

        address previousOwner = owner();
        _transferOwnership(address(0));

        emit OwnershipRenounced(previousOwner);
    }

    /**
     * @notice Check if liquidity lock period has ended
     * @return ended True if lock period has ended
     */
    function isLiquidityLockEnded() external view returns (bool ended) {
        if (!migrated) return false;
        return block.timestamp >= liquidityLockTime + LIQUIDITY_LOCK_DURATION;
    }

    /**
     * @notice Get remaining lock time
     * @return remainingTime Remaining lock time in seconds
     */
    function getRemainingLockTime() external view returns (uint256 remainingTime) {
        if (!migrated) return LIQUIDITY_LOCK_DURATION;
        
        uint256 unlockTime = liquidityLockTime + LIQUIDITY_LOCK_DURATION;
        if (block.timestamp >= unlockTime) return 0;
        
        return unlockTime - block.timestamp;
    }

    /**
     * @notice Get complete token information
     * @return Complete token information
     */
    function getTokenInfo() external view returns (
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint256 maxSupply_,
        TokenMetadata memory metadata_,
        address owner_,
        address bondingCurve_,
        bool migrated_,
        uint256 liquidityLockTime_
    ) {
        return (
            name(),
            symbol(),
            totalSupply(),
            MAX_SUPPLY,
            metadata,
            owner(),
            bondingCurve,
            migrated,
            liquidityLockTime
        );
    }

    /**
     * @notice Override transfer to prevent transfers before migration (optional)
     * @dev Uncomment if you want to restrict transfers before DEX migration
     */
    /*
    function _update(address from, address to, uint256 value) internal override {
        // Allow minting and bonding curve operations
        if (from == address(0) || from == bondingCurve || to == bondingCurve) {
            super._update(from, to, value);
            return;
        }
        
        // Require migration for other transfers
        require(migrated, "Transfers not allowed before migration");
        super._update(from, to, value);
    }
    */
}