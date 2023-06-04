// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Context, ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {LibPJManager} from "../library/LibPJManager.sol";
import {PJManager} from "../pjmanager/PJManager.sol";
//interface import
import {IPJManagerFactory} from "../interface/factory/IPJManagerFactory.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {IQuestryPlatform} from "../interface/platform/IQuestryPlatform.sol";

contract PJManagerFactory is IPJManagerFactory, ERC2771Context {
  event PJManagerCreated(address indexed admin, address pjManager);

  IQuestryPlatform public immutable questryPlatform;
  mapping(address => IPJManager[]) public pjManagersByAdmin;
  mapping(IPJManager => address) public adminByPJManager;

  constructor(IQuestryPlatform _questryPlatform, address _trustedForwarder)
    ERC2771Context(_trustedForwarder)
  {
    questryPlatform = _questryPlatform;
  }

  /**
   * @dev Create a new PJManager contract.
   */
  function createPJManager(
    address _admin,
    uint32 _boardingMembersProportion,
    address _businessOwner
  ) external returns (PJManager pjManager) {
    pjManager = new PJManager(
      questryPlatform,
      _admin,
      _boardingMembersProportion,
      _businessOwner
    );
    pjManagersByAdmin[_admin].push(pjManager);
    adminByPJManager[pjManager] = _admin;
    emit PJManagerCreated(_admin, address(pjManager));
  }

  /// @inheritdoc IPJManagerFactory
  function getPJManagerAdmin(IPJManager _pjManager)
    external
    view
    returns (address)
  {
    return adminByPJManager[_pjManager];
  }

  /**
   * @dev Returns PJManagers created by a PJManager admin.
   */
  function getPJManagers(address _admin)
    external
    view
    returns (IPJManager[] memory)
  {
    return pjManagersByAdmin[_admin];
  }

  /**
   * @dev See {ERC2771Context-_msgSender}
   */
  function _msgSender()
    internal
    view
    override(ERC2771Context)
    returns (address sender)
  {
    sender = ERC2771Context._msgSender();
  }

  /**
   * @dev See {ERC2771Context-_msgData}
   */
  function _msgData()
    internal
    view
    override(ERC2771Context)
    returns (bytes calldata)
  {
    return ERC2771Context._msgData();
  }
}
