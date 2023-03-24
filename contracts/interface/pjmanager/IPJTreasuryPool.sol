// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IKanamePlatform} from "../platform/IKanamePlatform.sol";

interface IPJTreasuryPool {
  event AddBusinessOwner(address owner, uint120 share);
  event RemoveBusinessOwner(address owner);
  event UpdateBusinessOwner(address owner, uint120 share);
  event Deposit(address depositer, uint256 amount);
  event DepositERC20(address token, address depositer, uint256 amount);
  event AllowERC20(address token);
  event DisallowERC20(address token);

  /**
   * @dev Allocation share for target address.
   */
  struct AllocationShare {
    address recipient;
    uint120 share;
  }

  /**
   * @dev Adds `_businessOwner` to businessOwners.
   *
   * Emits an {AddBusinessOwner} event.
   */
  function addBusinessOwner(AllocationShare calldata _businessOwner) external;

  /**
   * @dev Removes `_businessOwner` from businessOwners.
   *
   * Emits an {RemoveBusinessOwner} event.
   */
  function removeBusinessOwner(address _businessOwner) external;

  /**
   * @dev Updates `_businessOwner` for existing business owner.
   *
   * Emits an {UpdateBusinessOwner} event.
   */
  function updateBusinessOwner(AllocationShare calldata _businessOwner)
    external;

  /**
   * @dev Adds the ERC20 `token` to the whitelist.
   *
   * Emits an {AllowERC20} event.
   */
  function allowERC20(IERC20 token) external;

  /**
   * @dev Removes the ERC20 `token` from the whitelist.
   *
   * Emits a {DisallowERC20} event.
   */
  function disallowERC20(IERC20 token) external;

  /**
   * @dev Deposits the native token into the pool.
   *
   * Emits a {Deposit} event.
   */
  function deposit() external payable;

  /**
   * @dev Deposits an `amount` of the ERC20 `token` into the pool.
   * Note: Amount directly transfered via ERC20 function also is used for allocation.
   *
   * Emits a {DepositERC20} event.
   */
  function depositERC20(IERC20 token, uint256 amount) external;

  /**
   * @dev Allocates to the boarding members, business owners and DAO treasury pool.
   */
  function allocate(IKanamePlatform.AllocateArgs calldata _args) external;

  /**
   * @dev Returns token whitelists.
   */
  function getTokenWhitelists() external view returns (IERC20[] memory);

  /**
   * @dev Returns if `token` is whitelisted or not.
   */
  function isWhitelisted(IERC20 token) external view returns (bool);
}
