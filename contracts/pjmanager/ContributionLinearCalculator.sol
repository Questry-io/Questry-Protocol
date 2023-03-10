// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";
import {IContributionCalculator} from "../interface/pjmanager/IContributionCalculator.sol";

contract ContributionLinearCalculator is IContributionCalculator {
  IContributionPool[] public pools;
  uint120[] public coefs;

  constructor(IContributionPool[] memory _pools, uint120[] memory _coefs) {
    require(_pools.length == _coefs.length, "CLC: mismatch array length");
    pools = _pools;
    coefs = _coefs;
  }

  /// @inheritdoc IContributionCalculator
  function getContribution(address member)
    external
    view
    returns (uint120)
  {
    uint120 total = 0;
    for (uint i = 0; i < pools.length; i++) {
      IContributionPool c = IContributionPool(pools[i]);
      total += coefs[i] * c.getContribution(member);
    }
    return total;
  }
}
