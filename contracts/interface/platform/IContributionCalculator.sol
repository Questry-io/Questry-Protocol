// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IContributionPool} from "../pjmanager/IContributionPool.sol";
import {LibQuestryPlatform} from "../../library/LibQuestryPlatform.sol";

interface IContributionCalculator {
  /**
   * @dev Dispatches the calculation of the allocated shares.
   */
  function calculateDispatch(
    address[] calldata members,
    LibQuestryPlatform.CalculateDispatchArgs memory args
  ) external view returns (LibQuestryPlatform.SharesResult memory result);

  /**
   * @dev Calculates the allocated shares using a linear algorithm.
   */
  function calculateSharesWithLinear(
    address[] calldata members,
    LibQuestryPlatform.SharesWithLinearArgs memory args
  ) external view returns (LibQuestryPlatform.SharesResult memory result);
}
