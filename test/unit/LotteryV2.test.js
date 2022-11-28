const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("LotteryV2 Unit Tests", () => {
      let lottery, entryPrice, deployer, interval, accounts, round
      const chainId = network.config.chainId

      beforeEach(async () => {
        accounts = await ethers.getSigners()
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])

        lottery = await ethers.getContract("LotteryV2", deployer)
        entryPrice = await lottery.entryPrice()
        interval = await lottery.interval()
        round = Number((await lottery.getRound()).toString())
      })

      describe("constructor", () => {
        it("initializes the lottery correctly", async () => {
          assert.equal(round.toString(), 1)
        })
      })

      describe("enterLottery", () => {
        it("revert when has less ether than entries", async () => {
          await expect(lottery.enterLottery(1)).to.be.revertedWith(
            "Levi_Lottery_Insufficient_Ether"
          )
        })

        it("revert when has more entries than ether", async () => {
          await expect(lottery.enterLottery(3, { value: entryPrice })).to.be.revertedWith(
            "Levi_Lottery_Insufficient_Ether"
          )
        })

        it("revert with 0 entries", async () => {
          await expect(lottery.enterLottery(0)).to.be.revertedWith(
            "Levi_Lottery_Invalid_Amount_Entries"
          )
        })

        it("revert with more than 5 entries", async () => {
          await expect(lottery.enterLottery(6, { value: entryPrice.mul(6) })).to.be.revertedWith(
            "Levi_Lottery_Invalid_Amount_Entries"
          )
        })

        it("[uniqueAccountsInRound] - dont store same account as unique", async () => {
          await lottery.enterLottery(2, { value: entryPrice.mul(2) })
          await lottery.enterLottery(2, { value: entryPrice.mul(2) })

          const uniqueAccountsInRound = await lottery.uniqueAccountsInRound(round)
          assert.equal(uniqueAccountsInRound.toString(), "1")
        })

        it("emit event when a round is activated", async () => {
          for (let index = 1; index <= 5; index++) {
            lottery = lottery.connect(accounts[index])
            index < 5
              ? await lottery.enterLottery(1, { value: entryPrice })
              : await expect(lottery.enterLottery(1, { value: entryPrice })).to.emit(
                  lottery,
                  "RoundActivated"
                )
          }
        })

        it("[playersInRound] - store same user address based on his entries", async () => {
          const count = 5
          await lottery.enterLottery(count, { value: entryPrice.mul(count) })
          for (let index = 0; index < count; index++) {
            const address = await lottery.playersInRound(round, index)
            assert.equal(address, accounts[0].address)
          }
        })

        it("[playersInRound] - store users address based on his entries ", async () => {
          lottery = lottery.connect(accounts[1])
          await lottery.enterLottery(2, { value: entryPrice.mul(2) })
          lottery = lottery.connect(accounts[2])
          await lottery.enterLottery(4, { value: entryPrice.mul(4) })
          lottery = lottery.connect(accounts[3])
          await lottery.enterLottery(3, { value: entryPrice.mul(3) })

          const accAddress1 = await lottery.playersInRound(round, 1)
          const accAddress2 = await lottery.playersInRound(round, 5)
          const accAddress3 = await lottery.playersInRound(round, 7)

          assert.equal(accAddress1, accounts[1].address)
          assert.equal(accAddress2, accounts[2].address)
          assert.equal(accAddress3, accounts[3].address)
        })

        it("emit event when enters as expected", async () => {
          await expect(lottery.enterLottery(1, { value: entryPrice })).to.emit(
            lottery,
            "EntriesBought"
          )
        })
      })

      describe("isRoundValid", () => {
        it("return false when is current round", async () => {
          const valid = await lottery.isRoundValid(round)
          assert.equal(valid, false)
        })

        it("return false when has not enough unique accounts", async () => {
          for (let index = 1; index < 5; index++) {
            lottery = lottery.connect(accounts[index])
            await lottery.enterLottery(1, { value: entryPrice })
          }

          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])

          const valid = await lottery.isRoundValid(round)
          assert.equal(valid, false)
        })

        it("returns true when a round is valid", async () => {
          for (let index = 1; index < 6; index++) {
            lottery = lottery.connect(accounts[index])
            await lottery.enterLottery(1, { value: entryPrice })
          }

          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const valid = await lottery.isRoundValid(round)
          assert.equal(valid, true)
        })
      })

      describe("getRefund", () => {
        it("revert when is an invalid round", async () => {
          await expect(lottery.getRefund(2)).to.be.revertedWith(
            "Levi_Lottery_Cannot_Process_Refund"
          )
        })

        it("revert when round is valid", async () => {
          for (let index = 0; index < 6; index++) {
            lottery = lottery.connect(accounts[index])
            await lottery.enterLottery(1, { value: entryPrice })
          }

          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])

          await expect(lottery.getRefund(round)).to.be.revertedWith(
            "Levi_Lottery_Cannot_Process_Refund"
          )
        })

        it("revert when already refunded", async () => {
          await lottery.enterLottery(1, { value: entryPrice })
          await lottery.getRefund(round)

          await expect(lottery.getRefund(round)).to.be.revertedWith(
            "Levi_Lottery_Cannot_Process_Refund"
          )
        })

        it("refund user when round is invalid", async () => {
          const entries = 3
          acc = accounts[1]
          lottery = lottery.connect(acc)
          await lottery.enterLottery(entries, { value: entryPrice.mul(entries) })
          const startBalance = await acc.getBalance()
          const tx = await lottery.getRefund(round)
          const txReceipt = await tx.wait(1)
          const txGasused = txReceipt.cumulativeGasUsed.mul(txReceipt.effectiveGasPrice)
          const endBalance = await acc.getBalance()

          assert.equal(
            startBalance.sub(txGasused).add(entryPrice.mul(entries)).toString(),
            endBalance.toString()
          )
        })
      })

      describe("selectWinner", () => {
        beforeEach(async () => {
          for (let index = 0; index < 6; index++) {
            lottery = lottery.connect(accounts[index])
            await lottery.enterLottery(1, { value: entryPrice })
          }
        })

        it("revert when is current round", async () => {
          await expect(lottery.selectWinner(round)).to.be.revertedWith(
            "Levi_Lottery_Cant_Select_Winner"
          )
        })

        it("revert when is not a valid round", async () => {
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const newRound = Number((await lottery.getRound()).toString())
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])

          await expect(lottery.selectWinner(newRound)).to.be.revertedWith(
            "Levi_Lottery_Cant_Select_Winner"
          )
        })

        it("revert when round is closed", async () => {
          for (let index = 0; index < 23; index++) {
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
          }

          await lottery.selectWinner(round)
          await expect(lottery.selectWinner(round)).to.be.revertedWith(
            "Levi_Lottery_Cant_Select_Winner"
          )
        })

        it("emit event when select a winner", async () => {
          for (let index = 0; index < 23; index++) {
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
          }

          await expect(lottery.selectWinner(round)).to.emit(lottery, "WinnerSelected")
        })

        it("prize, fee and service should be splited correctly", async () => {
          for (let index = 0; index < 23; index++) {
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
          }

          const ethersCollected = await lottery.etherCollectedInRound(round)
          const expectedPrize = ethersCollected.mul(85).div(100)
          const expectedFee = ethersCollected.mul(14).div(100)
          const expectedService = ethersCollected.mul(1).div(100)

          lottery = lottery.connect(accounts[9])
          const tx = await lottery.selectWinner(round)
          const txReceipt = await tx.wait(1)
          const { serviceProvider, prize, fee, service } = txReceipt.events[0].args

          assert.equal(serviceProvider, accounts[9].address)
          assert.equal(prize.toString(), expectedPrize.toString())
          assert.equal(fee.toString(), expectedFee.toString())
          assert.equal(service.toString(), expectedService.toString())
        })
      })

      describe("withdraw", () => {
        let args, expectedPrize, expectedFee, expectedService

        beforeEach(async () => {
          for (let index = 0; index < 6; index++) {
            lottery = lottery.connect(accounts[index])
            await lottery.enterLottery(5, { value: entryPrice.mul(5) })
          }

          for (let index = 0; index < 23; index++) {
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.send("evm_mine", [])
          }

          const ethersCollected = await lottery.etherCollectedInRound(round)
          expectedPrize = ethersCollected.mul(85).div(100)
          expectedFee = ethersCollected.mul(14).div(100)
          expectedService = ethersCollected.mul(1).div(100)

          lottery = lottery.connect(accounts[9])
          const tx = await lottery.selectWinner(round)
          const txReceipt = await tx.wait(1)
          args = txReceipt.events[0].args
        })

        it("let accounts with balance to withdraw", async () => {
          const { winner, serviceProvider, prize, fee, service } = args

          const accWinner = accounts.find((acc) => acc.address === winner)
          const accService = accounts.find((acc) => acc.address === serviceProvider)

          const startWinnerBalance = await accWinner.getBalance()
          const startServiceBalance = await accService.getBalance()

          lottery = lottery.connect(accWinner)
          const tx = await lottery.withdraw()
          const txReceipt = await tx.wait(1)
          const txGasused = txReceipt.cumulativeGasUsed.mul(txReceipt.effectiveGasPrice)

          lottery = lottery.connect(accService)
          const tx2 = await lottery.withdraw()
          const tx2Receipt = await tx2.wait(1)
          const tx2Gasused = tx2Receipt.cumulativeGasUsed.mul(tx2Receipt.effectiveGasPrice)

          const endWinnerBalance = await accWinner.getBalance()
          const endServiceBalance = await accService.getBalance()

          assert.equal(
            startWinnerBalance.sub(txGasused).add(prize).toString(),
            endWinnerBalance.toString()
          )
          assert.equal(
            startServiceBalance.sub(tx2Gasused).add(service).toString(),
            endServiceBalance.toString()
          )
        })
      })
    })