// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";

//library imported
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";

//interface imported
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";

/**
 * @title PJTreasuryPool
 * @dev This is abstract contract that stores treasury and controls token whitelists.
 */
abstract contract PJTreasuryPool is IPJManager, AccessControl {
  IERC20[] public tokenWhitelists;
  mapping(IERC20 => bool) private isTokenWhitelisted;

  /// @dev The amount of ERC20 tokens deposited into the contract,
  /// excluding any tokens transferred directly via the ERC20 function.
  mapping(IERC20 => uint256) private tokenBalance;

  function _deposit(
    bytes4 _paymentMode,
    IERC20 _paymentToken,
    address _from,
    uint256 _netAmount
  ) internal {
    if (_paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE) {
      _depositNative(_from, _netAmount);
    } else if (_paymentMode == LibQuestryPlatform.ERC20_PAYMENT_MODE) {
      _depositERC20(_paymentToken, _from, _netAmount);
    } else {
      revert("PJTreasuryPool: unknown paymentMode");
    }
  }

  function _depositNative(address _from, uint256 _netAmount) private {
    emit Deposit(_from, _netAmount);
  }

  function _depositERC20(
    IERC20 _paymentToken,
    address _from,
    uint256 _netAmount
  ) private {
    require(
      isTokenWhitelisted[_paymentToken],
      "PJTreasuryPool: not whitelisted"
    );
    tokenBalance[_paymentToken] += _netAmount;
    _paymentToken.transferFrom(_from, address(this), _netAmount);
    emit DepositERC20(address(_paymentToken), _from, _netAmount);
  }

  function _withdrawForAllocation(
    bytes4 _paymentMode,
    IERC20 _paymentToken,
    address _receiver,
    uint256 _amount
  ) internal {
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

  /**
   * @dev Adds the ERC20 `_token` to the whitelist.
   *
   * Emits an {AllowERC20} event.
   */
  function _allowERC20(IERC20 _token) internal {
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
  function _disallowERC20(IERC20 _token) internal {
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
      require(
        isTokenWhitelisted[_paymentToken],
        "PJTreasuryPool: not whitelisted"
      );
      return tokenBalance[_paymentToken];
    } else {
      revert("PJTreasuryPool: unknown paymentMode");
    }
  }
}
