// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {LibPJManager} from "../library/LibPJManager.sol";
import {QuestryPlatform} from "../platform/QuestryPlatform.sol";
import {PJTreasuryPool} from "./PJTreasuryPool.sol";
import {SignatureVerifier} from "./SignatureVerifier.sol";

// TODO: Remove this import after REGISTER_BOARD_ROLE implementations.
import {console} from "hardhat/console.sol";

/**
 * @title PJManager
 * @dev This is abstract contract that stores treasury and controls token whitelists.
 */
contract PJManager is IPJManager, PJTreasuryPool, SignatureVerifier {
  /// @dev the basis points proportion of total allocation for boarding members
  uint32 public immutable boardingMembersProportion;
  address public immutable admin;
  LibPJManager.AllocationShare[] public businessOwners;

  constructor(
    QuestryPlatform _questryPlatform,
    address _admin,
    uint32 _boardingMembersProportion,
    LibPJManager.AllocationShare[] memory _businessOwners
  ) PJTreasuryPool(_questryPlatform) {
    bool ownersShareExists = _initBusinessOwners(_businessOwners);
    LibPJManager._validateAllocationSettings(
      _businessOwners,
      _boardingMembersProportion
    );

    admin = _admin;
    boardingMembersProportion = _boardingMembersProportion;

    _setupRole(LibPJManager.PJ_ADMIN_ROLE, _admin);
    _setupRole(LibPJManager.PJ_MANAGEMENT_ROLE, _admin);
    _setupRole(LibPJManager.PJ_WHITELIST_ROLE, _admin);
    _setupRole(LibPJManager.PJ_DEPOSIT_ROLE, _admin);

    _setRoleAdmin(LibPJManager.PJ_MANAGEMENT_ROLE, LibPJManager.PJ_ADMIN_ROLE);
    _setRoleAdmin(LibPJManager.PJ_WHITELIST_ROLE, LibPJManager.PJ_ADMIN_ROLE);
    _setRoleAdmin(LibPJManager.PJ_DEPOSIT_ROLE, LibPJManager.PJ_ADMIN_ROLE);
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
  ) external onlyRole(LibPJManager.PJ_MANAGEMENT_ROLE) {
    for (uint256 i = 0; i < businessOwners.length; i++) {
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
  function removeBusinessOwner(address _businessOwner)
    external
    onlyRole(LibPJManager.PJ_MANAGEMENT_ROLE)
  {
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
  ) external onlyRole(LibPJManager.PJ_MANAGEMENT_ROLE) {
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

  // --------------------------------------------------
  // TODO: REGISTER_BOARD_ROLE
  // --------------------------------------------------

  function registerBoard(address _board, uint256 _tokenId) external {
    console.log("TODO: registerBoard() not implemented yet.");
  }

  function resolveBoardId(address _board, uint256 _tokenId)
    external
    view
    returns (uint256)
  {
    console.log("TODO: resolveBoardId() not implemented yet.");
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
