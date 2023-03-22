// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IContributionPool} from "../pjmanager/IContributionPool.sol";

interface IContributionCalculator {
  // TODO: Libaryに整理する
  struct SharesResult {
    uint120[] shares;
    uint120 totalShare;
  }

  struct SharesWithLinearArgs {
    IContributionPool[] pools;
    uint120[] coefs;
    address[] members;
  }

  /**
   * @dev Calculates the allocated shares using a linear algorithm.
   */
  function calculateSharesWithLinear(
    SharesWithLinearArgs calldata args
  )
    external
    view
    returns (SharesResult memory result);
}
