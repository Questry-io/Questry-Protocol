// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";
import {LibPJManager} from "../library/LibPJManager.sol";
import {IQuestryPlatform} from "../interface/platform/IQuestryPlatform.sol";

contract ContributionPool is IContributionPool, AccessControl {
  using Counters for Counters.Counter;

  uint256 public constant DEFAULT_THRESHOLD = 1;
  IContributionPool.MutationMode public immutable mode;
  uint256 public threshold;
  mapping(uint256 => mapping(address => uint120)) public contributions; // term => member => value
  Counters.Counter public term;

  constructor(
    IQuestryPlatform _questryPlatform,
    IContributionPool.MutationMode _mode,
    address _contributionUpdater,
    address _admin
  ) {
    mode = _mode;
    _setThreshold(DEFAULT_THRESHOLD);

    _setupRole(
      LibPJManager.PJ_PLATFORM_EXCLUSIVE_ROLE,
      address(_questryPlatform)
    );

    _setupRole(
      LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE,
      _contributionUpdater
    );

    _setupRole(LibPJManager.POOL_ADMIN_ROLE, _admin);
    _setupRole(LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE, _admin);
    _setRoleAdmin(
      LibPJManager.POOL_CONTRIBUTION_UPDATER_ROLE,
      LibPJManager.POOL_ADMIN_ROLE
    );
    _setRoleAdmin(
      LibPJManager.POOL_VERIFY_SIGNER_ROLE,
      LibPJManager.POOL_ADMIN_ROLE
    );
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
  function incrementTerm(address[] memory _verifiedSigners)
    external
    onlyRole(LibPJManager.PJ_PLATFORM_EXCLUSIVE_ROLE)
  {
    uint8 verifiedCount = 0;
    for (uint256 i = 0; i < _verifiedSigners.length; i++) {
      if (_isIncrementTermSigner(_verifiedSigners[i])) {
        verifiedCount++;
      }
    }
    require(
      verifiedCount >= _getThreshold(),
      "ContributionPool: insufficient whitelisted signers"
    );
    term.increment();
  }

  /**
   * @dev Sets the threshold for increment term.
   */
  function setThreshold(uint256 _threshold)
    external
    onlyRole(LibPJManager.POOL_ADMIN_ROLE)
  {
    _setThreshold(_threshold);
  }

  /// @inheritdoc IContributionPool
  function getContribution(address _member) external view returns (uint120) {
    return contributions[term.current()][_member];
  }

  /// @inheritdoc IContributionPool
  function getTerm() external view returns (uint256) {
    return term.current();
  }

  /**
   * @dev Returns whether the `_account` is in the increment term whitelist.
   */
  function isIncrementTermSigner(address _account)
    external
    view
    returns (bool)
  {
    return _isIncrementTermSigner(_account);
  }

  /**
   * @dev Returns the threshold for increment term.
   */
  function getThreshold() external view returns (uint256) {
    return _getThreshold();
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

  function _setThreshold(uint256 _threshold) private {
    threshold = _threshold;
  }

  function _getThreshold() private view returns (uint256) {
    return threshold;
  }

  function _isIncrementTermSigner(address _account)
    private
    view
    returns (bool)
  {
    return
      hasRole(LibPJManager.POOL_VERIFY_SIGNER_ROLE, _account) ||
      hasRole(LibPJManager.POOL_ADMIN_ROLE, _account);
  }
}
