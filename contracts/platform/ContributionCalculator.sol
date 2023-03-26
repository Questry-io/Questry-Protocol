// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";
import {IContributionCalculator} from "../interface/platform/IContributionCalculator.sol";

/**
 * @dev Implementation of ContributionCalculator.
 * Calculates the allocated shares to a particular board for boarding members.
 */
contract ContributionCalculator is
  IContributionCalculator,
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable
{
  bytes4 public constant LINEAR_ALGORITHM = bytes4(keccak256("LINEAR"));

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize() public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();
  }

  /// @inheritdoc UUPSUpgradeable
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  /// @inheritdoc IContributionCalculator
  function calculateDispatch(
    address[] memory members,
    CalculateDispatchArgs memory calculateArgs
  )
    external
    view
    returns (SharesResult memory result)
  {
    if (calculateArgs.algorithm == LINEAR_ALGORITHM) {
      result = calculateSharesWithLinear(
        members,
        abi.decode(calculateArgs.args, (IContributionCalculator.SharesWithLinearArgs))
      );
    } else {
      revert ("Calculator: unknown algorithm");
    }
  }

  /// @inheritdoc IContributionCalculator
  function calculateSharesWithLinear(
    address[] memory members,
    IContributionCalculator.SharesWithLinearArgs memory args
  )
    public
    view
    virtual
    returns (IContributionCalculator.SharesResult memory result)
  {
    result.shares = new uint120[](members.length);
    for (uint memberIdx = 0; memberIdx < members.length; memberIdx++) {
      for (uint poolIdx = 0; poolIdx < args.pools.length; poolIdx++) {
        IContributionPool c = IContributionPool(args.pools[poolIdx]);
        uint120 value = args.coefs[poolIdx] * c.getContribution(members[memberIdx]);
        result.shares[memberIdx] += value;
        result.totalShare += value;
      }
    }
  }
}
