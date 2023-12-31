// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";
import {IContributionCalculator} from "../interface/platform/IContributionCalculator.sol";
import {IBoard} from "../interface/token/IBoard.sol";
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";

/**
 * @dev Implementation of ContributionCalculator.
 * Calculates the allocated shares to a particular board for boarding members.
 */
contract ContributionCalculator is
  IContributionCalculator,
  Initializable,
  AccessControlUpgradeable,
  UUPSUpgradeable
{
  bytes4 public constant LINEAR_ALGORITHM = bytes4(keccak256("LINEAR"));
  bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address _admin) public initializer {
    __AccessControl_init();
    __UUPSUpgradeable_init();
    _setupRole(DEFAULT_ADMIN_ROLE, _admin);
    _setupRole(UPGRADER_ROLE, _admin);
  }

  /// @inheritdoc UUPSUpgradeable
  function _authorizeUpgrade(address _newImplementation)
    internal
    override
    onlyRole(UPGRADER_ROLE)
  {}

  /// @inheritdoc IContributionCalculator
  function calculateDispatch(
    address[] memory _members,
    LibQuestryPlatform.CalculateDispatchArgs memory _calculateArgs
  ) external view returns (LibQuestryPlatform.SharesResult memory result) {
    if (_calculateArgs.algorithm == LINEAR_ALGORITHM) {
      result = calculateSharesWithLinear(
        _members,
        abi.decode(
          _calculateArgs.args,
          (LibQuestryPlatform.SharesWithLinearArgs)
        )
      );
    } else {
      revert("Calculator: unknown algorithm");
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
    for (uint256 memberIdx = 0; memberIdx < _members.length; memberIdx++) {
      for (uint256 boardIdx = 0; boardIdx < _args.boards.length; boardIdx++) {
        IBoard board = _args.boards[boardIdx];
        if (board.isBoardingMember(_members[memberIdx])) {
          IContributionPool c = board.getContributionPool();
          uint120 value = _args.coefs[boardIdx] *
            c.getContribution(_members[memberIdx]);
          result.shares[memberIdx] += value;
          result.totalShare += value;
        }
      }
    }
  }
}
