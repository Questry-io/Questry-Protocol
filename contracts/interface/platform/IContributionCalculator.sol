// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IContributionPool} from "../pjmanager/IContributionPool.sol";

interface IContributionCalculator {
  // TODO: Libaryに整理する
  /**
   * @dev Result type of calculation functions.
   */
  struct SharesResult {
    uint120[] shares;
    uint120 totalShare;
  }

  /**
   * @dev Argments for linear allocation algorithm.
   */
  struct SharesWithLinearArgs {
    IContributionPool[] pools;
    uint120[] coefs;
  }

  /**
   * @dev Arguments for CalculteDispatch
   */
  struct CalculateDispatchArgs {
    bytes4 algorithm; // calculation algorithm for the board.
    bytes args;       // arguments for the calculation algorithm.
  }

  /**
   * @dev Dispatches the calculation of the allocated shares.
   */
  function calculateDispatch(address[] calldata members, CalculateDispatchArgs memory args)
    external
    view
    returns (SharesResult memory result);

  /**
   * @dev Calculates the allocated shares using a linear algorithm.
   */
  function calculateSharesWithLinear(address[] calldata members, SharesWithLinearArgs memory args)
    external
    view
    returns (SharesResult memory result);
}
