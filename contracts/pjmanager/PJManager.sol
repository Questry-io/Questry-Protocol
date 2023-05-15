// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {PJTreasuryPool} from "./PJTreasuryPool.sol";
import {SignatureVerifier} from "./SignatureVerifier.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";

//interface imported
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
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
  LibPJManager.AllocationShare[] public businessOwners;
  LibPJManager.AllocationShare[] public boards;
  Counters.Counter public boardIdTracker;
  mapping(address => mapping(uint256 => uint256)) public boardIds;
  //signature verify reply management
  mapping(bytes => bool) private _isCompVerifySignature;

  constructor(
    IQuestryPlatform _questryPlatform,
    address _admin,
    uint32 _boardingMembersProportion,
    LibPJManager.AllocationShare[] memory _businessOwners
  ) {
    bool ownersShareExists = _initBusinessOwners(_businessOwners);
    LibPJManager._validateAllocationSettings(
      _businessOwners,
      _boardingMembersProportion
    );

    admin = _admin;
    boardingMembersProportion = _boardingMembersProportion;
    boardIdTracker.increment();

    //set nonce increment roll
    _setupRole(LibPJManager.PJ_NONCE_INCREMENT_ROLE, address(_questryPlatform));
    _setupRole(LibPJManager.PJ_WITHDRAW_ROLE, address(_questryPlatform));

    //set signature threshold
    _setThreshold(_defaultThreshold);

    _setupRole(LibPJManager.PJ_ADMIN_ROLE, _admin);

    _setRoleAdmin(LibPJManager.PJ_MANAGEMENT_ROLE, LibPJManager.PJ_ADMIN_ROLE);
    _setRoleAdmin(LibPJManager.PJ_WHITELIST_ROLE, LibPJManager.PJ_ADMIN_ROLE);
    _setRoleAdmin(LibPJManager.PJ_DEPOSIT_ROLE, LibPJManager.PJ_ADMIN_ROLE);
    _setRoleAdmin(
      LibPJManager.PJ_VERIFY_SIGNER_ROLE,
      LibPJManager.PJ_ADMIN_ROLE
    );
  }

  // --------------------------------------------------
  // LibPJManager.PJ_MANAGEMENT_ROLE
  // --------------------------------------------------

  /**
   * @dev Adds `_businessOwner` to businessOwners.
   *
   * Emits an {AddBusinessOwner} event.
   */
  function addBusinessOwner(
    LibPJManager.AllocationShare calldata _businessOwner
  ) external {
    require(
      hasRole(LibPJManager.PJ_MANAGEMENT_ROLE, _msgSender()) ||
        hasRole(LibPJManager.PJ_ADMIN_ROLE, _msgSender()),
      "Invalid executor role"
    );
    for (uint8 i = 0; i < businessOwners.length; i++) {
      require(
        businessOwners[i].recipient != _businessOwner.recipient,
        "PJManager: businessOwner already exists"
      );
    }
    businessOwners.push(_businessOwner);
    LibPJManager._validateAllocationSettings(
      businessOwners,
      boardingMembersProportion
    );
    emit AddBusinessOwner(_businessOwner.recipient, _businessOwner.share);
  }

  /**
   * @dev Removes `_businessOwner` from businessOwners.
   *
   * Emits an {RemoveBusinessOwner} event.
   */
  function removeBusinessOwner(address _businessOwner) external {
    require(
      hasRole(LibPJManager.PJ_MANAGEMENT_ROLE, _msgSender()) ||
        hasRole(LibPJManager.PJ_ADMIN_ROLE, _msgSender()),
      "Invalid executor role"
    );
    bool removed = false;
    uint32 newIdx = 0;
    for (uint256 i = 0; i < businessOwners.length; i++) {
      if (businessOwners[i].recipient == _businessOwner) {
        removed = true;
      } else {
        businessOwners[newIdx++] = businessOwners[i];
      }
    }
    require(removed, "PJManager: businessOwner doesn't exist");
    businessOwners.pop();
    LibPJManager._validateAllocationSettings(
      businessOwners,
      boardingMembersProportion
    );
    emit RemoveBusinessOwner(_businessOwner);
  }

  /**
   * @dev Updates `_businessOwner` for existing business owner.
   *
   * Emits an {UpdateBusinessOwner} event.
   */
  function updateBusinessOwner(
    LibPJManager.AllocationShare calldata _businessOwner
  ) external {
    require(
      hasRole(LibPJManager.PJ_MANAGEMENT_ROLE, _msgSender()) ||
        hasRole(LibPJManager.PJ_ADMIN_ROLE, _msgSender()),
      "Invalid executor role"
    );
    bool updated = false;
    for (uint256 i = 0; i < businessOwners.length; i++) {
      if (businessOwners[i].recipient == _businessOwner.recipient) {
        businessOwners[i].share = _businessOwner.share;
        updated = true;
      }
    }
    require(updated, "PJManager: businessOwner doesn't exist");
    LibPJManager._validateAllocationSettings(
      businessOwners,
      boardingMembersProportion
    );
    emit UpdateBusinessOwner(_businessOwner.recipient, _businessOwner.share);
  }

  /**
   * @dev Registers a new `_board`.
   *
   * Emits a {RegisterBoard} event.
   */
  function registerBoard(LibPJManager.AllocationShare memory _board) external {
    require(
      hasRole(LibPJManager.PJ_MANAGEMENT_ROLE, _msgSender()) ||
        hasRole(LibPJManager.PJ_ADMIN_ROLE, _msgSender()),
      "Invalid executor role"
    );
    for (uint8 i = 0; i < boards.length; i++) {
      require(
        boards[i].recipient != _board.recipient,
        "PJManager: board already exists"
      );
    }
    _setupRole(LibPJManager.PJ_BOARD_ID_ROLE, _board.recipient);
    boards.push(_board);
    emit RegisterBoard(_board.recipient, _board.share);
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
   * @dev Deposits the native token into the pool.
   *
   * Emits a {Deposit} event.
   */
  function deposit() public payable {
    require(
      hasRole(LibPJManager.PJ_DEPOSIT_ROLE, _msgSender()) ||
        hasRole(LibPJManager.PJ_ADMIN_ROLE, _msgSender()),
      "Invalid executor role"
    );
    emit Deposit(_msgSender(), msg.value);
  }

  /**
   * @dev Deposits an `_amount` of the ERC20 `_token` into the pool.
   *
   * Emits a {DepositERC20} event.
   */
  function depositERC20(IERC20 _token, uint256 _amount) external {
    require(
      hasRole(LibPJManager.PJ_DEPOSIT_ROLE, _msgSender()) ||
        hasRole(LibPJManager.PJ_ADMIN_ROLE, _msgSender()),
      "Invalid executor role"
    );
    _depositERC20(_token, _amount);
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

  function assignBoardId(address _board, uint256 _tokenId)
    external
    onlyRole(LibPJManager.PJ_BOARD_ID_ROLE)
  {
    require(
      boardIds[_board][_tokenId] == 0,
      "PJManager: assign for existent boardId"
    );
    boardIds[_board][_tokenId] = boardIdTracker.current();
    boardIdTracker.increment();
  }

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
  function getBusinessOwners()
    external
    view
    returns (LibPJManager.AllocationShare[] memory)
  {
    return businessOwners;
  }

  /// @inheritdoc IPJManager
  function getBoardingMembersProportion() external view returns (uint32) {
    return boardingMembersProportion;
  }

  /**
   * @dev Returns the list of boards.
   */
  function getBoards()
    external
    view
    returns (LibPJManager.AllocationShare[] memory)
  {
    return boards;
  }

  // --------------------------------------------------
  // Private functions
  // --------------------------------------------------

  function _initBusinessOwners(
    LibPJManager.AllocationShare[] memory _businessOwners
  ) private returns (bool shareExists) {
    uint256 totalShare = 0;
    for (uint256 i = 0; i < _businessOwners.length; i++) {
      totalShare += _businessOwners[i].share;
      businessOwners.push(_businessOwners[i]);
    }
    shareExists = totalShare > 0;
  }
}
