// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {LibQuestryPlatform} from "../../library/LibQuestryPlatform.sol";

interface IQuestryPlatform {
  /**
   * @dev Allocates tokens to business owners, boarding members and DAO treasury pool.
   */
  function allocate(
    LibQuestryPlatform.AllocateArgs calldata _args, 
    bytes[] calldata _AllcatorSigns
  ) external;


}