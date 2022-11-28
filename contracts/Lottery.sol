// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

error Lottery__LowEntry();
error Lottery__ExceedsEntryLimit();
error Lottery__TransferFailed();
error Lottery__NotOpen();
error Lottery__NotClosed();
error Lottery__ZeroFees();
error Lottery__NotAtDrawPhase();
error Lottery__NewRoundNotNeeded();
error Lottery__PickWinnerNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 state);
error Lottery__AlreadyClaimed();

/** @title A lottery contract
 * @author 0xL
 * @notice This contract implements a lottery that allows 1 winner per round
 * @dev This contract implements pseudo RNG
 */

contract Lottery is Ownable {
  // Enums
  enum State {
    IDLE,
    OPEN,
    DRAW,
    CLOSED
  }

  // Variables
  uint32 public round;
  uint64 public immutable entranceFee;
  uint64 public interval;
  uint64 public entryLimit;
  uint256 public lastTimeStamp;
  uint256 public fees;
  address payable[] public players;
  address payable[] public winners;
  address payable public lastWinner;
  State public state;
  mapping(uint256 => mapping(address => uint256)) public mapToEntries; // round[n] => address[j] => entries
  mapping(address => uint256) public mapToPrize; // winnerAddress[n] => uint256 prize

  // Events
  event LotteryOpen();
  event LotteryEnter(address indexed player);
  event LotteryDrawPhase();
  event LotteryClose();
  event WinnerPicked(address indexed winner, uint256 prize);
  event WithdrawFees(address indexed owner, uint256 amount);
  event PrizeClaimed(address indexed winner, uint256 prize);

  // Modifiers

  /**
   * @dev Min 1 entry, Max set by entryLimit
   **/
  modifier onlyWhenCanEnter() {
    if (state != State.OPEN) {
      revert Lottery__NotOpen();
    }
    if (msg.value < entranceFee) {
      revert Lottery__LowEntry();
    }
    if (msg.value / entranceFee > entryLimit) {
      revert Lottery__ExceedsEntryLimit();
    }
    if (mapToEntries[round][msg.sender] / entranceFee == entryLimit) {
      revert Lottery__ExceedsEntryLimit();
    }
    _;
  }

  /**
   * @dev Check if contract is under conditions to set a new round
   * The following should be true in order to enable:
   * 1. The lottery should be in an OPEN state
   * 2. Time interval should have passed
   * 3. The lottery should zero players
   **/
  modifier onlyWhenCanSetNewRound() {
    bool isOpen = (State.OPEN == state);
    bool timePassed = block.timestamp > (lastTimeStamp + interval);
    bool hasNoPlayers = players.length == 0;
    bool canSetNewRound = (isOpen && timePassed && hasNoPlayers);
    if (!canSetNewRound) {
      revert Lottery__NewRoundNotNeeded();
    }
    _;
  }

  /**
   * @dev Check if contract is under conditions to pick a new Winner
   * The following should be true in order to enable:
   * 1. The lottery should be in an OPEN state
   * 2. Time interval should have passed
   * 3. The lottery should have players
   * 4. The lottery should have balance greater than accumulated fees
   **/
  modifier onlyWhenCanEnterDrawPhase() {
    bool isOpen = (State.OPEN == state);
    bool timePassed = block.timestamp > (lastTimeStamp + interval);
    bool hasPlayers = players.length > 0;
    bool hasBalance = address(this).balance > fees;
    bool canEnterDrawPhase = (isOpen && timePassed && hasPlayers && hasBalance);
    if (!canEnterDrawPhase) {
      revert Lottery__PickWinnerNotNeeded(address(this).balance, players.length, uint256(state));
    }
    _;
  }

  /**
   * @dev Needs to be in DRAW state to pick a winner
   **/
  modifier onlyWhenCanPickWinner() {
    if (state != State.DRAW) {
      revert Lottery__NotAtDrawPhase();
    }
    _;
  }

  /**
   * @dev Accumulated prize should be > 0
   **/
  modifier onlyWhenCanClaim(address payable _winner) {
    if (mapToPrize[_winner] == 0) {
      revert Lottery__AlreadyClaimed();
    }
    _;
  }

  /**
   * @dev Accumulated fee should be > 0
   **/
  modifier onlyWhenCanWithdraw() {
    if (fees == 0) {
      revert Lottery__ZeroFees();
    }
    _;
  }

  constructor(
    uint64 _entranceFee,
    uint64 _interval,
    uint64 _entryLimit
  ) {
    entranceFee = _entranceFee;
    interval = _interval;
    entryLimit = _entryLimit;
    lastTimeStamp = block.timestamp;
  }

  // Lottery functions

  /**
   * @notice Release lottery for new enters
   */
  function openLottery() external onlyOwner {
    state = State.OPEN;
    emit LotteryOpen();
  }

  /**
   * @notice Close the lotto
   */
  function closeLottery() external onlyOwner {
    state = State.CLOSED;
    emit LotteryClose();
  }

  /**
   * @notice Update current interval
   */
  function updateInterval(uint64 _interval) external onlyOwner {
    interval = _interval;
  }

  /**
   * @notice Update entrance limit
   */
  function updateEntryLimit(uint64 _entryLimit) external onlyOwner {
    entryLimit = _entryLimit;
  }

  /**
   * @notice User enters the lottery
   * @dev Don't allows less than entrace fee and lottery needs OPEN state
   */
  function enterLottery() external payable onlyWhenCanEnter {
    uint256 entries = msg.value / entranceFee;
    if (mapToEntries[round][msg.sender] == 0) {
      players.push(payable(msg.sender));
    }
    mapToEntries[round][msg.sender] += entries;
    emit LotteryEnter(msg.sender);
  }

  function setNewRound() external onlyWhenCanSetNewRound {
    lastTimeStamp = block.timestamp;
    round++;
  }

  /**
   * * @notice Update lotto to draw phase
   */
  function enterDrawPhase() external onlyWhenCanEnterDrawPhase {
    state = State.DRAW;
    emit LotteryDrawPhase();
  }

  /**
   * @dev Get a random number
   */
  function random() private view returns (uint256) {
    return
      uint256(keccak256(abi.encodePacked(block.difficulty, block.timestamp, (block.number - 10)))); // couldn't test with (- 100), cuz hardhat set up max of 10 accounts.
  }

  /**
   * @notice Pick a random winner and send prize
   * @dev Add/Increase winner pool prize,
   * Increase accumulated fees, set a new round,
   * Reopen Lottery
   */
  function pickWinner() external onlyWhenCanPickWinner {
    uint256 prize = (address(this).balance * 4) / 5;
    uint256 index = random() % players.length;
    lastWinner = players[index];
    winners.push(lastWinner);
    mapToPrize[lastWinner] = prize;
    fees += address(this).balance - prize;
    players = new address payable[](0);
    lastTimeStamp = block.timestamp;
    round++;
    state = State.OPEN;
    emit WinnerPicked(lastWinner, prize);
    emit LotteryOpen();
  }

  /**
   * @notice Send prize to winner
   */
  function claim(address payable _winner) external payable onlyWhenCanClaim(_winner) {
    uint256 prize = mapToPrize[_winner];
    mapToPrize[_winner] = 0;
    (bool success, ) = _winner.call{value: prize}("");

    if (!success) {
      revert Lottery__TransferFailed();
    }

    emit PrizeClaimed(_winner, prize);
  }

  /**
   * @notice 20% fees from entrances goes to Levi Multisign
   */
  function withdrawFees() external onlyWhenCanWithdraw {
    uint256 availableFees = fees;
    fees = 0;
    address cacheOwner = owner();
    uint256 balance = address(this).balance;
    (bool success, ) = cacheOwner.call{value: availableFees}("");
    if (!success) {
      revert Lottery__TransferFailed();
    }
    emit WithdrawFees(cacheOwner, balance);
  }

  // View / Pure functions (Will remove it once we have subgraph)
  function getBalance() public view returns (uint256) {
    return address(this).balance;
  }

  function getPlayer(uint256 player) public view returns (address) {
    return players[player];
  }

  function getNumberOfPlayers() public view returns (uint256) {
    return players.length;
  }

  function getWinners() public view returns (address payable[] memory) {
    return winners;
  }
}
