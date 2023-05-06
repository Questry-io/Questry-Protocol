// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IPJManager} from "../pjmanager/IPJManager.sol";

interface IPJManagerFactory {
  /**
   * @dev Returns the admin of `_pjManager`.
   */
  function getPJManagerAdmin(IPJManager _pjManager) external view returns (address);
}
