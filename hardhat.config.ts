import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@matterlabs/hardhat-zksync";
import "dotenv/config";

const config: HardhatUserConfig = {
  zksolc: {
    version: "latest",
    settings: {
      // Additional zksolc settings can be added here
    },
  },
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
  defaultNetwork: "abstractTestnet",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      zksync: false,
    },
    abstractTestnet: {
      url: process.env.ABSTRACT_RPC_URL || "https://api.testnet.abs.xyz",
      ethNetwork: "sepolia",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11124,
      zksync: true,
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