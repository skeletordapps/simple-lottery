require("dotenv").config()
const { ethers, network } = require("hardhat/internal/lib/hardhat-lib")
const fs = require("fs")

const FRONT_END_ADDRESSES_FILE = "../lottery-fcc/constants/contractAddresses.json"
const FRONT_END_ABI_FILE = "../lottery-fcc/constants/abi.json"

module.exports = async () => {
  if (process.env.UPDATE_FRONT_END === "true") {
    // console.log("Updating frontend ...")
    // await updateContractAddresses()
    // await udpateAbi()
    // console.log("Frontend updated!")
  }
}

async function udpateAbi() {
  const lottery = await ethers.getContract("Lottery")
  fs.writeFileSync(FRONT_END_ABI_FILE, lottery.interface.format(ethers.utils.FormatTypes.json))
}

async function updateContractAddresses() {
  const lottery = await ethers.getContract("Lottery")
  const chainId = network.config.chainId.toString()
  const file = fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8")
  const contractAddresses = file ? JSON.parse(file) : {}

  if (chainId in contractAddresses) {
    if (!contractAddresses[chainId].includes(lottery.address)) {
      contractAddresses[chainId].push(lottery.address)
    }
  } else {
    contractAddresses[chainId] = [lottery.address]
  }
  fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(contractAddresses))
}

module.exports.tags = ["all", "frontend"]
