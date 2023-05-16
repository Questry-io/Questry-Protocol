// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";
import {IBoard} from "../interface/token/IBoard.sol";
import {IPaymentResolver} from "../interface/platform/IPaymentResolver.sol";

/**
 * @dev Library for QuestryPlatform.
 */
library LibQuestryPlatform {
  bytes4 public constant NATIVE_PAYMENT_MODE = bytes4(keccak256("NATIVE"));
  bytes4 public constant ERC20_PAYMENT_MODE = bytes4(keccak256("ERC20"));

  bytes4 public constant COMMON_PAYMENT_CATEGORY =
    bytes4(keccak256("COMMON_PAYMENT_CATEGORY"));
  bytes4 public constant INVESTMENT_PAYMENT_CATEGORY =
    bytes4(keccak256("INVESTMENT_PAYMENT_CATEGORY"));
  bytes4 public constant PROTOCOL_PAYMENT_CATEGORY =
    bytes4(keccak256("PROTOCOL_PAYMENT_CATEGORY"));

  // ---- Role ----
  bytes32 public constant PLATFORM_ADMIN_ROLE =
    keccak256("PLATFORM_ADMIN_ROLE");
  bytes32 public constant PLATFORM_EXECUTOR_ROLE =
    keccak256("PLATFORM_EXECUTOR_ROLE");

  // ---- Struct ----

  struct FeeRates {
    uint32 common;
    uint32 investment;
    uint32 protocol;
  }

  struct AllocateArgs {
    IPJManager pjManager;
    bytes4 paymentMode; // determines to allocate native or ERC20 token
    IERC20 paymentToken; // ERC20 token to allocate. Ignored if paymentMode == NATIVE_PAYMENT_MODE (TODO: Check zero-address if paymentMode == NATIVE_PAYMENT_MODE)
    IBoard board; // allocation target board which has contributions
    CalculateDispatchArgs calculateArgs; // allocation calculation args
    IContributionPool[] updateNeededPools; // term update needed pools
    uint256 pjnonce;
  }

  struct ExecutePaymentArgs {
    bytes4 paymentMode; // determines to pay with whether native or ERC20 token
    IERC20 paymentToken; // ERC20 token to allocate. It must be zero-address if paymentMode == NATIVE_PAYMENT_MODE
    bytes4 paymentCategory; // common, investment, or protocol payment
    address pjManager; // PJManager address
    address from;
    address to;
    uint256 amount;
    IPaymentResolver resolver; // resolver.resolveAfterPayment(_args) called after payment
    uint256 nonce; // nonce for replay attack protection
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
  bytes32 private constant AllOCATE_TYPEHASH =
    keccak256(
      "AllocateArgs(address pjManager,bytes4 paymentMode,address paymentToken,address board,CalculateDispatchArgs calculateArgs,address[] updateNeededPools,uint256 pjnonce)CalculateDispatchArgs(bytes4 algorithm,bytes args)"
    );

  bytes32 private constant CALCURATEDISPATCHARGS_TYPEHASH =
    keccak256("CalculateDispatchArgs(bytes4 algorithm,bytes args)");

  bytes32 private constant EXECUTEPAYMENTARGS_TYPEHASH =
    keccak256(
      "ExecutePaymentArgs(bytes4 paymentMode,address paymentToken,bytes4 paymentCategory,address pjManager,address from,address to,uint256 amount,uint256 nonce)"
    );

  /**
   * @dev Prepares keccak256 hash for Allocate
   *
   * @param _allocateargs LibQuestryPlatform.AllocateArgs
   */
  function _hashAllocate(AllocateArgs calldata _allocateargs)
    internal
    pure
    returns (bytes32)
  {
    return
      keccak256(
        abi.encode(
          AllOCATE_TYPEHASH,
          _allocateargs.pjManager,
          _allocateargs.paymentMode,
          _allocateargs.paymentToken,
          _allocateargs.board,
          _hashCalculateDispatchArgs(_allocateargs.calculateArgs),
          keccak256(abi.encodePacked(_allocateargs.updateNeededPools)),
          _allocateargs.pjnonce
        )
      );
  }

  /**
   * @dev Prepares keccak256 hash for CalculateDispatchArgs
   *
   * @param _calculatedispatchargs LibQuestryPlatform.CalculateDispatchArgs
   */
  function _hashCalculateDispatchArgs(
    CalculateDispatchArgs calldata _calculatedispatchargs
  ) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          CALCURATEDISPATCHARGS_TYPEHASH,
          _calculatedispatchargs.algorithm,
          keccak256(_calculatedispatchargs.args)
        )
      );
  }

  /**
   * @dev Prepares keccak256 hash for ExecutePaymentArgs
   *
   * @param _executePaymentArgs LibQuestryPlatform.ExecutePaymentArgs
   */
  function _hashExecutePaymentArgs(
    ExecutePaymentArgs calldata _executePaymentArgs
  ) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          EXECUTEPAYMENTARGS_TYPEHASH,
          _executePaymentArgs.paymentMode,
          _executePaymentArgs.paymentToken,
          _executePaymentArgs.paymentCategory,
          _executePaymentArgs.pjManager,
          _executePaymentArgs.from,
          _executePaymentArgs.to,
          _executePaymentArgs.amount,
          _executePaymentArgs.nonce
        )
      );
  }

  /**
   * @dev validation check
   */
  function _checkParameterForAllocation(AllocateArgs calldata _allocateargs)
    internal
  {
    //pjmaneger validation
    require(
      address(_allocateargs.pjManager) != address(0),
      "LibQuestryPlatform: PJManager is Invalid"
    );
    //paymnet mode validation
    require(
      bytes4(_allocateargs.paymentMode) != bytes4(0),
      "LibQuestryPlatform: PaymentMode is Invalid"
    );

    //Whitelist check
    if (_allocateargs.paymentMode == ERC20_PAYMENT_MODE) {
      //paymnet Token Address validation
      require(
        address(_allocateargs.paymentToken) != address(0),
        "LibQuestryPlatform: payment Token Address is Invalid"
      );
      // Whitelist check
      // EM: BuyOrder paymentToken not whitelisted
      require(
        _allocateargs.pjManager.isWhitelisted(_allocateargs.paymentToken),
        "LibQuestryPlatform: Is not PJ Whitelist token"
      );
    }
    //SBT Address validation
    require(
      address(_allocateargs.board) != address(0),
      "LibQuestryPlatform: Board address is invalid"
    );

    /**
     * @dev : Calcurator args is validation skip
     */

    //calcuration pool element check &ContributePool Owner check
    require(
      _allocateargs.updateNeededPools.length > 0,
      "LibQuestryPlatform: contribution pool is zero"
    );
    //Contributioonpool check
    for (uint256 idx = 0; idx < _allocateargs.updateNeededPools.length; idx++) {
      require(
        address(_allocateargs.updateNeededPools[idx]) != address(0),
        "LibQuestryPlatform: contribution pool address is invalid"
      );
    }
    require(
      _allocateargs.pjManager.getNonce() == _allocateargs.pjnonce,
      "LibQuestryPlatform: message nonce is different from on-chain nonce"
    );
  }
}
