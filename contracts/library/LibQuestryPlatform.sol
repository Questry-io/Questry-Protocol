// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";
import {IBoard} from "../interface/token/IBoard.sol";

/**
 * @dev Library for QuestryPlatform.
 */
library LibQuestryPlatform {
  bytes4 public constant NATIVE_PAYMENT_MODE = bytes4(keccak256("NATIVE"));
  bytes4 public constant ERC20_PAYMENT_MODE = bytes4(keccak256("ERC20"));

  struct AllocateArgs {
    IPJManager pjManager;
    bytes4 paymentMode; // determines to allocate native or ERC20 token
    IERC20 paymentToken; // ERC20 token to allocate. Ignored if paymentMode == NATIVE_PAYMENT_MODE
    IBoard board; // allocation target board which has contributions
    CalculateDispatchArgs calculateArgs; // allocation calculation args
    IContributionPool[] updateNeededPools; // term update needed pools
    Signature signature; // signature
  }

  struct Signature {
    address signer;
    bytes32 signature;
    uint256 signedTime;
  }

  /**
   * @dev Result type of calculation functions.
   */
  struct SharesResult {
    uint120[] shares;
    uint120 totalShare;
  }

  /**
   * @dev Argments for linear allocation algorithm.
   */
  struct SharesWithLinearArgs {
    IContributionPool[] pools;
    uint120[] coefs;
  }

  /**
   * @dev Arguments for CalculteDispatch
   */
  struct CalculateDispatchArgs {
    bytes4 algorithm; // calculation algorithm for the board.
    bytes args; // arguments for the calculation algorithm.
  }
}
