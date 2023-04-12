// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IQuestryPlatform} from "../interface/platform/IQuestryPlatform.sol";

contract QuestryPlatform is IQuestryPlatform {
  uint32 public constant PROTOCOL_FEE_RATE = 300;

  address public daoTreasuryPool;

  constructor(address _daoTreasuryPool) {
    daoTreasuryPool = _daoTreasuryPool;
  }

  /// @inheritdoc IQuestryPlatform
  function getDAOTreasuryPool()
    external
    view
    returns (address)
  {
    return daoTreasuryPool;
  }

  /// @inheritdoc IQuestryPlatform
  function getProtocolFeeRate()
    external
    pure
    returns (uint32)
  {
    return PROTOCOL_FEE_RATE;
  }
}
