// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IPJTreasuryPool} from "../interface/pjmanager/IPJTreasuryPool.sol";
import {QuestryPlatform} from "../platform/QuestryPlatform.sol";

contract MockQuestryPlatform is QuestryPlatform {
  constructor(address daoTreasuryPool) QuestryPlatform(daoTreasuryPool) {}

  function allocate(AllocateArgs calldata args)
    external
  {
    IPJTreasuryPool(args.pjManager).allocate(args);
  }
}
