import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    "abstract-testnet": {
      url: process.env.ABSTRACT_RPC_URL || "https://api.testnet.abs.xyz",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11124,
      allowUnlimitedContractSize: true,
    },
  },
  etherscan: {
    apiKey: {
      "abstract-testnet": "placeholder", // Abstract explorer doesn't require API key
    },
    customChains: [
      {
        network: "abstract-testnet",
        chainId: 11124,
        urls: {
          apiURL: "https://explorer.testnet.abs.xyz/api",
          browserURL: "https://explorer.testnet.abs.xyz",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};

export default config;