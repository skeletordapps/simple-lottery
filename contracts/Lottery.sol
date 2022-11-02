// Lottery
// Enter the lottery (paying some amount)
// Pick a random winner (verifiably random)
// Winner to be selected every X minutes (whatever measure in time) - > completly automated
// Chainlink Oracle -> Randomness, Automated Execution (Chainlink Keepers)

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

error Lottery__NotEnoughEthEntered();
error Lottery__TransferFailed();
error Lottery__NotOpen();
error Lottery__PickWinnerNotNeeded(
  uint256 currentBalance,
  uint256 numPlayers,
  uint256 lotteryState
);
error Lottery__UnknowRequest();
error Lottery__NotClosed();
error Lottery__NotEnoughBalance();

/** @title A sample lottery contract
 * @author 0xL
 * @notice This contract is for creating an untamperable decentralized smart contract
 * @dev This implements Chainlink VRF v2 and Chainlink Keepers
 */

contract Lottery is Ownable {
  // Type Declarations
  enum LotteryState {
    IDLE,
    OPEN,
    CLOSED
  } // (uint256) OPEN = 0, CALCULATING = 1

  // State Variables
  uint256 private immutable i_entranceFee;
  address payable[] private s_players;

  // Lottery Variables
  uint256 private s_winnersCount = 0;
  address private s_recentWinner;
  LotteryState private s_lotteryState;
  uint256 private s_lastTimeStamp;
  uint256 private immutable i_interval;
  struct Winner {
    address winner;
    uint256 amount;
  }
  mapping(uint256 => Winner) public s_mapToWinner;

  // Events
  event LotteryOpen();
  event LotteryEnter(address indexed player);
  event WinnerPicked(address indexed winner);
  event LotteryClose(LotteryState state);
  event WithdrawFunds(address indexed owner, uint256 amount);

  constructor(uint256 entranceFee, uint256 interval) {
    i_entranceFee = entranceFee;
    s_lastTimeStamp = block.timestamp;
    i_interval = interval;
  }

  // Lottery functions
  function openLottery() external onlyOwner {
    s_lotteryState = LotteryState.OPEN;
    emit LotteryOpen();
  }

  function enterLottery() public payable {
    if (msg.value < i_entranceFee) {
      revert Lottery__NotEnoughEthEntered();
    }

    if (s_lotteryState != LotteryState.OPEN) {
      revert Lottery__NotOpen();
    }

    s_players.push(payable(msg.sender));
    emit LotteryEnter(msg.sender);
  }

  function closeLottery() public onlyOwner {
    s_lotteryState = LotteryState.CLOSED;
    emit LotteryClose(LotteryState.CLOSED);
  }

  function withdraw() public onlyOwner {
    if (s_lotteryState != LotteryState.CLOSED) {
      revert Lottery__NotClosed();
    }

    if (address(this).balance == 0) {
      revert Lottery__NotEnoughBalance();
    }

    uint256 balance = address(this).balance;
    (bool success, ) = owner().call{value: balance}("");
    if (!success) {
      revert Lottery__TransferFailed();
    }

    emit WithdrawFunds(owner(), balance);
  }

  /**
   * @dev Check if contract is under conditions to pick a new Winner
   * The following should be true in order to return true:
   * 1. Our time interval should have passed
   * 2. The lottery should have at least 1 player and have some ETH
   * 3. the lottery should be in an "open" state
   */
  function canRequestAWinner() public view onlyOwner returns (bool canPick) {
    bool isOpen = (LotteryState.OPEN == s_lotteryState);
    bool timePassed = block.timestamp > (s_lastTimeStamp + i_interval);
    bool hasPlayers = s_players.length > 0;
    bool hasBalance = address(this).balance > 0;
    canPick = (isOpen && timePassed && hasPlayers && hasBalance);
    return canPick;
  }

  function random() private view returns (uint256) {
    return uint256(keccak256(abi.encodePacked(block.difficulty, block.timestamp, s_players)));
  }

  function requestWinner() external onlyOwner {
    bool canRequest = canRequestAWinner();
    if (!canRequest) {
      revert Lottery__PickWinnerNotNeeded(
        address(this).balance,
        s_players.length,
        uint256(s_lotteryState)
      );
    }
    fulfillWinner();
  }

  function fulfillWinner() internal onlyOwner {
    uint256 indexOfWinner = random() % s_players.length;
    address payable recentWinner = s_players[indexOfWinner];

    s_mapToWinner[s_winnersCount] = Winner(recentWinner, address(this).balance);
    s_winnersCount++;
    s_recentWinner = recentWinner;
    s_lotteryState = LotteryState.OPEN;
    s_players = new address payable[](0);
    s_lastTimeStamp = block.timestamp;

    (bool success, ) = recentWinner.call{value: address(this).balance}("");
    if (!success) {
      revert Lottery__TransferFailed();
    }

    emit WinnerPicked(recentWinner);
  }

  // View / Pure functions
  function getEntranceFee() public view returns (uint256) {
    return i_entranceFee;
  }

  function getPlayer(uint256 index) public view returns (address) {
    return s_players[index];
  }

  function getRecentWinner() public view returns (address) {
    return s_recentWinner;
  }

  function getLotteryState() public view returns (LotteryState) {
    return s_lotteryState;
  }

  function getNumberOfPlayers() public view returns (uint256) {
    return s_players.length;
  }

  function getLatestTimeStamp() public view returns (uint256) {
    return s_lastTimeStamp;
  }

  function getInterval() public view returns (uint256) {
    return i_interval;
  }

  function getBalance() public view returns (uint256) {
    return address(this).balance;
  }

  function getWinnersCount() public view returns (uint256) {
    return s_winnersCount;
  }

  function getWinner(uint256 index) public view returns (Winner memory) {
    return s_mapToWinner[index];
  }
}
