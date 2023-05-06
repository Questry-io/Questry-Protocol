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

  function addBusinessOwner(LibPJManager.AllocationShare calldata _businessOwner) external {
    revert("Not implemented.");
  }

  function removeBusinessOwner(address _businessOwner) external {
    revert("Not implemented.");
  }

  function updateBusinessOwner(LibPJManager.AllocationShare calldata _businessOwner)
    external
  {
    revert("Not implemented.");
  }

  function withdrawForAllocation(
    bytes4 paymentMode,
    IERC20 paymentToken,
    address receiver,
    uint256 amount
  ) external {
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

  function getBoardingMembersProportion()
    external
    view
    returns (uint32)
  {
    revert("Not implemented.");
  }

  function getBusinessOwners() external view returns (LibPJManager.AllocationShare[] memory) {
    revert("Not implemented.");
  }

  function getTokenWhitelists() external view returns (IERC20[] memory) {
    revert("Not implemented.");
  }

  function isWhitelisted(IERC20 token) external view returns (bool) {
    revert("Not implemented.");
  }

  function getTotalBalance(bytes4 paymentMode, IERC20 paymentToken)
    external
    view
    returns (uint256)
  {
    revert("Not implemented.");
  }

  function verifySignature(
    LibQuestryPlatform.AllocateArgs calldata _args, 
    bytes[] calldata _signatures
  )
    external
    view
    returns (bool)
  {
    revert("Not implemented.");
  }

  //PJManager Signature verifier Nonce Increment function
  function IncrementNonce()
    external
  {
    revert("Not implemented.");
  }

  //Signature verify threshold setting for multisig
  function setThreshold(uint256 _threshold)
    external
  {
    revert("Not implemented.");
  }

  /**
   * @dev Get PJManager signature nonce
   */
  function GetNonce() 
    external
    view 
    returns(uint256)
  {
    revert("Not implemented.");
  }

  /**
   * @dev Get PJManager signature verify threshold
   */
  function GetSigThreshold() 
    external 
    view 
    returns(uint256)
  {
    revert("Not implemented.");
  }
}
