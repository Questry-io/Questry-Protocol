// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPJManager} from "../pjmanager/IPJManager.sol";
import {IContributionCalculator} from "../platform/IContributionCalculator.sol";
import {IKanamePlatform} from "../platform/IKanamePlatform.sol";
import {ISBT} from "../token/ISBT.sol";

interface IKanamePlatform {
  /**
   * TODO: Move to PlatfromDomain library.
   * @dev Arguments for KanamePlatform.allocate() funtion.
   */
  struct AllocateArgs {
    IPJManager pjManager;
    bytes4 paymentMode;           // determines to allocate native or ERC20 token
    IERC20 paymentToken;          // ERC20 token to allocate. Ignored if paymentMode == NATIVE_PAYMENT_MODE
    ISBT board;                   // allocation target board which has contributions
    IContributionCalculator.CalculateDispatchArgs calculateArgs; // allocation calculation args
    Signature signature;          // signature
  }

  struct Signature {
    address signer;
    bytes32 signature;
    uint256 signedTime;
  }

  /**
   * @dev Returns the DAO treasury pool.
   */
  function getDAOTreasuryPool()
    external
    view
    returns (address);

  /**
   * @dev Returns the basis points of the fees deducted from the PJTreasuryPool
   * and allocated to the DAOTreasuryPool.
   */
  function getProtocolFeeRate()
    external
    pure
    returns (uint32);
}
