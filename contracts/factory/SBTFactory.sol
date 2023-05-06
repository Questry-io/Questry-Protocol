// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IPJManagerFactory} from "../interface/factory/IPJManagerFactory.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {Board, AccessControl} from "../token/soulbound/Board.sol";

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

  /// @dev Trusted forwarder for Board contracts to be created.
  address private _trustedForwarder;

  constructor(IPJManagerFactory _pjManagerFactory, address _admin) {
    pjManagerFactory = _pjManagerFactory;

    _setupRole(DEFAULT_ADMIN_ROLE, _admin);
    _setupRole(SET_FORWARDER_ROLE, _admin);
  }

  /**
   * @dev Create a new Board contract for `_pjManager`.
   */
  function createSBT(
    string calldata _name,
    string calldata _symbol,
    string memory _baseTokenURI,
    IPJManager _pjManager,
    address _admin
  ) external returns (address board) {
    require(
      getSBTaddress[_name][_symbol] == address(0),
      "SBTFactory: must use another name and symbol"
    );
    require(
      pjManagerFactory.getPJManagerAdmin(_pjManager) == _msgSender(),
      "SBTFactory: only PJManager admin can create Board"
    );

    bytes32 _salt = keccak256(abi.encodePacked(_name, _symbol));
    board = address(
      new Board{salt: _salt}(
        _name,
        _symbol,
        _baseTokenURI,
        _pjManager,
        _admin,
        _trustedForwarder
      )
    );

    getSBTaddress[_name][_symbol] = board;
    emit SBTCreated(board, _name, _symbol, address(_pjManager), _admin);
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
   * @dev Set `_forwarderAddress` for SBT contracts to be created.
   */
  function setChildTrustedForwarder(address _forwarderAddress) public {
    require(
      hasRole(SET_FORWARDER_ROLE, _msgSender()),
      "SBTFactory: must have SET_FORWARDER_ROLE"
    );
    _setChildTrustedForwarder(_forwarderAddress);
  }

  function _setChildTrustedForwarder(address _forwarderAddress) internal {
    _trustedForwarder = _forwarderAddress;
  }

  /**
   * @dev Get trusted forwarder for Board contracts to be created.
   */
  function getChildTrustedForwarder() public view returns (address) {
    return _trustedForwarder;
  }
}
