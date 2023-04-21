// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {SBT, AccessControl} from "../token/soulbound/SBT.sol";

contract SBTFactory is AccessControl {
  event SBTCreated(
    address contractAddress,
    string name,
    string symbol,
    address indexed pjmanager,
    address indexed admin
  );

  bytes32 public constant SET_FORWARDER_ROLE = keccak256("SET_FORWARDER_ROLE");

  constructor(address admin) {
    _setupRole(DEFAULT_ADMIN_ROLE, admin);
    _setupRole(SET_FORWARDER_ROLE, admin);
  }

  // Mapping from name and symbol to basic ERC721 address
  mapping(string => mapping(string => address)) public getSBTaddress;

  address private _TrustedForwarder;

  function createSBT(
    string calldata _name,
    string calldata _symbol,
    string memory _baseTokenURI,
    address _pjmanager,
    address _admin
  ) external returns (address sbt) {
    require(
      getSBTaddress[_name][_symbol] == address(0),
      "SBTFactory: must use another name and symbol"
    );

    bytes32 _salt = keccak256(abi.encodePacked(_name, _symbol));
    sbt = address(
      new SBT{salt: _salt}(
        _name,
        _symbol,
        _baseTokenURI,
        _pjmanager,
        _admin,
        _TrustedForwarder
      )
    );

    getSBTaddress[_name][_symbol] = sbt;
    emit SBTCreated(sbt, _name, _symbol, _pjmanager, _admin);
  }

  //Same _name & _symbol let be override
  function getContractAddress(string calldata _name, string calldata _symbol)
    public
    view
    returns (address)
  {
    return getSBTaddress[_name][_symbol];
  }

  function setChildTrustedforwarder(address ForwarderAddress) public {
    require(
      hasRole(SET_FORWARDER_ROLE, _msgSender()),
      "SBTFactory: must have SET_FORWARDER_ROLE"
    );
    _setChildTrusedForwarder(ForwarderAddress);
  }

  function _setChildTrusedForwarder(address ForwarderAddress) internal {
    _TrustedForwarder = ForwarderAddress;
  }

  function getChildTrustedforwarder() public view returns (address) {
    return _TrustedForwarder;
  }
}
