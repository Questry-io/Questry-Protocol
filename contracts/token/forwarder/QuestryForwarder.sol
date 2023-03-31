// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/MinimalForwarderUpgradeable.sol";

contract QuestryForwader is
  Initializable,
  PausableUpgradeable,
  AccessControlUpgradeable,
  UUPSUpgradeable,
  MinimalForwarderUpgradeable
{
  bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

  event Deposit(address indexed sender, uint256 value);
  event Withdraw(address indexed sender, uint256 value);

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize() public initializer {
    __Pausable_init();
    __AccessControl_init();
    __UUPSUpgradeable_init();
    __MinimalForwarder_init();

    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _grantRole(EXECUTOR_ROLE, msg.sender);
  }

  function deposit() public payable onlyRole(EXECUTOR_ROLE) {
    require(
      msg.value > 0,
      "QuestryForwarder: deposit value must be greater than 0"
    );
    emit Deposit(msg.sender, msg.value);
  }

  function withdraw(address _executor, uint256 _amount)
    public
    payable
    onlyRole(EXECUTOR_ROLE)
  {
    require(
      _amount > 0,
      "QuestryForwarder: withdraw value must be greater than 0"
    );
    require(
      _amount <= address(this).balance,
      "QuestryForwarder: withdraw value must be less than balance"
    );
    payable(_executor).transfer(_amount);
    emit Withdraw(_executor, _amount);
  }

  function execute(
    address to,
    uint256 value,
    uint256 gasPrice,
    bytes calldata data
  )
    public
    payable
    onlyRole(EXECUTOR_ROLE)
    whenNotPaused
    returns (bool, bytes memory)
  {
    withdraw(msg.sender, gasPrice);
    (bool success, bytes memory returnData) = to.call{value: value}(data);
    if (!success) {
      revert("QuestryForwarder: execute reverted");
    }
    return (success, returnData);
  }

  function addExecutor(address executor) public onlyRole(DEFAULT_ADMIN_ROLE) {
    _grantRole(EXECUTOR_ROLE, executor);
  }

  function removeExecutor(address executor)
    public
    onlyRole(DEFAULT_ADMIN_ROLE)
  {
    _revokeRole(EXECUTOR_ROLE, executor);
  }

  function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
  }

  function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
  }

  function _authorizeUpgrade(address newImplementation)
    internal
    override
    onlyRole(DEFAULT_ADMIN_ROLE)
  {}
}
