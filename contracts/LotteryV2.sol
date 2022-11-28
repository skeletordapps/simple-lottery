// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "hardhat/console.sol";

contract LotteryV2 {
  uint256 public immutable entryPrice;
  uint256 public immutable interval;
  uint256 public immutable startDate;

  mapping(address => uint256) public balances;
  mapping(uint256 => address[]) public playersInRound;
  mapping(uint256 => uint256) public etherCollectedInRound;
  mapping(uint256 => uint256) public uniqueAccountsInRound;
  mapping(uint256 => mapping(address => uint256)) public numberOfEntriesInRoundPerAccount;

  mapping(uint256 => mapping(address => bool)) public hasClaimedRefund;
  mapping(uint256 => bool) public roundClosed;

  event RoundActivated(uint256 round);
  event Withdrawed(address indexed account, uint256 amount);
  event Refunded(address account, uint256 round, uint256 etherRefunded, uint256 entriesRefunded);
  event EntriesBought(
    address indexed account,
    uint256 indexed round,
    uint256 entries,
    uint256 payment
  );
  event WinnerSelected(
    address indexed winner,
    address indexed serviceProvider,
    uint256 round,
    uint256 prize,
    uint256 fee,
    uint256 service
  );

  error Levi_Lottery_Insufficient_Ether();
  error Levi_Lottery_Invalid_Amount_Entries();
  error Levi_Lottery_Cannot_Process_Refund();
  error Levi_Lottery_Cant_Select_Winner();

  constructor() {
    entryPrice = 0.001 ether;
    interval = 3 days;
    startDate = block.timestamp;
  }

  /// Function where any user can buy up to 5 entries to the lottery.
  function enterLottery(uint256 amountEntries) external payable {
    if (msg.value != (amountEntries * entryPrice)) revert Levi_Lottery_Insufficient_Ether();
    if (amountEntries > 5 || amountEntries == 0) revert Levi_Lottery_Invalid_Amount_Entries();

    uint256 round = getRound();

    // This means this account has never bought entries for this round.
    // Update the number of unique accounts on this round
    if (numberOfEntriesInRoundPerAccount[round][msg.sender] == 0) {
      uniqueAccountsInRound[round] += 1;

      // Emit an event of activation if the unique players are at least 5.
      if (uniqueAccountsInRound[round] > 4) {
        emit RoundActivated(round);
      }
    }

    /// More entries means more probability to win.
    for (uint256 i = 0; i < amountEntries; i++) {
      playersInRound[round].push(msg.sender);
    }

    etherCollectedInRound[round] += msg.value;
    numberOfEntriesInRoundPerAccount[round][msg.sender] += amountEntries;

    emit EntriesBought(msg.sender, round, amountEntries, msg.value);
  }

  /// Any user can call this function for any round that have not been closed
  /// The user who succesfully call this function gets 1% of the prize pot.
  function selectWinner(uint256 round) external {
    if (round >= getRound()) revert Levi_Lottery_Cant_Select_Winner();
    if (!isRoundValid(round)) revert Levi_Lottery_Cant_Select_Winner();
    if (roundClosed[round]) revert Levi_Lottery_Cant_Select_Winner();

    uint256 etherInThisRound = etherCollectedInRound[round];

    uint256 prize = (etherInThisRound * 85) / 100; // 85%
    uint256 fee = (etherInThisRound * 14) / 100; // 14%
    uint256 service = etherInThisRound - prize - fee; // 1%

    uint256 index = _random() % playersInRound[round].length;
    address winner = playersInRound[round][index];

    playersInRound[round] = new address[](0);

    balances[winner] += prize;
    balances[address(this)] += fee;
    balances[msg.sender] += service;

    roundClosed[round] = true;

    emit WinnerSelected(winner, msg.sender, round, prize, fee, service);
  }

  function withdraw() external {
    uint256 balance = balances[msg.sender];

    balances[msg.sender] = 0;

    (bool success, ) = msg.sender.call{value: balance}("");
    require(success);

    emit Withdrawed(msg.sender, balance);
  }

  /// For invalid rounds it makes sense to the users to be avaiable to get a refund of their ether.
  function getRefund(uint256 round) external {
    if (isRoundValid(round) || round > getRound()) revert Levi_Lottery_Cannot_Process_Refund();
    if (hasClaimedRefund[round][msg.sender]) revert Levi_Lottery_Cannot_Process_Refund();

    uint256 amountOfEntries = numberOfEntriesInRoundPerAccount[round][msg.sender];
    uint256 etherToRefund = entryPrice * amountOfEntries;

    hasClaimedRefund[round][msg.sender] = true;

    (bool success, ) = msg.sender.call{value: etherToRefund}("");
    require(success);

    emit Refunded(msg.sender, round, etherToRefund, amountOfEntries);
  }

  /// PENDING NOT FINISHED. THIS FUNCTION MUST CONVERT balances[address(this)] into GLP.
  // function convertToGLP() external {
  //   uint256 amountToBeConverted = balances[address(this)];

  //   balances[address(this)] = 0;
  // }

  /// @notice Returns the current round of the lottery.
  function getRound() public view returns (uint256) {
    return ((block.timestamp - startDate) / interval) + 1;
  }

  /// A round is invalid if it is equal or greater than the current round
  /// A round is invalid if it has less than 5 unique players.
  function isRoundValid(uint256 round) public view returns (bool) {
    uint256 currentRound = getRound();

    if (round >= currentRound) return false;
    if (uniqueAccountsInRound[round] < 5) return false;

    return true;
  }

  function _random() internal view returns (uint256) {
    return
      uint256(
        keccak256(abi.encodePacked(msg.sender, block.timestamp, blockhash((block.number - 32))))
      );
  }
}
