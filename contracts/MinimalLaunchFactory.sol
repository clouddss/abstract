// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MinimalLaunchFactory
 * @notice Minimal factory for launching tokens - simplified version
 */
contract MinimalLaunchFactory is Ownable, ReentrancyGuard {
    uint256 public constant launchFee = 0.01 ether;
    address public platformTreasury;
    
    event TokenLaunched(
        address indexed token,
        address indexed creator,
        address indexed bondingCurve,
        string name,
        string symbol
    );
    
    constructor(address owner_, address treasury_) Ownable(owner_) {
        require(treasury_ != address(0), "Invalid treasury");
        platformTreasury = treasury_;
    }
    
    /**
     * @notice Deploy a new token (simplified)
     * @param name Token name
     * @param symbol Token symbol
     */
    function deployToken(
        string calldata name,
        string calldata symbol
    ) external payable nonReentrant returns (address token, address bondingCurve) {
        require(msg.value >= launchFee, "Insufficient fee");
        require(bytes(name).length > 0, "Name required");
        require(bytes(symbol).length > 0, "Symbol required");
        
        // For now, just emit event and return placeholder addresses
        // In production, this would deploy actual contracts
        token = address(uint160(uint256(keccak256(abi.encodePacked(name, symbol, block.timestamp)))));
        bondingCurve = address(uint160(uint256(keccak256(abi.encodePacked(token, "curve")))));
        
        // Transfer fee to treasury
        (bool success, ) = platformTreasury.call{value: msg.value}("");
        require(success, "Fee transfer failed");
        
        emit TokenLaunched(token, msg.sender, bondingCurve, name, symbol);
    }
    
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        platformTreasury = newTreasury;
    }
}