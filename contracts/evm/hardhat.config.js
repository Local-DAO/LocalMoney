require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("solidity-coverage");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      gas: 12000000,
      blockGasLimit: 12000000,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    mainnet: {
      url: process.env.MAINNET_RPC || "https://mainnet.infura.io/v3/your-key",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: 30000000000, // 30 gwei
      timeout: 300000, // 5 minutes
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: 1000000000, // 1 gwei
      timeout: 300000,
    },
    optimism: {
      url: process.env.OPTIMISM_RPC || "https://mainnet.optimism.io",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: 2000000000, // 2 gwei
      timeout: 300000,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC || "https://sepolia.infura.io/v3/your-key",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: 20000000000, // 20 gwei
    },
    bsc: {
      url: process.env.BSC_RPC || "https://bsc-dataseed1.binance.org/",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 56,
      gasPrice: 3000000000, // 3 gwei
      timeout: 300000,
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 97,
      gasPrice: 10000000000, // 10 gwei
      timeout: 300000,
    },
    polygon: {
      url: process.env.POLYGON_RPC || "https://polygon-rpc.com",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 137,
      gasPrice: 50000000000, // 50 gwei
      timeout: 300000,
    },
    polygonTestnet: {
      url: process.env.POLYGON_TESTNET_RPC || "https://rpc-mumbai.maticvigil.com",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 80001,
      gasPrice: 30000000000, // 30 gwei
      timeout: 300000,
    },
    avalanche: {
      url: process.env.AVALANCHE_RPC || "https://api.avax.network/ext/bc/C/rpc",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 43114,
      gasPrice: 25000000000, // 25 gwei
      timeout: 300000,
    },
    avalancheFuji: {
      url: process.env.AVALANCHE_FUJI_RPC || "https://api.avax-test.network/ext/bc/C/rpc",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 43113,
      gasPrice: 25000000000, // 25 gwei
      timeout: 300000,
    },
    base: {
      url: process.env.BASE_RPC || "https://mainnet.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 8453,
      gasPrice: 1000000000, // 1 gwei
      timeout: 300000,
    },
    baseGoerli: {
      url: process.env.BASE_GOERLI_RPC || "https://goerli.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 84531,
      gasPrice: 1000000000, // 1 gwei
      timeout: 300000,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 30,
    showTimeSpent: true,
    showMethodSig: true,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      arbitrumOne: process.env.ARBISCAN_API_KEY,
      optimisticEthereum: process.env.OPTIMISM_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY,
      bsc: process.env.BSCSCAN_API_KEY,
      bscTestnet: process.env.BSCSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY,
      avalanche: process.env.SNOWTRACE_API_KEY,
      avalancheFuji: process.env.SNOWTRACE_API_KEY,
      base: process.env.BASESCAN_API_KEY,
      baseGoerli: process.env.BASESCAN_API_KEY,
    },
    customChains: [
      {
        network: "arbitrumOne",
        chainId: 42161,
        urls: {
          apiURL: "https://api.arbiscan.io/api",
          browserURL: "https://arbiscan.io"
        }
      },
      {
        network: "optimisticEthereum",
        chainId: 10,
        urls: {
          apiURL: "https://api-optimistic.etherscan.io/api",
          browserURL: "https://optimistic.etherscan.io"
        }
      },
      {
        network: "bsc",
        chainId: 56,
        urls: {
          apiURL: "https://api.bscscan.com/api",
          browserURL: "https://bscscan.com"
        }
      },
      {
        network: "bscTestnet",
        chainId: 97,
        urls: {
          apiURL: "https://api-testnet.bscscan.com/api",
          browserURL: "https://testnet.bscscan.com"
        }
      },
      {
        network: "polygon",
        chainId: 137,
        urls: {
          apiURL: "https://api.polygonscan.com/api",
          browserURL: "https://polygonscan.com"
        }
      },
      {
        network: "polygonMumbai",
        chainId: 80001,
        urls: {
          apiURL: "https://api-testnet.polygonscan.com/api",
          browserURL: "https://mumbai.polygonscan.com"
        }
      },
      {
        network: "avalanche",
        chainId: 43114,
        urls: {
          apiURL: "https://api.snowtrace.io/api",
          browserURL: "https://snowtrace.io"
        }
      },
      {
        network: "avalancheFuji",
        chainId: 43113,
        urls: {
          apiURL: "https://api-testnet.snowtrace.io/api",
          browserURL: "https://testnet.snowtrace.io"
        }
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      },
      {
        network: "baseGoerli",
        chainId: 84531,
        urls: {
          apiURL: "https://api-goerli.basescan.org/api",
          browserURL: "https://goerli.basescan.org"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
