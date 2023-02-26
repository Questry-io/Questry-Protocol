// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

//こちらのコントラクトを改造してプロトコルのコントラクトにしていく

import { SBT, AccessControl } from "../token/soulboaund/Soulbound.sol";

contract Factory is AccessControl {

    event SBTCreated(address contractAddress, string name, string symbol, address indexed admin);
    
    bytes32 public constant REGISTER_ROLE = keccak256("REGISTER_ROLE");

    constructor(
        address admin
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
    }
    // Mapping from name and symbol to basic ERC721 address
    mapping(string => mapping(string => address)) public getSBTaddress;

    address private _TrustedForwarder;

    function createSBT(
        string calldata _name, 
        string calldata _symbol,
        string memory _defaultURI,
        address _admin
        ) external returns (address basicERC721) {
        require(getSBTaddress[_name][_symbol] == address(0), "Factory: must use another name and symbol");

        bytes32 _salt = keccak256(abi.encodePacked(_name, _symbol));
        address sbt = address(new SBT{salt: _salt}(_name, _symbol, _defaultURI, _admin, _TrustedForwarder));

        getSBTaddress[_name][_symbol] = sbt;
        emit SBTCreated(basicERC721, _name, _symbol, _admin);
    }
    //Same _name & _symbol let be override
    function getContractAddress(string calldata _name,string calldata _symbol) public view returns (address) {
        return getSBTaddress[_name][_symbol];
    }

    function setChildTrustedforwarder(address ForwarderAddress) public {
        require(hasRole(REGISTER_ROLE,_msgSender()),"Factory: must have register role to Regiter");
        _setChildTrusedForwarder(ForwarderAddress);
    }

    function _setChildTrusedForwarder(address ForwarderAddress) internal {
        _TrustedForwarder = ForwarderAddress;
    }

    function getChildTrustedforwarder() public view returns (address) {
        return _TrustedForwarder;
    }

}