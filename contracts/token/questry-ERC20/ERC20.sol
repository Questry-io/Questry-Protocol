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
  // ERC20 token that can be depositted
  IERC20 private _deposittedToken;
  // the amount of _deposittedToken that user depositted
  mapping(address => uint256) private _deposits;

  event Deposited(address indexed payee, uint256 amount);
  event Withdrawn(address indexed payee, uint256 amount);
  event Migrated(address indexed to, uint256 amount);

  constructor(
    MinimalForwarder _forwarder,
    address _admin,
    address _issuer,
    address _token
  ) ERC20("QST", "QuestryERC20") ERC2771Context(address(_forwarder)) {
    _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    _grantRole(ISSUER_ROLE, _issuer);
    _deposittedToken = IERC20(_token);
  }

  function _isExpired() internal view returns (bool) {
    return block.timestamp > expiryTime;
  }

  function mint(address _to, uint256 _amount) public onlyRole(ISSUER_ROLE) {
    require(remintableCount > 0, "you cannot issue token anymore");
    remintableCount -= 1;
    _mint(_to, _amount);
  }

  function _reset() private {
    expiryTime = block.timestamp + 180 days;
    remintableCount = 2;
  }

  function selfMint(uint256 _amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
    require(_isExpired(), "Token migration not allowed yet.");
    require(balanceOf(address(this)) == 0, "must burn all before self mint");
    _reset();
    _mint(address(this), _amount);
  }

  function migrate(address _to, uint256 _amount)
    public
    onlyRole(DEFAULT_ADMIN_ROLE)
  {
    require(_isExpired(), "Token migration not allowed yet.");
    _burn(_to, _amount);
    _withdraw(_to, _deposits[_to]);
    emit Migrated(_to, _amount);
  }

  function deposit(uint256 _amount) public {
    _deposits[_msgSender()] += _amount;
    _deposittedToken.safeTransferFrom(_msgSender(), address(this), _amount);
    emit Deposited(_msgSender(), _amount);
  }

  function _withdraw(address _to, uint256 _amount) private {
    _deposittedToken.safeTransferFrom(address(this), _to, _amount);
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

  function depositsOf(address _payee) public view returns (uint256) {
    return _deposits[_payee];
  }
}
