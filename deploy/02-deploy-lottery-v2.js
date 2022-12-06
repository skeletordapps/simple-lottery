const { network } = require("hardhat")
const { developmentChains, networkConfig } = require("../lottery-v2-helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId
  const multisig = developmentChains.includes(network.name)
    ? deployer
    : networkConfig[chainId]["multisig"].toString()
  const args = [multisig]

  const lotteryV2 = await deploy("LotteryV2", {
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
    await verify(lotteryV2.address, args)
  }

  log("-------------------------------")
}

module.exports.tags = ["all", "lottery"]
