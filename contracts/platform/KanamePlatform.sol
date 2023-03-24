// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IKanamePlatform} from "../interface/platform/IKanamePlatform.sol";

contract KanamePlatform is IKanamePlatform {
  uint32 public constant PROTOCOL_FEE_RATE = 300;

  address public daoTreasuryPool;

  constructor(address _daoTreasuryPool) {
    daoTreasuryPool = _daoTreasuryPool;
  }

  /// @inheritdoc IKanamePlatform
  function getDAOTreasuryPool()
    external
    view
    returns (address)
  {
    return daoTreasuryPool;
  }

  /// @inheritdoc IKanamePlatform
  function getProtocolFeeRate()
    external
    pure
    returns (uint32)
  {
    return PROTOCOL_FEE_RATE;
  }
}
