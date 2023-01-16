// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "hardhat/console.sol";

interface LotteryV2Interface {
  function enterLottery(uint256 amountEntries) external payable;

  function convertEthBalanceIntoGLP() external;

  function selectWinner(uint256 round) external;

  function withdraw() external;

  function getRefund(uint256 round) external;
}

contract LotteryV2FakeSender {
  LotteryV2Interface lotto;

  constructor(address _lottoAddress) payable {
    lotto = LotteryV2Interface(_lottoAddress);
  }

  function enter() external {
    lotto.enterLottery{value: 0.01 ether}(1);
  }

  function convert() external {
    lotto.convertEthBalanceIntoGLP();
  }

  function pickWinner(uint256 round) external {
    lotto.selectWinner(round);
  }

  function claim() external {
    lotto.withdraw();
  }

  function refundMe(uint256 round) external {
    lotto.getRefund(round);
  }
}
