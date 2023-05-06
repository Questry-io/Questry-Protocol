// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";
import {IContributionCalculator} from "../interface/platform/IContributionCalculator.sol";
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";

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
  function _authorizeUpgrade(address _newImplementation) internal override onlyOwner {}

  /// @inheritdoc IContributionCalculator
  function calculateDispatch(
    address[] memory _members,
    LibQuestryPlatform.CalculateDispatchArgs memory _calculateArgs
  )
    external
    view
    returns (LibQuestryPlatform.SharesResult memory result)
  {
    if (_calculateArgs.algorithm == LINEAR_ALGORITHM) {
      result = calculateSharesWithLinear(
        _members,
        abi.decode(_calculateArgs.args, (LibQuestryPlatform.SharesWithLinearArgs))
      );
    } else {
      revert ("Calculator: unknown algorithm");
    }
  }

  /// @inheritdoc IContributionCalculator
  function calculateSharesWithLinear(
    address[] memory _members,
    LibQuestryPlatform.SharesWithLinearArgs memory _args
  )
    public
    view
    virtual
    returns (LibQuestryPlatform.SharesResult memory result)
  {
    result.shares = new uint120[](_members.length);
    for (uint memberIdx = 0; memberIdx < _members.length; memberIdx++) {
      for (uint poolIdx = 0; poolIdx < _args.pools.length; poolIdx++) {
        IContributionPool c = IContributionPool(_args.pools[poolIdx]);
        uint120 value = _args.coefs[poolIdx] * c.getContribution(_members[memberIdx]);
        result.shares[memberIdx] += value;
        result.totalShare += value;
      }
    }
  }
}
