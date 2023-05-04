// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IPJManager} from "../pjmanager/IPJManager.sol";

interface IPJManagerFactory {
  /**
   * @dev Returns the admin of `pjManager`.
   */
  function getPJManagerAdmin(IPJManager pjManager) external view returns (address);
}
