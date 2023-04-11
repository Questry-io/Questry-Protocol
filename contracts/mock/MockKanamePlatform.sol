// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IPJTreasuryPool} from "../interface/pjmanager/IPJTreasuryPool.sol";
import {KanamePlatform} from "../platform/KanamePlatform.sol";

contract MockKanamePlatform is KanamePlatform {
  constructor(address daoTreasuryPool) KanamePlatform(daoTreasuryPool) {}

  function allocate(AllocateArgs calldata args)
    external
  {
    IPJTreasuryPool(args.pjManager).allocate(args);
  }
}
