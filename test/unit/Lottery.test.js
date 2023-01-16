const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe.skip("Lottery Unit Tests", () => {
      let lottery, entranceFee, deployer, interval, accounts
      const chainId = network.config.chainId

      beforeEach(async () => {
        accounts = await ethers.getSigners()
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])

        lottery = await ethers.getContract("Lottery", deployer)
        entranceFee = await lottery.entranceFee()
        interval = await lottery.interval()
      })

      describe("constructor", () => {
        it("initializes the lottery correctly", async () => {
          const state = await lottery.state()
          assert.equal(state.toString(), "0")
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
          const status = await lottery.state()
          assert.equal(status, 1)
        })

        it("should emit event wen opens lottery", async () => {
          await expect(lottery.openLottery()).to.emit(lottery, "LotteryOpen")
        })
      })

      describe("enterLottery", () => {
        describe("when lottery is not OPEN", () => {
          it("doesnt allow entrance when lottery isn't OPEN", async () => {
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
            await expect(lottery.enterLottery()).to.be.revertedWith("Lottery__LowEntry")
          })

          it("revert when exceeds entry limit", async () => {
            await expect(lottery.enterLottery({ value: entranceFee.mul(11) })).to.be.revertedWith(
              "Lottery__ExceedsEntryLimit"
            )
          })

          it("records players when they enter", async () => {
            await lottery.enterLottery({ value: entranceFee })
            const playerFromContract = await lottery.getPlayer(0)
            assert.equal(playerFromContract, deployer)
          })

          it("records player entries", async () => {
            const player = accounts[1]
            lottery = lottery.connect(player)
            const round = await lottery.round()
            await lottery.enterLottery({ value: entranceFee })
            await lottery.enterLottery({ value: entranceFee })
            const entries = await lottery.mapToEntries(Number(round), player.address)
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

        it("state should have update properly", async () => {
          await lottery.closeLottery()
          const state = await lottery.state()
          assert.equal(state, 3)
        })

        it("emits event on close", async () => {
          await expect(lottery.closeLottery()).to.emit(lottery, "LotteryClose")
        })
      })

      describe("updateInterval", () => {
        it("revert when is not owner", async () => {
          lottery = lottery.connect(accounts[1])
          await expect(lottery.updateInterval(500)).to.be.revertedWith(
            "Ownable: caller is not the owner"
          )
        })

        it("updates interval", async () => {
          const interval = 500
          await lottery.updateInterval(interval)
          const currentInterval = await lottery.interval()
          assert.equal(interval, currentInterval)
        })
      })

      describe("updateEntryLimit", () => {
        it("revert when is not owner", async () => {
          lottery = lottery.connect(accounts[1])
          await expect(lottery.updateEntryLimit(30)).to.be.revertedWith(
            "Ownable: caller is not the owner"
          )
        })

        it("updates entry limit", async () => {
          const limit = 10
          await lottery.updateEntryLimit(limit)
          const entryLimit = await lottery.entryLimit()
          assert.equal(limit, entryLimit)
        })
      })

      describe("pickWinner", () => {
        beforeEach(async () => {
          lottery = lottery.connect(accounts[0])
          await lottery.openLottery()
        })

        it("revert when isn't on DRAW phase", async () => {
          await expect(lottery.pickWinner()).to.be.revertedWith("Lottery__NotAtDrawPhase")
        })

        it("revert when pick winner is not needed", async () => {
          await expect(lottery.enterDrawPhase()).to.be.revertedWith("Lottery__PickWinnerNotNeeded")
        })

        it("updates to DRAW state", async () => {
          await lottery.openLottery()
          for (let index = 1; index <= 11; index++) {
            lottery = lottery.connect(accounts[index])
            await lottery.enterLottery({ value: entranceFee })
          }
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.request({ method: "evm_mine", params: [] }) // same of line 80, but using request
          await lottery.enterDrawPhase()
          const state = lottery.state()
          assert(state, 2)
        })

        it("picks a winner, resets, update winner pool", async () => {
          const round = Number(await lottery.round())

          for (let index = 1; index <= 11; index++) {
            lottery = lottery.connect(accounts[index])
            await lottery.enterLottery({ value: entranceFee })
          }
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          lottery = lottery.connect(accounts[0])

          let startingBalances = {}

          const players = accounts.slice(1, 15)
          for (let index = 0; index < players.length; index++) {
            const balance = await players[index].getBalance()
            startingBalances[players[index].address] = balance
          }

          await new Promise(async (resolve, reject) => {
            lottery.once("WinnerPicked", async () => {
              console.log("WinnersPicked event fired!")
              try {
                const lastWinner = await lottery.lastWinner()
                const winnerPrize = await lottery.mapToPrize(lastWinner)
                const accumulatedFees = await lottery.fees()
                const state = await lottery.state()
                const endingTimeStamp = await lottery.lastTimeStamp()
                const currentRound = Number(await lottery.round())
                const winners = await lottery.getWinners()
                await expect(lottery.getPlayer(0)).to.be.reverted

                assert(Number(winnerPrize.toString()) > 0)
                assert(Number(accumulatedFees.toString()) > 0)
                assert(endingTimeStamp > startingTimeStamp)
                assert.equal(state, 1)
                assert.equal(round + 1, currentRound)
                assert(winners[0] == lastWinner)

                resolve()
              } catch (e) {
                reject(e)
              }
            })

            const startingTimeStamp = await lottery.lastTimeStamp()
            await lottery.enterDrawPhase()
            await lottery.pickWinner()
          })
        })
      })

      describe("claim", () => {
        it("winner claims prize", async () => {
          lottery = lottery.connect(accounts[0])
          await lottery.openLottery()
          const entrances = 5

          for (let i = 0; i < entrances; i++) {
            lottery = lottery.connect(accounts[i + 1])
            await lottery.enterLottery({ value: entranceFee })
          }

          lottery = lottery.connect(accounts[10])
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          await lottery.enterDrawPhase()
          await lottery.pickWinner()
          const lastWinner = await lottery.lastWinner()

          const winnerAccount = accounts.find(
            (account) => account.address.toLowerCase() === lastWinner.toLowerCase()
          )

          const startLotteryBalance = await lottery.getBalance()
          const startWinnerbalance = await winnerAccount.getBalance()
          const winnerPrize = await lottery.mapToPrize(lastWinner)

          await lottery.claim(lastWinner)

          const endLotteryBalance = await lottery.getBalance()
          const endWinnerbalance = await winnerAccount.getBalance()

          assert.equal(
            startLotteryBalance.sub(winnerPrize).toString(),
            endLotteryBalance.toString()
          )

          assert.equal(startWinnerbalance.add(winnerPrize).toString(), endWinnerbalance.toString())
          await expect(lottery.claim(lastWinner)).to.be.revertedWith("Lottery__AlreadyClaimed")
        })
      })

      describe("withdrawFees", () => {
        beforeEach(async () => {
          lottery = lottery.connect(accounts[0])
          await lottery.openLottery()
        })

        it("revert when has no fees", async () => {
          lottery = lottery.connect(accounts[1])
          await expect(lottery.withdrawFees()).to.be.revertedWith("Lottery__ZeroFees")
        })

        it("send fees to owner", async () => {
          lottery = lottery.connect(accounts[1])
          const startOwnerbalance = await accounts[0].getBalance()
          const entrances = 5

          for (let i = 0; i < entrances; i++) {
            await lottery.enterLottery({ value: entranceFee })
          }

          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          await lottery.enterDrawPhase()
          await lottery.pickWinner()
          const accFees = await lottery.fees()
          const startLotteryBalance = await lottery.getBalance()
          await lottery.withdrawFees()

          const endLotteryBalance = await lottery.getBalance()
          const endOwnerBalance = await accounts[0].getBalance()

          assert.equal(startLotteryBalance.sub(accFees).toString(), endLotteryBalance.toString())
          assert.equal(startOwnerbalance.add(accFees).toString(), endOwnerBalance.toString())
        })
      })
    })
