// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibQuestryPlatform} from "../../library/LibQuestryPlatform.sol";
import {LibPJManager} from "../../library/LibPJManager.sol";

interface IPJManager {
  event AddBusinessOwner(address owner, uint120 share);
  event RemoveBusinessOwner(address owner);
  event UpdateBusinessOwner(address owner, uint120 share);
  event RegisterBoard(address board);
  event Deposit(address depositer, uint256 netAmount);
  event DepositERC20(address token, address depositer, uint256 netAmount);
  event AllowERC20(address token);
  event DisallowERC20(address token);

  /**
   * @dev Deposits an amount into the pool.
   *
   * Emits a {Deposit} or {DepositERC20} event.
   */
  function deposit(
    bytes4 _paymentMode,
    IERC20 _paymentToken,
    address _from,
    uint256 _amount
  ) external payable;

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
   * @dev Assign a new board id corresponding to the `_board` and `_tokenId` pair.
   */
  function assignBoardId(address _board, uint256 _tokenId) external;

  /**
   * @dev Resolve unique boardId in the project from `_board` and `_tokenId` pair.
   */
  function resolveBoardId(address _board, uint256 _tokenId)
    external
    view
    returns (uint256);

  /**
   * @dev verify signature.
   * Returns the signers recovered from signatures and verified their roles.
   */
  function verifySignature(
    LibQuestryPlatform.AllocateArgs calldata _args,
    bytes[] calldata _signatures
  ) external view returns (address[] memory);

  /**
   * @dev Get PJManager signature nonce
   */
  function getNonce() external view returns (uint256);

  /**
   * @dev Get PJManager signature verify threshold
   */
  function getThreshold() external view returns (uint256);

  /**
   * @dev Increment nonce for signature.
   */
  function incrementNonce() external;

  /**
   * @dev Returns the businessOwner.
   */
  function getBusinessOwner() external view returns (address);

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

  /**
   * @dev The denominator for boarding member proportion.
   */
  function getBoardingMemberProportionDenominator()
    external
    pure
    returns (uint32);
}
