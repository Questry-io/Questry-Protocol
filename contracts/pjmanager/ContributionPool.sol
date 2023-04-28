// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";
import {LibPJManager} from "../library/LibPJManager.sol";
import {QuestryPlatform} from "../platform/QuestryPlatform.sol";

contract ContributionPool is IContributionPool, AccessControl {
  using Counters for Counters.Counter;

  IContributionPool.MutationMode immutable public mode;
  mapping (address => bool) public incrementTermSigners;

  address public admin;
  address public contributionUpdater;
  address public incrementTermWhitelistAdmin;
  mapping (uint256 => mapping (address => uint120)) public contributions; // term => member => value
  Counters.Counter public term;

  constructor(
    QuestryPlatform _questryPlatform,
    IContributionPool.MutationMode _mode,
    address _contributionUpdater,
    address _incrementTermWhitelistAdmin,
    address _admin
  ) {
    mode = _mode;

    _setupRole(LibPJManager.POOL_INCREMENT_TERM_ROLE, address(_questryPlatform));

    contributionUpdater = _contributionUpdater;
    _setupRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE, contributionUpdater);

    incrementTermWhitelistAdmin = _incrementTermWhitelistAdmin;
    _setupRole(LibPJManager.POOL_INCREMENT_TERM_WHITELIST_ADMIN_ROLE, _incrementTermWhitelistAdmin);

    admin = _admin;
    _setRoleAdmin(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE, LibPJManager.POOL_ADMIN_ROLE);
    _setRoleAdmin(LibPJManager.POOL_INCREMENT_TERM_WHITELIST_ADMIN_ROLE, LibPJManager.POOL_ADMIN_ROLE);
    _setupRole(LibPJManager.POOL_ADMIN_ROLE, admin);
    _setupRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE, admin);
    _setupRole(LibPJManager.POOL_INCREMENT_TERM_WHITELIST_ADMIN_ROLE, admin);
  }

  /// @inheritdoc IContributionPool
  function addContribution(address member, uint120 value)
    external
    onlyRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE)
  {
    _addContribution(member, value);
    emit AddContribution(member, value);
  }

  /// @inheritdoc IContributionPool
  function bulkAddContribution(address[] calldata members, uint120[] calldata values)
    external
    onlyRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE)
  {
    for (uint i = 0; i < members.length; i++) {
      _addContribution(members[i], values[i]);
    }
    emit BulkAddContribution(members, values);
  }

  /// @inheritdoc IContributionPool
  function subtractContribution(address member, uint120 value)
    external
    onlyRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE)
  {
    require (mode == IContributionPool.MutationMode.FullControl, "ContributionPool: operation not allowed");
    _subtractContribution(member, value);
    emit SubtractContribution(member, value);
  }

  /// @inheritdoc IContributionPool
  function bulkSubtractContribution(address[] calldata members, uint120[] calldata values)
    external
    onlyRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE)
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
    onlyRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE)
  {
    require (mode == IContributionPool.MutationMode.FullControl, "ContributionPool: operation not allowed");
    _setContribution(member, value);
    emit SetContribution(member, value);
  }

  /// @inheritdoc IContributionPool
  function bulkSetContribution(address[] calldata members, uint120[] calldata values)
    external
    onlyRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE)
  {
    require (mode == IContributionPool.MutationMode.FullControl, "ContributionPool: operation not allowed");
    for (uint i = 0; i < members.length; i++) {
      _setContribution(members[i], values[i]);
    }
    emit BulkSetContribution(members, values);
  }

  /// @inheritdoc IContributionPool
  function incrementTerm(address permittedSigner)
    external
    onlyRole(LibPJManager.POOL_INCREMENT_TERM_ROLE)
  {
    require(incrementTermSigners[permittedSigner], "ContributionPool: operation not allowed");
    term.increment();
  }

  /**
   * @dev Grants increment term role to signer.
   */
  function grantIncrementTermRole(address signer)
    external
    onlyRole(LibPJManager.POOL_INCREMENT_TERM_WHITELIST_ADMIN_ROLE)
  {
    require(!incrementTermSigners[signer], "ContributionPool: signer already exists");
    incrementTermSigners[signer] = true;
  }

  /**
   * @dev Revokes increment term role to signer.
   */
  function revokeIncrementTermRole(address signer)
    external
    onlyRole(LibPJManager.POOL_INCREMENT_TERM_WHITELIST_ADMIN_ROLE)
  {
    require(incrementTermSigners[signer], "ContributionPool: signer doesn't exist");
    incrementTermSigners[signer] = false;
  }

  /// @inheritdoc IContributionPool
  function getContribution(address member)
    external
    view
    returns (uint120)
  {
    return contributions[term.current()][member];
  }

  /// @inheritdoc IContributionPool
  function getTerm() external view returns (uint256) {
    return term.current();
  }

  function _addContribution(address member, uint120 value)
    private
  {
    contributions[term.current()][member] += value;
  }

  function _subtractContribution(address member, uint120 value)
    private
  {
    contributions[term.current()][member] -= value;
  }

  function _setContribution(address member, uint120 value)
    private
  {
    contributions[term.current()][member] = value;
  }
}
