const { ethers } = require("hardhat")
const networkConfig = {
  5: {
    name: "goerli",
    entranceFee: ethers.utils.parseEther("0.00005"),
    interval: "300",
  },
  31337: {
    name: "hardhat",
    entranceFee: ethers.utils.parseEther("0.00005"),
    interval: "300",
  },
  42161: {
    name: "arbitrum",
    entranceFee: ethers.utils.parseEther("0.001"),
    interval: "172800", // 48 hours in seconds
  },
}

const developmentChains = ["hardhat", "localhost"]

module.exports = {
  networkConfig,
  developmentChains,
}
