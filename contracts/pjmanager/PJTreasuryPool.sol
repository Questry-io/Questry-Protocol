// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
//library imported
import {LibPJManager} from "../library/LibPJManager.sol";
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";
//interface imported
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {IQuestryPlatform} from "../interface/platform/IQuestryPlatform.sol";

/**
 * @title PJTreasuryPool
 * @dev This is abstract contract that stores treasury and controls token whitelists.
 */
abstract contract PJTreasuryPool is IPJManager, AccessControl, ReentrancyGuard {
  IQuestryPlatform public immutable questryPlatform;

  IERC20[] public tokenWhitelists;
  mapping(IERC20 => bool) private isTokenWhitelisted;

  /// @dev The amount of ERC20 tokens deposited into the contract,
  /// excluding any tokens transferred directly via the ERC20 function.
  mapping(IERC20 => uint256) private tokenBalance;

  constructor(IQuestryPlatform _questryPlatform) {
    questryPlatform = _questryPlatform;
    _setupRole(LibPJManager.PJ_WITHDRAW_ROLE, address(_questryPlatform));
  }

  // --------------------------------------------------
  // LibPJManager.PJ_WITHDRAW_ROLE
  // --------------------------------------------------

  /// @inheritdoc IPJManager
  function withdrawForAllocation(
    bytes4 _paymentMode,
    IERC20 _paymentToken,
    address _receiver,
    uint256 _amount
  ) external onlyRole(LibPJManager.PJ_WITHDRAW_ROLE) nonReentrant {
    require(
      _paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE ||
        isTokenWhitelisted[_paymentToken],
      "PJTreasuryPool: not whitelisted"
    );

    if (_paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE) {
      // Sending ETH
      Address.sendValue(payable(_receiver), _amount);
    } else if (_paymentMode == LibQuestryPlatform.ERC20_PAYMENT_MODE) {
      // Sending ERC20
      require(
        tokenBalance[_paymentToken] >= _amount,
        "PJTreasuryPool: insufficient balance"
      );
      tokenBalance[_paymentToken] -= _amount;
      _paymentToken.transfer(_receiver, _amount);
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
   * @dev Deposits an `_amount` of the ERC20 `_token` into the pool.
   *
   * Emits a {DepositERC20} event.
   */
  function depositERC20(IERC20 _token, uint256 _amount)
    external
    onlyRole(LibPJManager.PJ_DEPOSIT_ROLE)
  {
    require(isTokenWhitelisted[_token], "PJTreasuryPool: not whitelisted");
    tokenBalance[_token] += _amount;
    _token.transferFrom(_msgSender(), address(this), _amount);
    emit DepositERC20(address(_token), _msgSender(), _amount);
  }

  // --------------------------------------------------
  // LibPJManager.PJ_WHITELIST_ROLE
  // --------------------------------------------------

  /**
   * @dev Adds the ERC20 `_token` to the whitelist.
   *
   * Emits an {AllowERC20} event.
   */
  function allowERC20(IERC20 _token)
    external
    onlyRole(LibPJManager.PJ_WHITELIST_ROLE)
  {
    require(
      Address.isContract(address(_token)),
      "PJTreasuryPool: token is not a contract"
    );
    require(!isTokenWhitelisted[_token], "PJTreasuryPool: already whitelisted");
    tokenWhitelists.push(_token);
    isTokenWhitelisted[_token] = true;
    emit AllowERC20(address(_token));
  }

  /**
   * @dev Removes the ERC20 `_token` from the whitelist.
   *
   * Emits a {DisallowERC20} event.
   */
  function disallowERC20(IERC20 _token)
    external
    onlyRole(LibPJManager.PJ_WHITELIST_ROLE)
  {
    require(isTokenWhitelisted[_token], "PJTreasuryPool: not whitelisted");
    uint32 newIdx = 0;
    for (uint256 i = 0; i < tokenWhitelists.length; i++) {
      if (_token != tokenWhitelists[i]) {
        tokenWhitelists[newIdx++] = tokenWhitelists[i];
      }
    }
    tokenWhitelists.pop();
    isTokenWhitelisted[_token] = false;
    emit DisallowERC20(address(_token));
  }

  // --------------------------------------------------
  // Public functions
  // --------------------------------------------------

  /// @inheritdoc IPJManager
  function getTokenWhitelists() external view returns (IERC20[] memory) {
    return tokenWhitelists;
  }

  /// @inheritdoc IPJManager
  function isWhitelisted(IERC20 _token) external view returns (bool) {
    return isTokenWhitelisted[_token];
  }

  /// @inheritdoc IPJManager
  function getTotalBalance(bytes4 _paymentMode, IERC20 _paymentToken)
    external
    view
    returns (uint256)
  {
    if (_paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE) {
      return address(this).balance;
    } else if (_paymentMode == LibQuestryPlatform.ERC20_PAYMENT_MODE) {
      return _paymentToken.balanceOf(address(this));
    } else {
      revert("PJTreasuryPool: unknown paymentMode");
    }
  }

  /**
   * @dev Returns the ERC20 `token` balance.
   */
  function getTokenBalance(IERC20 _token) external view returns (uint256) {
    require(isTokenWhitelisted[_token], "PJTreasuryPool: not whitelisted");
    return tokenBalance[_token];
  }
}
