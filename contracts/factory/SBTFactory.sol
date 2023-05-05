// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IPJManagerFactory} from "../interface/factory/IPJManagerFactory.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {SBT, AccessControl} from "../token/soulbound/SBT.sol";

contract SBTFactory is AccessControl {
  event SBTCreated(
    address contractAddress,
    string name,
    string symbol,
    address indexed pjManager,
    address indexed admin
  );

  bytes32 public constant SET_FORWARDER_ROLE = keccak256("SET_FORWARDER_ROLE");

  /// @dev Mapping from name and symbol to basic ERC721 address.
  mapping(string => mapping(string => address)) public getSBTaddress;

  IPJManagerFactory public pjManagerFactory;

  /// @dev Trusted forwarder for SBT contracts to be created.
  address private _trustedForwarder;

  constructor(IPJManagerFactory _pjManagerFactory, address admin) {
    pjManagerFactory = _pjManagerFactory;

    _setupRole(DEFAULT_ADMIN_ROLE, admin);
    _setupRole(SET_FORWARDER_ROLE, admin);
  }

  /**
   * @dev Create a new SBT contract for `_pjManager`.
   */
  function createSBT(
    string calldata _name,
    string calldata _symbol,
    string memory _baseTokenURI,
    IPJManager _pjManager,
    address _admin
  ) external returns (address sbt) {
    require(
      getSBTaddress[_name][_symbol] == address(0),
      "SBTFactory: must use another name and symbol"
    );
    require(
      pjManagerFactory.getPJManagerAdmin(_pjManager) == _msgSender(),
      "SBTFactory: only PJManager admin can create SBT"
    );

    bytes32 _salt = keccak256(abi.encodePacked(_name, _symbol));
    sbt = address(
      new SBT{salt: _salt}(
        _name,
        _symbol,
        _baseTokenURI,
        _pjManager,
        _admin,
        _trustedForwarder
      )
    );

    getSBTaddress[_name][_symbol] = sbt;
    emit SBTCreated(sbt, _name, _symbol, address(_pjManager), _admin);
  }

  /**
   * @dev Get contract address from `_name` and `_symbol`.
   * Same `_name` and `_symbol` let be override.
   */
  function getContractAddress(string calldata _name, string calldata _symbol)
    public
    view
    returns (address)
  {
    return getSBTaddress[_name][_symbol];
  }

  /**
   * @dev Set `forwarderAddress` for SBT contracts to be created.
   */
  function setChildTrustedForwarder(address forwarderAddress) public {
    require(
      hasRole(SET_FORWARDER_ROLE, _msgSender()),
      "SBTFactory: must have SET_FORWARDER_ROLE"
    );
    _setChildTrustedForwarder(forwarderAddress);
  }

  function _setChildTrustedForwarder(address forwarderAddress) internal {
    _trustedForwarder = forwarderAddress;
  }

  /**
   * @dev Get trusted forwarder for SBT contracts to be created.
   */
  function getChildTrustedForwarder() public view returns (address) {
    return _trustedForwarder;
  }
}
