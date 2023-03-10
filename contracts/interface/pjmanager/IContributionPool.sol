// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IContributionPool {
  event AddContribution(address indexed member, uint120 value);
  event SetContribution(address indexed member, uint120 value);

  /**
   * @dev Adds `contribution` to `member`.
   *
   * Emits {AddContribution}
   */
  function addContribution(address member, uint120 value) external;

  /**
   * @dev Gets contribution of `member`.
   */
  function getContribution(address member) external view returns (uint120);
}
