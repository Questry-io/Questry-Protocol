// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {IKanamePlatform} from "../interface/platform/IKanamePlatform.sol";

contract PJManagerMock is IPJManager {
  using Counters for Counters.Counter;

  Counters.Counter public boardIdTracker;
  mapping(address => mapping(uint256 => uint256)) public boardIds;

  constructor() {
    boardIdTracker.increment();
  }

  function registerBoard(address sbt, uint256 tokenId) external {
    boardIds[sbt][tokenId] = boardIdTracker.current();
    boardIdTracker.increment();
  }

  function resolveBoardId(address sbt, uint256 tokenId)
    external
    view
    returns (uint256)
  {
    require(
      boardIds[sbt][tokenId] > 0,
      "PJManagerMock: resolve for nonexistent board"
    );
    return boardIds[sbt][tokenId];
  }

  function addBusinessOwner(AllocationShare calldata _businessOwner) external {
    revert("Not implemented.");
  }

  function removeBusinessOwner(address _businessOwner) external {
    revert("Not implemented.");
  }

  function updateBusinessOwner(AllocationShare calldata _businessOwner)
    external
  {
    revert("Not implemented.");
  }

  function allowERC20(IERC20 token) external {
    revert("Not implemented.");
  }

  function disallowERC20(IERC20 token) external {
    revert("Not implemented.");
  }

  function deposit() external payable {
    revert("Not implemented.");
  }

  function depositERC20(IERC20 token, uint256 amount) external {
    revert("Not implemented.");
  }

  function allocate(IKanamePlatform.AllocateArgs calldata _args) external {
    revert("Not implemented.");
  }

  function getBusinessOwners() external view returns (AllocationShare[] memory) {
    revert("Not implemented.");
  }

  function getTokenWhitelists() external view returns (IERC20[] memory) {
    revert("Not implemented.");
  }

  function isWhitelisted(IERC20 token) external view returns (bool) {
    revert("Not implemented.");
  }
}
