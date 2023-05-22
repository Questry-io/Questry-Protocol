// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @dev Library for PJManager. Defines constants, validations and create signatures.
 */
library LibPJManager {
  bytes32 public constant PJ_WITHDRAW_ROLE = keccak256("PJ_WITHDRAW_ROLE");
  bytes32 public constant PJ_BOARD_ID_ROLE = keccak256("PJ_BOARD_ID_ROLE");

  bytes32 public constant PJ_ADMIN_ROLE = keccak256("PJ_ADMIN_ROLE");
  bytes32 public constant PJ_MANAGEMENT_ROLE = keccak256("PJ_MANAGEMENT_ROLE");
  bytes32 public constant PJ_WHITELIST_ROLE = keccak256("PJ_WHITELIST_ROLE");
  bytes32 public constant PJ_DEPOSIT_ROLE = keccak256("PJ_DEPOSIT_ROLE");
  bytes32 public constant PJ_VERIFY_SIGNER_ROLE = keccak256("PJ_VERIFY_SIGNER");
  bytes32 public constant PJ_NONCE_INCREMENT_ROLE =
    keccak256("PJ_NONCE_INCREMENT_ROLE");

  bytes32 public constant POOL_INCREMENT_TERM_ROLE =
    keccak256("POOL_INCREMENT_TERM_ROLE");
  bytes32 public constant POOL_CONTRIBUTION_UPDATER_ROLE =
    keccak256("POOL_CONTRIBUTION_UPDATER_ROLE");
  bytes32 public constant POOL_INCREMENT_TERM_WHITELIST_ADMIN_ROLE =
    keccak256("POOL_INCREMENT_TERM_WHITELIST_ADMIN_ROLE");
  bytes32 public constant POOL_ADMIN_ROLE = keccak256("POOL_ADMIN_ROLE");

  /**
   * @dev Allocation share for target address.
   */
  struct AllocationShare {
    address recipient;
    uint120 share;
  }
}
