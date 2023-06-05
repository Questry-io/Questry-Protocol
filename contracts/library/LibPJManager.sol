// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @dev Library for PJManager. Defines constants, validations and create signatures.
 */
library LibPJManager {
  bytes32 public constant PJ_PLATFORM_EXCLUSIVE_ROLE =
    keccak256("PJ_PLATFORM_EXCLUSIVE_ROLE");
  bytes32 public constant PJ_BOARD_EXCLUSIVE_ROLE =
    keccak256("PJ_BOARD_EXCLUSIVE_ROLE");
  bytes32 public constant PJ_ADMIN_ROLE = keccak256("PJ_ADMIN_ROLE");
  bytes32 public constant PJ_MANAGEMENT_ROLE = keccak256("PJ_MANAGEMENT_ROLE");
  bytes32 public constant PJ_WHITELIST_ROLE = keccak256("PJ_WHITELIST_ROLE");
  bytes32 public constant PJ_VERIFY_SIGNER_ROLE = keccak256("PJ_VERIFY_SIGNER");

  bytes32 public constant POOL_ADMIN_ROLE = keccak256("POOL_ADMIN_ROLE");
  bytes32 public constant POOL_CONTRIBUTION_UPDATER_ROLE =
    keccak256("POOL_CONTRIBUTION_UPDATER_ROLE");
  bytes32 public constant POOL_VERIFY_SIGNER_ROLE =
    keccak256("POOL_VERIFY_SIGNER_ROLE");
}
