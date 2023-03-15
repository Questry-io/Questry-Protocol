// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/metatx/MinimalForwarder.sol";

contract QuestryERC20 is ERC20, ERC20Burnable, Pausable, AccessControl, ERC2771Context {
    constructor(MinimalForwarder forwarder) ERC20("QST", "QuestryERC20") ERC2771Context(address(forwarder)) {

    }

    function mint()public {

    }
    function burn()public {

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
    function pause()public {

    }
    function unpause()public{

    }
}