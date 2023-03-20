// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/metatx/MinimalForwarder.sol";

contract QuestryERC20 is
  ERC20,
  ERC20Burnable,
  Pausable,
  AccessControl,
  ERC2771Context
{
  using SafeERC20 for IERC20;
  bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
  uint256 public expiryTime;
  // remintable count for 180 days term
  uint256 public remintableCount = 2;

  event Withdrawn(address indexed payee, uint256 amount);
  event Migrated(address indexed to, uint256 amount);

  constructor(
    MinimalForwarder _forwarder,
    address _admin,
    address _issuer
  ) ERC20("QST", "QuestryERC20") ERC2771Context(address(_forwarder)) {
    _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    _grantRole(ISSUER_ROLE, _issuer);
  }

  function _isExpired() internal view returns (bool) {
    return block.timestamp > expiryTime;
  }

  function _reset() private {
    expiryTime = block.timestamp + 180 days;
    remintableCount = 2;
  }

  function selfMint(uint256 _amount) public onlyRole(ISSUER_ROLE) {
    if (_isExpired()) {
      require(balanceOf(address(this)) == 0, "must burn all before self mint");
      _reset();
      _burn(msg.sender, balanceOf(address(this)));
    }
    require(remintableCount > 0, "you cannot issue token anymore");
    remintableCount -= 1;
    _mint(address(this), _amount);
  }

  function migrate(address _to, uint256 _amount)
    public
    onlyRole(DEFAULT_ADMIN_ROLE)
  {
    require(_isExpired(), "Token migration not allowed yet.");
    _burn(_to, _amount);
    withdraw(_to, _amount);
    emit Migrated(_to, _amount);
  }

  function withdraw(address _to, uint256 _amount) public {
    IERC20(this).safeTransfer(_to, _amount);
    emit Withdrawn(_to, _amount);
  }

  function _msgSender()
    internal
    view
    override(Context, ERC2771Context)
    returns (address sender)
  {
    sender = ERC2771Context._msgSender();
  }

  function _msgData()
    internal
    view
    override(Context, ERC2771Context)
    returns (bytes calldata)
  {
    return ERC2771Context._msgData();
  }

  function isTrustedForwarder(address _forwarder)
    public
    view
    override
    returns (bool)
  {
    return ERC2771Context.isTrustedForwarder(_forwarder);
  }

  function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
  }

  function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
  }

  function _beforeTokenTransfer(
    address _from,
    address _to,
    uint256 _amount
  ) internal override whenNotPaused {
    super._beforeTokenTransfer(_from, _to, _amount);
  }
}
