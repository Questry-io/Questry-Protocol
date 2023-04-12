// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @dev Library for PJManager. Defines constants, validations and create signatures.
 */
library LibPJManager {
  bytes32 public constant PJ_WITHDRAW_ROLE = keccak256("PJ_WITHDRAW_ROLE");

  bytes32 public constant PJ_ADMIN_ROLE = keccak256("PJ_ADMIN_ROLE");
  bytes32 public constant PJ_MANAGEMENT_ROLE = keccak256("PJ_MANAGEMENT_ROLE");
  bytes32 public constant PJ_WHITELIST_ROLE = keccak256("PJ_WHITELIST_ROLE");
  bytes32 public constant PJ_DEPOSIT_ROLE = keccak256("PJ_DEPOSIT_ROLE");

  /**
   * @dev Allocation share for target address.
   */
  struct AllocationShare {
    address recipient;
    uint120 share;
  }

  function _validateAllocationSettings(
    AllocationShare[] memory businessOwners,
    uint32 boardingMembersProportion
  ) internal pure {
    bool ownersShareExists = false;
    for (uint256 i = 0; i < businessOwners.length; i++) {
      if (businessOwners[i].share > 0) {
        ownersShareExists = true;
        break;
      }
    }
    _validateAllocationSettings(boardingMembersProportion, ownersShareExists);
  }

  function _validateAllocationSettings(
    uint32 _boardingMembersProportion,
    bool _businessOwnersShareExists
  ) internal pure {
    require(
      _boardingMembersProportion <= 10000,
      "LibPJManager: proportion is out of range"
    );
    if (_boardingMembersProportion < 10000) {
      require(
        _businessOwnersShareExists,
        "LibPJManager: businessOwners share should exist unless proportion is 10000"
      );
    } else {
      require(
        !_businessOwnersShareExists,
        "LibPJManager: proportion should be less than 10000 or businessOwners share should not exist"
      );
    }
  }
}
