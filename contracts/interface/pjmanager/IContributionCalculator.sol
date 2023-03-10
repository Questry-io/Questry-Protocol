// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IContributionCalculator {
  /**
   * @dev Gets contribution of `member`.
   */
  function getContribution(address member) external view returns (uint120);
}
