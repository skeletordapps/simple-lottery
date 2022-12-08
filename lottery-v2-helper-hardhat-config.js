require("dotenv").config()
const { ethers } = require("hardhat")

const GOERLI_MULTISIG = process.env.GOERLI_MULTISIG
const ARBITRUM_MULTISIG = process.env.ARBITRUM_MULTISIG
const networkConfig = {
  5: {
    name: "goerli",
    multisig: GOERLI_MULTISIG,
  },
  31337: {
    name: "hardhat",
  },
  42161: {
    name: "arbitrum",
    multisig: ARBITRUM_MULTISIG,
  },
}

const developmentChains = ["hardhat", "localhost"]

module.exports = {
  networkConfig,
  developmentChains,
}
