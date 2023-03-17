// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";

contract ContributionPool is IContributionPool, AccessControl {
  bytes32 public constant CONTRIBUTION_UPDATER_ROLE = keccak256("CONTRIBUTION_UPDATER_ROLE");

  IContributionPool.MutationMode immutable public mode;

  address public admin;
  address public contributionUpdater;
  mapping (uint64 => mapping (address => uint120)) public contributions; // globalTerm => member => value

  constructor(IContributionPool.MutationMode _mode, address _contributionUpdater, address _admin) {
    mode = _mode;

    contributionUpdater = _contributionUpdater;
    _setupRole(CONTRIBUTION_UPDATER_ROLE, contributionUpdater);

    admin = _admin;
    _setupRole(DEFAULT_ADMIN_ROLE, admin);
    _setupRole(CONTRIBUTION_UPDATER_ROLE, admin);
  }

  /// @inheritdoc IContributionPool
  function addContribution(address member, uint120 value)
    external
    onlyRole(CONTRIBUTION_UPDATER_ROLE)
  {
    _addContribution(member, value);
    emit AddContribution(member, value);
  }

  /// @inheritdoc IContributionPool
  function bulkAddContribution(address[] calldata members, uint120[] calldata values)
    external
    onlyRole(CONTRIBUTION_UPDATER_ROLE)
  {
    for (uint i = 0; i < members.length; i++) {
      _addContribution(members[i], values[i]);
    }
    emit BulkAddContribution(members, values);
  }

  /// @inheritdoc IContributionPool
  function subtractContribution(address member, uint120 value)
    external
    onlyRole(CONTRIBUTION_UPDATER_ROLE)
  {
    require (mode == IContributionPool.MutationMode.FullControl, "ContributionPool: operation not allowed");
    _subtractContribution(member, value);
    emit SubtractContribution(member, value);
  }

  /// @inheritdoc IContributionPool
  function bulkSubtractContribution(address[] calldata members, uint120[] calldata values)
    external
    onlyRole(CONTRIBUTION_UPDATER_ROLE)
  {
    require (mode == IContributionPool.MutationMode.FullControl, "ContributionPool: operation not allowed");
    for (uint i = 0; i < members.length; i++) {
      _subtractContribution(members[i], values[i]);
    }
    emit BulkSubtractContribution(members, values);
  }

  /// @inheritdoc IContributionPool
  function setContribution(address member, uint120 value)
    external
    onlyRole(CONTRIBUTION_UPDATER_ROLE)
  {
    require (mode == IContributionPool.MutationMode.FullControl, "ContributionPool: operation not allowed");
    _setContribution(member, value);
    emit SetContribution(member, value);
  }

  /// @inheritdoc IContributionPool
  function bulkSetContribution(address[] calldata members, uint120[] calldata values)
    external
    onlyRole(CONTRIBUTION_UPDATER_ROLE)
  {
    require (mode == IContributionPool.MutationMode.FullControl, "ContributionPool: operation not allowed");
    for (uint i = 0; i < members.length; i++) {
      _setContribution(members[i], values[i]);
    }
    emit BulkSetContribution(members, values);
  }

  /// @inheritdoc IContributionPool
  function getContribution(address member)
    external
    view
    returns (uint120)
  {
    return contributions[_globalTerm()][member];
  }

  function _addContribution(address member, uint120 value)
    private
  {
    contributions[_globalTerm()][member] += value;
  }

  function _subtractContribution(address member, uint120 value)
    private
  {
    contributions[_globalTerm()][member] -= value;
  }

  function _setContribution(address member, uint120 value)
    private
  {
    contributions[_globalTerm()][member] = value;
  }

  function _globalTerm() private pure returns (uint64) {
    return 0; // TODO: 精算後にグローバルにincrementされる値
  }
}
