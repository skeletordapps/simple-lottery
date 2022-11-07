const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery Unit Tests", () => {
      let lottery, entranceFee, deployer, interval, accounts
      const chainId = network.config.chainId

      beforeEach(async () => {
        accounts = await ethers.getSigners()
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])

        lottery = await ethers.getContract("Lottery", deployer)
        entranceFee = await lottery.getEntranceFee()
        interval = await lottery.getInterval()
      })

      describe("constructor", () => {
        it("initializes the lottery correctly", async () => {
          const lotteryState = await lottery.getLotteryState()
          assert.equal(lotteryState.toString(), "0")
          assert.equal(interval.toString(), networkConfig[chainId].interval)
        })
      })

      describe("open lottery", () => {
        it("doesnt allow open lottery if is not owner", async () => {
          lottery = lottery.connect(accounts[1])
          await expect(lottery.openLottery()).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("successfully opens lottery", async () => {
          await lottery.openLottery()
          const status = await lottery.getLotteryState()
          assert.equal(status, 1)
        })

        it("should emit event wen opens lottery", async () => {
          await expect(lottery.openLottery()).to.emit(lottery, "LotteryOpen")
        })
      })

      describe("enterLottery", () => {
        describe("when lottery is not OPEN", () => {
          it("doesnt allow entrance when lottery is IDDLE", async () => {
            await expect(lottery.enterLottery({ value: entranceFee })).to.be.revertedWith(
              "Lottery__NotOpen"
            )
          })
        })

        describe("when lottery is OPEN", () => {
          beforeEach(async () => {
            lottery = lottery.connect(accounts[0])
            await lottery.openLottery()
          })

          it("revert when you don't pay enough", async () => {
            await expect(lottery.enterLottery()).to.be.revertedWith("Lottery__NotEnoughEthEntered")
          })

          it("records players when they enter", async () => {
            await lottery.enterLottery({ value: entranceFee })
            const playerFromContract = await lottery.getPlayer(0)
            assert.equal(playerFromContract, deployer)
          })

          it("records player entries", async () => {
            const player = accounts[1]
            lottery = lottery.connect(player)
            const round = await lottery.getRound()
            await lottery.enterLottery({ value: entranceFee })
            await lottery.enterLottery({ value: entranceFee })
            const entries = await lottery.getPlayerEntries(Number(round), player.address)
            assert.equal(entries, Number(2))
          })

          it("emits an event on enter", async () => {
            await expect(lottery.enterLottery({ value: entranceFee })).to.emit(
              lottery,
              "LotteryEnter"
            )
          })

          it("return the number of players", async () => {
            for (let index = 1; index < 11; index++) {
              lottery = lottery.connect(accounts[index])
              await lottery.enterLottery({ value: entranceFee })
            }

            const numOfPlayers = await lottery.getNumberOfPlayers()
            assert.equal(numOfPlayers.toString(), "10")
          })
        })
      })

      describe("closeLottery", () => {
        beforeEach(async () => {
          await lottery.openLottery()
        })
        it("revert when is not the owner", async () => {
          lottery = lottery.connect(accounts[1])
          await expect(lottery.closeLottery()).to.be.revertedWith(
            "Ownable: caller is not the owner"
          )
        })

        it("emits event on close", async () => {
          await expect(lottery.closeLottery()).to.emit(lottery, "LotteryClose")
        })
      })

      describe("canRequestAWinner", () => {
        it("returns false if people haven't sent any ETH", async () => {
          lottery = lottery.connect(accounts[0])
          await lottery.openLottery()
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const { canRequest } = await lottery.callStatic.canRequestAWinner()
          assert(!canRequest)
        })

        it("returns false if lottery isn't open", async () => {
          lottery = lottery.connect(accounts[0])
          const value = await lottery.callStatic.canRequestAWinner()
          assert(value === false)
        })

        it("returns false if time hasn't passed", async () => {
          lottery = lottery.connect(accounts[0])
          await lottery.openLottery()
          await lottery.enterLottery({ value: entranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
          await network.provider.send("evm_mine", [])
          const { canRequest } = await lottery.callStatic.canRequestAWinner()
          assert(!canRequest)
        })

        it("returns true if enough time has passed, has players, eth and is open", async () => {
          lottery = lottery.connect(accounts[0])
          await lottery.openLottery()
          for (let index = 1; index <= 11; index++) {
            lottery = lottery.connect(accounts[index])
            await lottery.enterLottery({ value: entranceFee })
          }
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.request({ method: "evm_mine", params: [] }) // same of line 80, but using request
          lottery = lottery.connect(accounts[0])
          const canRequest = await lottery.callStatic.canRequestAWinner()
          assert(canRequest === true)
        })
      })

      describe("requestWinner", () => {
        beforeEach(async () => {
          lottery = lottery.connect(accounts[0])
          await lottery.openLottery()
        })
        it("it can only run if canRequest is true", async () => {
          for (let index = 1; index <= 11; index++) {
            lottery = lottery.connect(accounts[index])
            await lottery.enterLottery({ value: entranceFee })
          }
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          lottery = lottery.connect(accounts[0])
          const tx = await lottery.requestWinner()
          assert(tx)
        })
        it("reverts when canRequest is false", async () => {
          lottery = lottery.connect(accounts[0])
          await expect(lottery.requestWinner()).to.be.revertedWith("Lottery__PickWinnerNotNeeded")
        })
        it("picks a winner, resets, and sends money", async () => {
          const round = Number(await lottery.getRound())

          for (let index = 1; index <= 11; index++) {
            lottery = lottery.connect(accounts[index])
            await lottery.enterLottery({ value: entranceFee })
          }
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          lottery = lottery.connect(accounts[0])

          const startingTimeStamp = await lottery.getLatestTimeStamp() // stores starting timestamp (before we fire our event)
          let startingBalances = {}

          const players = accounts.slice(1, 15)
          for (let index = 0; index < players.length; index++) {
            const balance = await players[index].getBalance()
            startingBalances[players[index].address] = balance
          }

          await new Promise(async (resolve, reject) => {
            // coded first but executed after event is fired.
            // event listener for WinnerPicked
            lottery.once("WinnerPicked", async () => {
              console.log("WinnersPicked event fired!")
              try {
                // Now lets get the ending values...
                const winners = await lottery.getWinners()
                const recentWinner = winners[winners.length - 1]
                const recentWinnerPrize = await lottery.getWinnerPrize(recentWinner)
                const winnerAccount = players.find((player) => player.address === recentWinner)
                const winnerStartingBalance = startingBalances[winnerAccount.address]
                const winnerBalance = await winnerAccount.getBalance()
                const lotteryBalance = await lottery.getBalance()
                const lotteryState = await lottery.getLotteryState()
                const endingTimeStamp = await lottery.getLatestTimeStamp()
                const currentRound = Number(await lottery.getRound())
                await expect(lottery.getPlayer(0)).to.be.reverted

                // Comparisons to check if our ending values are correct:
                assert.equal(winners.length, 1)
                assert.equal(lotteryState, 1)
                assert.equal(
                  winnerBalance.toString(),
                  winnerStartingBalance.add(recentWinnerPrize).toString()
                )
                assert.equal(round + 1, currentRound)
                assert(lotteryBalance.toString() === "0")
                assert(endingTimeStamp > startingTimeStamp)
                resolve() // if try passes, resolves the promise
              } catch (e) {
                reject(e) // if try fails, rejects the promise
              }
            })

            await lottery.requestWinner()
          })
        })
      })

      describe("withdraw", () => {
        beforeEach(async () => {
          lottery = lottery.connect(accounts[0])
          await lottery.openLottery()
        })

        it("revert withdraw when is not the owner", async () => {
          lottery = lottery.connect(accounts[1])
          await expect(lottery.withdraw()).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("revert withdraw when lottery is not closed", async () => {
          await expect(lottery.withdraw()).to.be.revertedWith("Lottery__NotClosed")
        })

        it("revert withdraw when balance is 0", async () => {
          await lottery.closeLottery()
          await expect(lottery.withdraw()).to.be.revertedWith("Lottery__NotEnoughBalance")
        })

        it("send balance to owner", async () => {
          const ownerInitialBalance = await accounts[0].getBalance()

          lotteryUser = lottery.connect(accounts[1])
          const entrances = 5

          for (let i = 0; i < entrances; i++) {
            await lotteryUser.enterLottery({ value: entranceFee })
          }

          await lottery.getBalance()

          const txClose = await lottery.closeLottery()
          const txCloseReceipt = await txClose.wait(1)
          const closeTxGasUsed = txCloseReceipt.cumulativeGasUsed.mul(
            txCloseReceipt.effectiveGasPrice
          )

          const txWithdraw = await lottery.withdraw()
          const txWithdrawReceipt = await txWithdraw.wait(1)
          const withdrawTxGasUsed = txWithdrawReceipt.cumulativeGasUsed.mul(
            txWithdrawReceipt.effectiveGasPrice
          )
          const endLotteryBalance = await lottery.getBalance()
          const ownerEndBalance = await accounts[0].getBalance()

          assert.equal(endLotteryBalance.toString(), "0")
          expect(Number(ethers.utils.formatEther(ownerEndBalance.toString()))).to.be.greaterThan(
            Number(ethers.utils.formatEther(ownerInitialBalance.toString()))
          )

          expect(
            Number(ethers.utils.formatEther(ownerEndBalance.toString()))
          ).to.be.greaterThanOrEqual(
            Number(
              ethers.utils.formatEther(
                ownerInitialBalance
                  .add(entranceFee.mul(entrances))
                  .sub(closeTxGasUsed)
                  .sub(withdrawTxGasUsed)
                  .toString()
              )
            )
          )
        })
      })
    })
