// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IContributionPool {
  event AddContribution(address indexed member, uint120 value);
  event BulkAddContribution(address[] members, uint120[] values);
  event SubtractContribution(address indexed member, uint120 value);
  event BulkSubtractContribution(address[] members, uint120[] values);
  event SetContribution(address indexed member, uint120 value);
  event BulkSetContribution(address[] members, uint120[] values);

  /**
   * @dev Restrictions for contribution state mutations.
   * Anyone can never subtract boarding members' contributions if mode is AddOnlyAccess.
   */
  enum MutationMode {
    AddOnlyAccess,  // Only `addContribution`, `bulkAddContribution` operations allowed.
    FullControl     // All operations allowed.
  }

  /**
   * @dev Adds `contribution` to `member`.
   *
   * Emits {AddContribution}
   */
  function addContribution(address member, uint120 value) external;

  /**
   * @dev Bulk adds `contributions` to `members`.
   *
   * Emits {BulkAddContribution}
   */
  function bulkAddContribution(address[] calldata members, uint120[] calldata values) external;

  /**
   * @dev Subtracts `contribution` from `member`.
   *
   * Emits {SubtractContribution}
   */
  function subtractContribution(address member, uint120 value) external;

  /**
   * @dev Bulk subtracts `contributions` from `members`.
   *
   * Emits {BulkSubtractContribution}
   */
  function bulkSubtractContribution(address[] calldata members, uint120[] calldata values) external;

  /**
   * @dev Sets `contribution` to `member`.
   *
   * Emits {SetContribution}
   */
  function setContribution(address member, uint120 value) external;

  /**
   * @dev Bulk sets `contributions` to `members`.
   *
   * Emits {BulkSetContribution}
   */
  function bulkSetContribution(address[] calldata members, uint120[] calldata values) external;

  /**
   * @dev Increments the accumulation period for contributions by checking if the `permittedSigner`
   * has the execution permission.
   */
  function incrementTerm(address permittedSigner) external;

  /**
   * @dev Gets contribution of `member`.
   */
  function getContribution(address member) external view returns (uint120);

  /**
   * @dev Returns the accumulation period for contributions.
   */
  function getTerm() external view returns (uint256);
}
