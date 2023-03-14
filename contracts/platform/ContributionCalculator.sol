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
  bytes32 public constant CONTRACT_UPGRADER_ROLE = keccak256("CONTRACT_UPGRADER_ROLE");

  address public admin;
  address public contractUpgrader;

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

  function calculateSharesWithLinear(
    IContributionCalculator.SharesWithLinearArgs calldata args
  )
    external
    view
    virtual
    returns (IContributionCalculator.SharesResult memory result)
  {
    result.shares = new uint120[](args.members.length);
    for (uint memberIdx = 0; memberIdx < args.members.length; memberIdx++) {
      for (uint poolIdx = 0; poolIdx < args.pools.length; poolIdx++) {
        IContributionPool c = IContributionPool(args.pools[poolIdx]);
        uint120 value = args.coefs[poolIdx] * c.getContribution(args.members[memberIdx]);
        result.shares[memberIdx] += value;
        result.totalShare += value;
      }
    }
  }
}
