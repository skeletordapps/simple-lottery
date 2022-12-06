const { network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async function ({ getNamedAccounts, deployments }) {
  // const { deploy, log } = deployments
  // const { deployer } = await getNamedAccounts()

  // const liquiditylock = await deploy("LiquidityLocker", {
  //   from: deployer,
  //   log: true,
  //   waitConfirmations: developmentChains.includes(network.name) ? 1 : 6,
  // })

  // if (
  //   !developmentChains.includes(network.name) &&
  //   process.env.ETHERSCAN_API_KEY &&
  //   process.env.ARBISCAN_API_KEY
  // ) {
  //   log("Verifying...")
  //   await verify(liquiditylock.address)
  // }

  // log("-------------------------------")
}

module.exports.tags = ["all", "liquiditylock"]
