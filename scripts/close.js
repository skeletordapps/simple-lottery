const { ethers } = require("hardhat")

async function enterLottery() {
  const lottery = await ethers.getContract("Lottery")
  await lottery.closeLottery()
  console.log("Closed!")
}

enterLottery()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
