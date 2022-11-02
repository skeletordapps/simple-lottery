const { ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("30")

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId
  // let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock

  // if (developmentChains.includes(network.name)) {
  //   vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
  //   vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
  //   const tx = await vrfCoordinatorV2Mock.createSubscription()
  //   const txReceipt = await tx.wait(1)
  //   subscriptionId = txReceipt.events[0].args.subId
  //   await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
  // } else {
  //   vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2
  //   subscriptionId = networkConfig[chainId].subscriptionId
  // }

  const entranceFee = networkConfig[chainId]["entranceFee"]
  const interval = networkConfig[chainId]["interval"]
  const args = [entranceFee, interval]

  const lottery = await deploy("Lottery", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: developmentChains.includes(network.name) ? 1 : 6,
  })

  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    log("Verifying...")
    await verify(lottery.address, args)
  }

  log("-------------------------------")
}

module.exports.tags = ["all", "lottery"]
