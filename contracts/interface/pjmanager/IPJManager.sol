// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibPJManager} from "../../library/LibPJManager.sol";
import {ISignatureVerifier} from "./ISignatureVerifier.sol";

interface IPJManager is ISignatureVerifier {
  event AddBusinessOwner(address owner, uint120 share);
  event RemoveBusinessOwner(address owner);
  event UpdateBusinessOwner(address owner, uint120 share);
  event Deposit(address depositer, uint256 amount);
  event DepositERC20(address token, address depositer, uint256 amount);
  event AllowERC20(address token);
  event DisallowERC20(address token);

  /**
   * @dev Withdraws for allocation.
   */
  function withdrawForAllocation(
    bytes4 paymentMode,
    IERC20 paymentToken,
    address receiver,
    uint256 amount
  ) external;

  /**
   * @dev Register a new board which is identified by `sbt` and `tokenId` pair.
   */
  function registerBoard(address _sbt, uint256 _tokenId) external;

  /**
   * @dev Resolve unique boardId in the project from `sbt` and `tokenId` pair.
   */
  function resolveBoardId(address _sbt, uint256 _tokenId)
    external
    view
    returns (uint256);

  /**
   * @dev Returns businessOwners.
   */
  function getBusinessOwners()
    external
    view
    returns (LibPJManager.AllocationShare[] memory);

  /**
   * @dev Returns `boardingMembersProportion`.
   */
  function getBoardingMembersProportion() external view returns (uint32);

  /**
   * @dev Returns token whitelists.
   */
  function getTokenWhitelists() external view returns (IERC20[] memory);

  /**
   * @dev Returns if `_token` is whitelisted or not.
   */
  function isWhitelisted(IERC20 _token) external view returns (bool);

  /**
   * @dev Returns the total balance based on the specified `_paymentMode` and `_paymentToken`.
   */
  function getTotalBalance(bytes4 _paymentMode, IERC20 _paymentToken)
    external
    view
    returns (uint256);
}
