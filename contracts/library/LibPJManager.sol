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

  bytes32 public constant POOL_INCREMENT_TERM_ROLE = keccak256("POOL_INCREMENT_TERM_ROLE");
  bytes32 public constant POOL_CONTRIBUTION_UPDATER_ROLE = keccak256("POOL_CONTRIBUTION_UPDATER_ROLE");
  bytes32 public constant POOL_INCREMENT_TERM_WHITELIST_ADMIN_ROLE = keccak256("POOL_INCREMENT_TERM_WHITELIST_ADMIN_ROLE");
  bytes32 public constant POOL_ADMIN_ROLE = keccak256("POOL_ADMIN_ROLE");

  uint32 public constant MAX_BASIS_POINT = 10000;

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
    bool businessOwnersShareExists = false;
    for (uint256 i = 0; i < businessOwners.length; i++) {
      if (businessOwners[i].share > 0) {
        businessOwnersShareExists = true;
        break;
      }
    }

    require(
      boardingMembersProportion <= MAX_BASIS_POINT,
      "LibPJManager: proportion is out of range"
    );
    if (boardingMembersProportion < MAX_BASIS_POINT) {
      require(
        businessOwnersShareExists,
        "LibPJManager: businessOwners share should exist unless proportion is MAX_BASIS_POINT"
      );
    } else {
      require(
        !businessOwnersShareExists,
        "LibPJManager: proportion should be less than MAX_BASIS_POINT or businessOwners share should not exist"
      );
    }
  }
}
