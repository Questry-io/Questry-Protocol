// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {LibPJManager} from "../library/LibPJManager.sol";
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";
import {QuestryPlatform} from "../platform/QuestryPlatform.sol";

/**
 * @title PJTreasuryPool
 * @dev This is abstract contract that stores treasury and controls token whitelists.
 */
abstract contract PJTreasuryPool is IPJManager, AccessControl {
  QuestryPlatform public immutable questryPlatform;
  IERC20[] public tokenWhitelists;
  mapping(IERC20 => bool) private _isTokenWhitelisted;

  constructor(QuestryPlatform _questryPlatform) {
    questryPlatform = _questryPlatform;
    _setupRole(LibPJManager.PJ_WITHDRAW_ROLE, address(_questryPlatform));
  }

  // --------------------------------------------------
  // LibPJManager.PJ_WITHDRAW_ROLE
  // --------------------------------------------------

  /// @inheritdoc IPJManager
  function withdrawForAllocation(
    bytes4 paymentMode,
    IERC20 paymentToken,
    address receiver,
    uint256 amount
  ) external onlyRole(LibPJManager.PJ_WITHDRAW_ROLE) {
    require(
      paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE ||
        _isTokenWhitelisted[paymentToken],
      "PJTreasuryPool: not whitelisted"
    );

    if (paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE) {
      // Sending ETH
      Address.sendValue(payable(receiver), amount);
    } else if (paymentMode == LibQuestryPlatform.ERC20_PAYMENT_MODE) {
      // Sending ERC20
      paymentToken.transfer(receiver, amount);
    } else {
      revert("PJTreasuryPool: unknown paymentMode");
    }
  }

  // --------------------------------------------------
  // LibPJManager.PJ_DEPOSIT_ROLE
  // --------------------------------------------------

  /**
   * @dev Deposits the native token into the pool.
   *
   * Emits a {Deposit} event.
   */
  function deposit() external payable onlyRole(LibPJManager.PJ_DEPOSIT_ROLE) {
    emit Deposit(_msgSender(), msg.value);
  }

  /**
   * @dev Deposits an `amount` of the ERC20 `token` into the pool.
   * Note: Amount directly transfered via ERC20 function also is used for allocation.
   *
   * Emits a {DepositERC20} event.
   */
  function depositERC20(IERC20 token, uint256 amount)
    external
    onlyRole(LibPJManager.PJ_DEPOSIT_ROLE)
  {
    require(_isTokenWhitelisted[token], "PJTreasuryPool: not whitelisted");
    token.transferFrom(_msgSender(), address(this), amount);
    emit DepositERC20(address(token), _msgSender(), amount);
  }

  // --------------------------------------------------
  // LibPJManager.PJ_WHITELIST_ROLE
  // --------------------------------------------------

  /**
   * @dev Adds the ERC20 `token` to the whitelist.
   *
   * Emits an {AllowERC20} event.
   */
  function allowERC20(IERC20 token)
    external
    onlyRole(LibPJManager.PJ_WHITELIST_ROLE)
  {
    require(
      Address.isContract(address(token)),
      "PJTreasuryPool: token is not a contract"
    );
    require(!_isTokenWhitelisted[token], "PJTreasuryPool: already whitelisted");
    tokenWhitelists.push(token);
    _isTokenWhitelisted[token] = true;
    emit AllowERC20(address(token));
  }

  /**
   * @dev Removes the ERC20 `token` from the whitelist.
   *
   * Emits a {DisallowERC20} event.
   */
  function disallowERC20(IERC20 token)
    external
    onlyRole(LibPJManager.PJ_WHITELIST_ROLE)
  {
    require(_isTokenWhitelisted[token], "PJTreasuryPool: not whitelisted");
    uint32 newIdx = 0;
    for (uint256 i = 0; i < tokenWhitelists.length; i++) {
      if (token != tokenWhitelists[i]) {
        tokenWhitelists[newIdx++] = tokenWhitelists[i];
      }
    }
    tokenWhitelists.pop();
    _isTokenWhitelisted[token] = false;
    emit DisallowERC20(address(token));
  }

  // --------------------------------------------------
  // Public functions
  // --------------------------------------------------

  /// @inheritdoc IPJManager
  function getTokenWhitelists() external view returns (IERC20[] memory) {
    return tokenWhitelists;
  }

  /// @inheritdoc IPJManager
  function isWhitelisted(IERC20 token) public view returns (bool) {
    return _isTokenWhitelisted[token];
  }


  /// @inheritdoc IPJManager
  function getTotalBalance(bytes4 paymentMode, IERC20 paymentToken)
    external
    view
    returns (uint256)
  {
    if (paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE) {
      return address(this).balance;
    } else if (paymentMode == LibQuestryPlatform.ERC20_PAYMENT_MODE) {
      return paymentToken.balanceOf(address(this));
    } else {
      revert("PJTreasuryPool: unknown paymentMode");
    }
  }
}
