// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IContributionPool} from "../pjmanager/IContributionPool.sol";
import {LibQuestryPlatform} from "../../library/LibQuestryPlatform.sol";

interface IContributionCalculator {
  /**
   * @dev Dispatches the calculation of the allocated shares.
   */
  function calculateDispatch(
    address[] calldata _members,
    LibQuestryPlatform.CalculateDispatchArgs memory _args
  ) external view returns (LibQuestryPlatform.SharesResult memory result);

  /**
   * @dev Calculates the allocated shares using a linear algorithm.
   */
  function calculateSharesWithLinear(
    address[] calldata _members,
    LibQuestryPlatform.SharesWithLinearArgs memory _args
  ) external view returns (LibQuestryPlatform.SharesResult memory result);
}
