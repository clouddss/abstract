// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LaunchFactoryLib
 * @notice Library containing utility functions for LaunchFactory
 */
library LaunchFactoryLib {
    /**
     * @notice Basic URL validation
     * @param url URL to validate
     * @return valid True if URL appears valid
     */
    function isValidUrl(string memory url) internal pure returns (bool valid) {
        bytes memory urlBytes = bytes(url);
        if (urlBytes.length < 8) return false;
        
        // Check if starts with http:// or https://
        return (
            urlBytes[0] == 'h' &&
            urlBytes[1] == 't' &&
            urlBytes[2] == 't' &&
            urlBytes[3] == 'p' &&
            (urlBytes[4] == ':' || (urlBytes[4] == 's' && urlBytes[5] == ':'))
        );
    }

    /**
     * @notice Basic Twitter handle validation
     * @param twitter Twitter handle to validate
     * @return valid True if handle appears valid
     */
    function isValidTwitter(string memory twitter) internal pure returns (bool valid) {
        bytes memory twitterBytes = bytes(twitter);
        if (twitterBytes.length == 0 || twitterBytes.length > 15) return false;
        
        // Check if starts with @ or is just the handle
        if (twitterBytes[0] == '@') return twitterBytes.length > 1;
        return true;
    }

    /**
     * @notice Basic Telegram handle validation
     * @param telegram Telegram handle to validate
     * @return valid True if handle appears valid
     */
    function isValidTelegram(string memory telegram) internal pure returns (bool valid) {
        bytes memory telegramBytes = bytes(telegram);
        if (telegramBytes.length == 0 || telegramBytes.length > 32) return false;
        
        // Check if starts with @ or is just the handle
        if (telegramBytes[0] == '@') return telegramBytes.length > 1;
        return true;
    }
}