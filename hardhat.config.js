require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL
const ARBITRUM_RPC_URL = process.env.ARBITRUM_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const DEPLOYER_ARBITRUM_PRIVATE_KEY = process.env.DEPLOYER_ARBITRUM_PRIVATE_KEY
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      blockConfirmations: 1,
      mining: {
        auto: true,
        interval: [500, 1000],
      },
    },
    goerli: {
      chainId: 5,
      blockConfirmations: 6,
      url: GOERLI_RPC_URL,
      accounts: [PRIVATE_KEY],
    },
    arbitrum: {
      chainId: 42161,
      blockConfirmations: 6,
      url: ARBITRUM_RPC_URL,
      accounts: [DEPLOYER_ARBITRUM_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      goerli: ETHERSCAN_API_KEY,
      arbitrumOne: ARBISCAN_API_KEY,
    },
  },
  gasReporter: {
    enabled: false,
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
  },

  solidity: "0.8.9",
  namedAccounts: {
    deployer: {
      default: 0,
    },
    player: {
      default: 1,
    },
  },
  mocha: {
    timeout: 500000,
  },
}
