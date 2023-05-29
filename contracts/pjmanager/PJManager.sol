// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {PJTreasuryPool} from "./PJTreasuryPool.sol";
import {SignatureVerifier} from "./SignatureVerifier.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";

//interface imported
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {IBoard} from "../interface/token/IBoard.sol";
import {IQuestryPlatform} from "../interface/platform/IQuestryPlatform.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Library imported
import {LibPJManager} from "../library/LibPJManager.sol";
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";

/**
 * @title PJManager
 * @dev This is abstract contract that stores treasury and controls token whitelists.
 */
contract PJManager is
  IPJManager,
  PJTreasuryPool,
  SignatureVerifier,
  ReentrancyGuard
{
  using Counters for Counters.Counter;

  /// @dev the basis points proportion of total allocation for boarding members
  uint32 public immutable boardingMembersProportion;
  uint32 private _defaultThreshold = 1;
  address public immutable admin;
  address public businessOwner;
  IBoard[] public boards;
  Counters.Counter public boardIdTracker;
  mapping(address => mapping(uint256 => uint256)) public boardIds;
  address[] public boardingMembers;
  mapping(address => bool) private onBoarding;
  //signature verify reply management
  mapping(bytes => bool) private _isCompVerifySignature;

  constructor(
    IQuestryPlatform _questryPlatform,
    address _admin,
    uint32 _boardingMembersProportion,
    address _businessOwner
  ) {
    require(
      _boardingMembersProportion <= _boardingMemberProportionDenominator(),
      "LibPJManager: proportion is out of range"
    );

    admin = _admin;
    boardingMembersProportion = _boardingMembersProportion;
    businessOwner = _businessOwner;
    boardIdTracker.increment();

    //set nonce increment roll
    _setupRole(LibPJManager.PJ_NONCE_INCREMENT_ROLE, address(_questryPlatform));
    _setupRole(LibPJManager.PJ_DEPOSIT_ROLE, address(_questryPlatform));
    _setupRole(LibPJManager.PJ_WITHDRAW_ROLE, address(_questryPlatform));

    //set signature threshold
    _setThreshold(_defaultThreshold);

    _setupRole(LibPJManager.PJ_ADMIN_ROLE, _admin);

    _setRoleAdmin(LibPJManager.PJ_MANAGEMENT_ROLE, LibPJManager.PJ_ADMIN_ROLE);
    _setRoleAdmin(LibPJManager.PJ_WHITELIST_ROLE, LibPJManager.PJ_ADMIN_ROLE);
    _setRoleAdmin(
      LibPJManager.PJ_VERIFY_SIGNER_ROLE,
      LibPJManager.PJ_ADMIN_ROLE
    );
  }

  // --------------------------------------------------
  // PJManager Function
  // --------------------------------------------------

  /**
   * @dev Updates a businessOwner
   */
  function updateBusinessOwner(address _businessOwner) external {
    require(
      hasRole(LibPJManager.PJ_MANAGEMENT_ROLE, _msgSender()) ||
        hasRole(LibPJManager.PJ_ADMIN_ROLE, _msgSender()),
      "Invalid executor role"
    );
    businessOwner = _businessOwner;
  }

  /**
   * @dev Registers a new `_board`.
   *
   * Emits a {RegisterBoard} event.
   */
  function registerBoard(IBoard _board) external {
    require(
      hasRole(LibPJManager.PJ_MANAGEMENT_ROLE, _msgSender()) ||
        hasRole(LibPJManager.PJ_ADMIN_ROLE, _msgSender()),
      "Invalid executor role"
    );
    for (uint8 i = 0; i < boards.length; i++) {
      require(boards[i] != _board, "PJManager: board already exists");
    }
    _setupRole(LibPJManager.PJ_BOARD_ID_ROLE, address(_board));
    boards.push(_board);
    emit RegisterBoard(address(_board));
  }

  // --------------------------------------------------
  // PJTreasuryPool Function
  // --------------------------------------------------

  /// @inheritdoc IPJManager
  function withdrawForAllocation(
    bytes4 _paymentMode,
    IERC20 _paymentToken,
    address _receiver,
    uint256 _amount
  ) external onlyRole(LibPJManager.PJ_WITHDRAW_ROLE) nonReentrant {
    _withdrawForAllocation(_paymentMode, _paymentToken, _receiver, _amount);
  }

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
  ) external payable onlyRole(LibPJManager.PJ_DEPOSIT_ROLE) nonReentrant {
    _deposit(_paymentMode, _paymentToken, _from, _amount);
  }

  /**
   * @dev Adds the ERC20 `_token` to the whitelist.
   *
   * Emits an {AllowERC20} event.
   */
  function allowERC20(IERC20 _token) external {
    require(
      hasRole(LibPJManager.PJ_WHITELIST_ROLE, _msgSender()) ||
        hasRole(LibPJManager.PJ_ADMIN_ROLE, _msgSender()),
      "Invalid executor role"
    );
    _allowERC20(_token);
  }

  /**
   * @dev Removes the ERC20 `_token` from the whitelist.
   *
   * Emits a {DisallowERC20} event.
   */
  function disallowERC20(IERC20 _token) external {
    require(
      hasRole(LibPJManager.PJ_WHITELIST_ROLE, _msgSender()) ||
        hasRole(LibPJManager.PJ_ADMIN_ROLE, _msgSender()),
      "Invalid executor role"
    );
    _disallowERC20(_token);
  }

  // --------------------------------------------------
  // Signature Verifier Function
  // --------------------------------------------------

  /// @inheritdoc IPJManager
  function verifySignature(
    LibQuestryPlatform.AllocateArgs calldata _args,
    bytes[] calldata _signatures
  ) external view returns (address[] memory) {
    address[] memory tempVerifiedSigners = new address[](_signatures.length);
    uint8 verifiedCount = 0;
    for (uint256 idx = 0; idx < _signatures.length; idx++) {
      // Verify signatures
      address recoveredAddress = _verifySignaturesForAllocation(
        _args,
        _signatures[idx]
      );
      if (
        hasRole(LibPJManager.PJ_VERIFY_SIGNER_ROLE, recoveredAddress) ||
        hasRole(LibPJManager.PJ_ADMIN_ROLE, recoveredAddress)
      ) {
        tempVerifiedSigners[verifiedCount] = recoveredAddress;
        verifiedCount += 1;
      }
    }

    require(
      verifiedCount >= _getThreshold(),
      "PJManager: fall short of threshold for verify"
    );

    address[] memory verifiedSigners = new address[](verifiedCount);
    for (uint256 idx = 0; idx < verifiedCount; idx++) {
      verifiedSigners[idx] = tempVerifiedSigners[idx];
    }

    return verifiedSigners;
  }

  //PJManager Signature verifier Nonce Increment function
  function incrementNonce()
    external
    onlyRole(LibPJManager.PJ_NONCE_INCREMENT_ROLE)
  {
    /**
     * todo: increment roll is questry platform fix this roll
     */
    _incrementNonce();
  }

  //Signature verify threshold setting for multisig
  function setThreshold(uint256 _threshold)
    external
    onlyRole(LibPJManager.PJ_ADMIN_ROLE)
  {
    require(_threshold > 0, "PJManager :threshold does not set zero");
    _setThreshold(_threshold);
  }

  /**
   * @dev Get PJManager signature nonce
   */
  function getNonce() external view returns (uint256) {
    return _getNonce();
  }

  /**
   * @dev Get PJManager signature verify threshold
   */
  function getThreshold() external view returns (uint256) {
    return _getThreshold();
  }

  // --------------------------------------------------
  // DID BoardId functions
  // --------------------------------------------------

  /// @inheritdoc IPJManager
  function assignBoardingMember(
    address _member,
    address _board,
    uint256 _tokenId
  ) external onlyRole(LibPJManager.PJ_BOARD_ID_ROLE) {
    require(
      boardIds[_board][_tokenId] == 0,
      "PJManager: assign for existent boardId"
    );
    boardIds[_board][_tokenId] = boardIdTracker.current();
    if (!onBoarding[_member]) {
      onBoarding[_member] = true;
      boardingMembers.push(_member);
    }
    boardIdTracker.increment();
  }

  /// @inheritdoc IPJManager
  function resolveBoardId(address _board, uint256 _tokenId)
    external
    view
    returns (uint256)
  {
    require(
      boardIds[_board][_tokenId] > 0,
      "PJManager: resolve for nonexistent boardId"
    );
    return boardIds[_board][_tokenId];
  }

  // --------------------------------------------------
  // Public functions
  // --------------------------------------------------

  /// @inheritdoc IPJManager
  function getBusinessOwner() external view returns (address) {
    return businessOwner;
  }

  /// @inheritdoc IPJManager
  function getBoardingMembersProportion() external view returns (uint32) {
    return boardingMembersProportion;
  }

  /**
   * @dev Returns the list of boards.
   */
  function getBoards() external view returns (IBoard[] memory) {
    return boards;
  }

  /**
   * @dev Returns the list of board members across all boards in this project.
   */
  function getBoardingMembers() external view returns (address[] memory) {
    return boardingMembers;
  }

  /**
   * @dev Returns if the `_account` is a boarding member in this project.
   */
  function isBoardingMember(address _account) external view returns (bool) {
    return onBoarding[_account];
  }

  /// @inheritdoc IPJManager
  function getBoardingMemberProportionDenominator()
    external
    pure
    returns (uint32)
  {
    return _boardingMemberProportionDenominator();
  }

  // --------------------------------------------------
  // Internal functions
  // --------------------------------------------------

  /**
   * @dev The denominator for boarding member proportion.
   */
  function _boardingMemberProportionDenominator()
    internal
    pure
    returns (uint32)
  {
    return 10000;
  }
}
