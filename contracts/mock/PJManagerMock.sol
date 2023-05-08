// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {LibPJManager} from "../library/LibPJManager.sol";
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";

contract PJManagerMock is IPJManager {
  using Counters for Counters.Counter;

  Counters.Counter public boardIdTracker;
  mapping(address => mapping(uint256 => uint256)) public boardIds;

  constructor() {
    boardIdTracker.increment();
  }

  function registerBoard(address _board, uint256 _tokenId) external {
    boardIds[_board][_tokenId] = boardIdTracker.current();
    boardIdTracker.increment();
  }

  function resolveBoardId(address _board, uint256 _tokenId)
    external
    view
    returns (uint256)
  {
    require(
      boardIds[_board][_tokenId] > 0,
      "PJManagerMock: resolve for nonexistent board"
    );
    return boardIds[_board][_tokenId];
  }

  function addBusinessOwner(
    LibPJManager.AllocationShare calldata _businessOwner
  ) external {
    revert("Not implemented.");
  }

  function removeBusinessOwner(address _businessOwner) external {
    revert("Not implemented.");
  }

  function updateBusinessOwner(
    LibPJManager.AllocationShare calldata _businessOwner
  ) external {
    revert("Not implemented.");
  }

  function withdrawForAllocation(
    bytes4 _paymentMode,
    IERC20 _paymentToken,
    address _receiver,
    uint256 _amount
  ) external {
    revert("Not implemented.");
  }

  function allowERC20(IERC20 _token) external {
    revert("Not implemented.");
  }

  function disallowERC20(IERC20 _token) external {
    revert("Not implemented.");
  }

  function deposit() external payable {
    revert("Not implemented.");
  }

  function depositERC20(IERC20 _token, uint256 _amount) external {
    revert("Not implemented.");
  }

  function getBoardingMembersProportion() external view returns (uint32) {
    revert("Not implemented.");
  }

  function getBusinessOwners()
    external
    view
    returns (LibPJManager.AllocationShare[] memory)
  {
    revert("Not implemented.");
  }

  function getTokenWhitelists() external view returns (IERC20[] memory) {
    revert("Not implemented.");
  }

  function isWhitelisted(IERC20 _token) external view returns (bool) {
    revert("Not implemented.");
  }

  function getTotalBalance(bytes4 _paymentMode, IERC20 _paymentToken)
    external
    view
    returns (uint256)
  {
    revert("Not implemented.");
  }

  function verifySignature(LibQuestryPlatform.Signature calldata)
    public
    view
    returns (bool)
  {
    revert("Not implemented.");
  }
}
