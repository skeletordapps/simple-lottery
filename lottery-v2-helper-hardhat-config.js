require("dotenv").config()
const { ethers } = require("hardhat")

// const MULTISIG = process.env.PRIVATE_KEY
const networkConfig = {
  5: {
    name: "goerli",
  },
  31337: {
    name: "hardhat",
  },
  42161: {
    name: "arbitrum",
    multisig: "", // will change
  },
}

const developmentChains = ["hardhat", "localhost"]

module.exports = {
  networkConfig,
  developmentChains,
}
