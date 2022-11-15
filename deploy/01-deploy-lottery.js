const { ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId
  const entranceFee = networkConfig[chainId]["entranceFee"]
  const interval = networkConfig[chainId]["interval"]
  const args = [entranceFee, interval]

  const lottery = await deploy("Lottery", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: developmentChains.includes(network.name) ? 1 : 6,
  })

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY &&
    process.env.ARBISCAN_API_KEY
  ) {
    log("Verifying...")
    await verify(lottery.address, args)
  }

  log("-------------------------------")
}

module.exports.tags = ["all", "lottery"]
