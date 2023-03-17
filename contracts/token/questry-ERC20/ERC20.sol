// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/metatx/MinimalForwarder.sol";

contract QuestryERC20 is ERC20, ERC20Burnable, Pausable, AccessControl, ERC2771Context {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    uint256 public mintTime;

    constructor(MinimalForwarder forwarder, address admin, address issuer) ERC20("QST", "QuestryERC20") ERC2771Context(address(forwarder)) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, issuer);
    }

    modifier isBurnable(){
        require(isExpired() && (hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) || hasRole(ISSUER_ROLE, _msgSender())), "token not expired or invalid role");
        _;
    }

    function isExpired() internal view returns(bool){
        return block.timestamp > (mintTime + 180 days);
    }

    function mint(address to, uint256 amount)public onlyRole(ISSUER_ROLE) {
        _mint(to, amount);
        mintTime = block.timestamp;
    }

    function burn(uint256 amount)public override isBurnable() {
        burn(amount);
    }

    function _msgSender() internal view override (Context, ERC2771Context) returns (address sender) {
        sender = ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function isTrustedForwarder(address forwarder) public view override returns (bool) {
        return ERC2771Context.isTrustedForwarder(forwarder);
    }

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        override
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}