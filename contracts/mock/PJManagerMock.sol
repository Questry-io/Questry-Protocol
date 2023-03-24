// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {IPJManager} from "../interface/pjmanager/IPJ-Manager.sol";

contract PJManagerMock is IPJManager {
  using Counters for Counters.Counter;

  Counters.Counter public boardIdTracker;
  mapping (address => mapping(uint256 => uint256)) public boardIds;

  constructor() {
    boardIdTracker.increment();
  }

  function registerBoard(address sbt, uint256 tokenId)
    external
  {
    boardIds[sbt][tokenId] = boardIdTracker.current();
    boardIdTracker.increment();
  }

  function resolveBoardId(address sbt, uint256 tokenId)
    external
    view
    returns (uint256)
  {
    require(boardIds[sbt][tokenId] > 0, "PJManagerMock: resolve for nonexistent board");
    return boardIds[sbt][tokenId];
  }
}
