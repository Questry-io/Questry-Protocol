// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";
import {ISBT} from "../interface/token/ISBT.sol";

/**
 * @dev Library for QuestryPlatform.
 */
library LibQuestryPlatform {
  bytes4 public constant NATIVE_PAYMENT_MODE = bytes4(keccak256("NATIVE"));
  bytes4 public constant ERC20_PAYMENT_MODE = bytes4(keccak256("ERC20"));

  //Role difinition
  

  struct AllocateArgs {
    IPJManager pjManager;
    bytes4 paymentMode; // determines to allocate native or ERC20 token
    IERC20 paymentToken; // ERC20 token to allocate. Ignored if paymentMode == NATIVE_PAYMENT_MODE
    ISBT board; // allocation target board which has contributions
    CalculateDispatchArgs calculateArgs; // allocation calculation args
    IContributionPool[] updateNeededPools; // term update needed pools
    uint256 pjnonce;
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
  
  // ---- EIP712 ----
  bytes32 private constant Allocate_TYPEHASH =
    keccak256(
      "AllocateArgs(address pjManager,bytes4 paymentMode,address paymentToken,address board,CalculateDispatchArgs calculateArgs,address[] updateNeededPools,uint256 pjnonce)CalculateDispatchArgs(bytes4 algorithm,bytes args)"
    );
  
  bytes32 private constant CALCURATEDISPATCHARGS_TYPEHASH =
    keccak256(
      "CalculateDispatchArgs(bytes4 algorithm,bytes args)"
    );

  /**
   * @dev Prepares keccak256 hash for Allocate
   *
   * @param _allocateargs 
   */
  function _hashAllocate(AllocateArgs calldata _allocateargs) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          Allocate_TYPEHASH,
          _allocateargs.pjManager,
          _allocateargs.paymentMode,
          _allocateargs.board,
          _hashCalculateDispatchArgs(_allocateargs.calculateArgs),
          _allocateargs.updateNeededPools,
          _allocateargs.pjnonce
        )
      );
  }

  /**
   * @dev Prepares keccak256 hash for CalculateDispatchArgs
   *
   * @param _calculatedispatchargs 
   */
  function _hashCalculateDispatchArgs(CalculateDispatchArgs calldata _calculatedispatchargs) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          CALCURATEDISPATCHARGS_TYPEHASH,
          _calculatedispatchargs.algorithm,
          _calculatedispatchargs.args
        )
      );
  }

}
