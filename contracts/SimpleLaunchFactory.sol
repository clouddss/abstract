// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SimpleLaunchFactory
 * @notice Simplified factory contract for basic token launch tracking
 * @dev Minimal implementation without complex CREATE2 deployments
 */
contract SimpleLaunchFactory is Ownable, ReentrancyGuard {
    /// @notice Launch fee required for creating new tokens
    uint256 public launchFee = 0.01 ether;

    /// @notice Platform treasury address
    address public platformTreasury;

    /// @notice Array of all launched tokens
    address[] public allTokens;

    /// @notice Simple token info structure
    struct SimpleTokenInfo {
        string name;
        string symbol;
        address creator;
        address tokenAddress;
        address bondingCurve;
        uint256 createdAt;
    }

    /// @notice Mapping from token address to token info
    mapping(address => SimpleTokenInfo) public tokenInfo;

    /**
     * @notice Emitted when a token is registered
     * @param tokenAddress Address of the token
     * @param creator Address of the token creator
     * @param bondingCurve Address of the bonding curve
     */
    event TokenRegistered(
        address indexed tokenAddress,
        address indexed creator,
        address indexed bondingCurve
    );

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
     * @notice Constructor sets initial parameters
     * @param owner_ Initial owner of the factory
     * @param platformTreasury_ Platform treasury address
     */
    constructor(address owner_, address platformTreasury_) Ownable(owner_) {
        require(owner_ != address(0), "Invalid owner address");
        require(platformTreasury_ != address(0), "Invalid treasury address");
        platformTreasury = platformTreasury_;
    }

    /**
     * @notice Register a token that was deployed externally
     * @param tokenAddress Address of the deployed token
     * @param bondingCurve Address of the bonding curve
     * @param name Token name
     * @param symbol Token symbol
     */
    function registerToken(
        address tokenAddress,
        address bondingCurve,
        string calldata name,
        string calldata symbol
    ) external payable nonReentrant {
        require(msg.value >= launchFee, "Insufficient launch fee");
        require(tokenAddress != address(0), "Invalid token address");
        require(bondingCurve != address(0), "Invalid bonding curve address");
        require(bytes(name).length > 0, "Token name required");
        require(bytes(symbol).length > 0, "Token symbol required");
        require(tokenInfo[tokenAddress].creator == address(0), "Token already registered");

        // Store token info
        tokenInfo[tokenAddress] = SimpleTokenInfo({
            name: name,
            symbol: symbol,
            creator: msg.sender,
            tokenAddress: tokenAddress,
            bondingCurve: bondingCurve,
            createdAt: block.timestamp
        });

        // Add to tokens array
        allTokens.push(tokenAddress);

        // Transfer launch fee to treasury
        if (msg.value > 0) {
            (bool success, ) = platformTreasury.call{value: msg.value}("");
            require(success, "Fee transfer failed");
        }

        emit TokenRegistered(tokenAddress, msg.sender, bondingCurve);
    }

    /**
     * @notice Get all launched tokens
     * @return tokens Array of token addresses
     */
    function getAllTokens() external view returns (address[] memory tokens) {
        return allTokens;
    }

    /**
     * @notice Get token info by address
     * @param tokenAddress Address of the token
     * @return info Token information
     */
    function getTokenInfo(address tokenAddress) external view returns (SimpleTokenInfo memory info) {
        return tokenInfo[tokenAddress];
    }

    /**
     * @notice Get launch fee required for registering token
     * @return fee Launch fee in wei
     */
    function getLaunchFee() external view returns (uint256 fee) {
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

    /**
     * @notice Get tokens by creator
     * @param creator Creator address
     * @return tokens Array of token addresses created by the user
     */
    function getTokensByCreator(address creator) external view returns (address[] memory tokens) {
        uint256 count = 0;
        
        // Count tokens by creator
        for (uint256 i = 0; i < allTokens.length; i++) {
            if (tokenInfo[allTokens[i]].creator == creator) {
                count++;
            }
        }

        // Populate result array
        tokens = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allTokens.length; i++) {
            if (tokenInfo[allTokens[i]].creator == creator) {
                tokens[index] = allTokens[i];
                index++;
            }
        }
    }
}