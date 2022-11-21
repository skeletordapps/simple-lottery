const { ethers } = require("hardhat")
const networkConfig = {
  5: {
    name: "goerli",
    entranceFee: ethers.utils.parseEther("0.00005"),
    interval: "300",
    entryLimit: "20",
  },
  31337: {
    name: "hardhat",
    entranceFee: ethers.utils.parseEther("0.00005"),
    interval: "300",
    entryLimit: "10",
  },
  42161: {
    name: "arbitrum",
    entranceFee: ethers.utils.parseEther("0.001"),
    interval: "172800", // 48 hours in seconds
    entryLimit: "20",
  },
}

const developmentChains = ["hardhat", "localhost"]

module.exports = {
  networkConfig,
  developmentChains,
}
