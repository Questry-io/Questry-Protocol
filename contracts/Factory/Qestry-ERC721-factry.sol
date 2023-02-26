// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

//Customeしてください

import { NFT, AccessControl } from "../token/questry-ERC721/NFT.sol";

contract Factory is AccessControl {

    event ERC721Created(address contractAddress, string name, string symbol, address indexed admin);
    
    bytes32 public constant REGISTER_ROLE = keccak256("REGISTER_ROLE");

    constructor(
        address admin
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
    }
    // Mapping from name and symbol to basic ERC721 address
    mapping(string => mapping(string => address)) public getERC721address;

    address private _TrustedForwarder;

    function createERC721(
        string calldata _name, 
        string calldata _symbol,
        string memory _defaultURI,
        address _admin
        ) external returns (address basicERC721) {
        require(getERC721address[_name][_symbol] == address(0), "Factory: must use another name and symbol");

        bytes32 _salt = keccak256(abi.encodePacked(_name, _symbol));
        address erc721 = address(new NFT{salt: _salt}(_name, _symbol, _defaultURI, _admin, _TrustedForwarder));

        getERC721address[_name][_symbol] = erc721;
        emit ERC721Created(basicERC721, _name, _symbol, _admin);
    }
    //Same _name & _symbol let be override
    function getContractAddress(string calldata _name,string calldata _symbol) public view returns (address) {
        return getERC721address[_name][_symbol];
    }


}