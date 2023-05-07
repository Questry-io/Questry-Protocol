// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";
import {LibPJManager} from "../library/LibPJManager.sol";
import {QuestryPlatform} from "../platform/QuestryPlatform.sol";

contract ContributionPool is IContributionPool, AccessControl {
  using Counters for Counters.Counter;

  IContributionPool.MutationMode public immutable mode;
  mapping(address => bool) public incrementTermSigners;

  address public admin;
  address public contributionUpdater;
  address public incrementTermWhitelistAdmin;
  mapping(uint256 => mapping(address => uint120)) public contributions; // term => member => value
  Counters.Counter public term;

  constructor(
    QuestryPlatform _questryPlatform,
    IContributionPool.MutationMode _mode,
    address _contributionUpdater,
    address _incrementTermWhitelistAdmin,
    address _admin
  ) {
    mode = _mode;

    _setupRole(
      LibPJManager.POOL_INCREMENT_TERM_ROLE,
      address(_questryPlatform)
    );

    contributionUpdater = _contributionUpdater;
    _setupRole(
      LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE,
      contributionUpdater
    );

    incrementTermWhitelistAdmin = _incrementTermWhitelistAdmin;
    _setupRole(
      LibPJManager.POOL_INCREMENT_TERM_WHITELIST_ADMIN_ROLE,
      _incrementTermWhitelistAdmin
    );

    admin = _admin;
    _setRoleAdmin(
      LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE,
      LibPJManager.POOL_ADMIN_ROLE
    );
    _setRoleAdmin(
      LibPJManager.POOL_INCREMENT_TERM_WHITELIST_ADMIN_ROLE,
      LibPJManager.POOL_ADMIN_ROLE
    );
    _setupRole(LibPJManager.POOL_ADMIN_ROLE, admin);
    _setupRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE, admin);
    _setupRole(LibPJManager.POOL_INCREMENT_TERM_WHITELIST_ADMIN_ROLE, admin);
  }

  /// @inheritdoc IContributionPool
  function addContribution(address _member, uint120 _value)
    external
    onlyRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE)
  {
    _addContribution(_member, _value);
    emit AddContribution(_member, _value);
  }

  /// @inheritdoc IContributionPool
  function bulkAddContribution(
    address[] calldata _members,
    uint120[] calldata _values
  ) external onlyRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE) {
    for (uint256 i = 0; i < _members.length; i++) {
      _addContribution(_members[i], _values[i]);
    }
    emit BulkAddContribution(_members, _values);
  }

  /// @inheritdoc IContributionPool
  function subtractContribution(address _member, uint120 _value)
    external
    onlyRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE)
  {
    require(
      mode == IContributionPool.MutationMode.FullControl,
      "ContributionPool: operation not allowed"
    );
    _subtractContribution(_member, _value);
    emit SubtractContribution(_member, _value);
  }

  /// @inheritdoc IContributionPool
  function bulkSubtractContribution(
    address[] calldata _members,
    uint120[] calldata _values
  ) external onlyRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE) {
    require(
      mode == IContributionPool.MutationMode.FullControl,
      "ContributionPool: operation not allowed"
    );
    for (uint256 i = 0; i < _members.length; i++) {
      _subtractContribution(_members[i], _values[i]);
    }
    emit BulkSubtractContribution(_members, _values);
  }

  /// @inheritdoc IContributionPool
  function setContribution(address _member, uint120 _value)
    external
    onlyRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE)
  {
    require(
      mode == IContributionPool.MutationMode.FullControl,
      "ContributionPool: operation not allowed"
    );
    _setContribution(_member, _value);
    emit SetContribution(_member, _value);
  }

  /// @inheritdoc IContributionPool
  function bulkSetContribution(
    address[] calldata _members,
    uint120[] calldata _values
  ) external onlyRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE) {
    require(
      mode == IContributionPool.MutationMode.FullControl,
      "ContributionPool: operation not allowed"
    );
    for (uint256 i = 0; i < _members.length; i++) {
      _setContribution(_members[i], _values[i]);
    }
    emit BulkSetContribution(_members, _values);
  }

  /// @inheritdoc IContributionPool
  function incrementTerm(address _permittedSigner)
    external
    onlyRole(LibPJManager.POOL_INCREMENT_TERM_ROLE)
  {
    require(
      incrementTermSigners[_permittedSigner],
      "ContributionPool: operation not allowed"
    );
    term.increment();
  }

  /**
   * @dev Grants increment term role to signer.
   */
  function grantIncrementTermRole(address _signer)
    external
    onlyRole(LibPJManager.POOL_INCREMENT_TERM_WHITELIST_ADMIN_ROLE)
  {
    require(
      !incrementTermSigners[_signer],
      "ContributionPool: signer already exists"
    );
    incrementTermSigners[_signer] = true;
  }

  /**
   * @dev Revokes increment term role to signer.
   */
  function revokeIncrementTermRole(address _signer)
    external
    onlyRole(LibPJManager.POOL_INCREMENT_TERM_WHITELIST_ADMIN_ROLE)
  {
    require(
      incrementTermSigners[_signer],
      "ContributionPool: signer doesn't exist"
    );
    incrementTermSigners[_signer] = false;
  }

  /// @inheritdoc IContributionPool
  function getContribution(address _member) external view returns (uint120) {
    return contributions[term.current()][_member];
  }

  /// @inheritdoc IContributionPool
  function getTerm() external view returns (uint256) {
    return term.current();
  }

  function _addContribution(address _member, uint120 _value) private {
    contributions[term.current()][_member] += _value;
  }

  function _subtractContribution(address _member, uint120 _value) private {
    contributions[term.current()][_member] -= _value;
  }

  function _setContribution(address _member, uint120 _value) private {
    contributions[term.current()][_member] = _value;
  }
}
