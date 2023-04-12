// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPJManager} from "../pjmanager/IPJManager.sol";
import {IContributionCalculator} from "../platform/IContributionCalculator.sol";
import {IQuestryPlatform} from "../platform/IQuestryPlatform.sol";
import {ISBT} from "../token/ISBT.sol";

interface IQuestryPlatform {
  /**
   * @dev Returns the DAO treasury pool.
   */
  function getDAOTreasuryPool()
    external
    view
    returns (address);

  /**
   * @dev Returns the basis points of the fees deducted from the PJTreasuryPool
   * and allocated to the DAOTreasuryPool.
   */
  function getProtocolFeeRate()
    external
    pure
    returns (uint32);
}
