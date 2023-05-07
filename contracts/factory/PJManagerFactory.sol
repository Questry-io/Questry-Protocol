// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Context, ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {IPJManagerFactory} from "../interface/factory/IPJManagerFactory.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {LibPJManager} from "../library/LibPJManager.sol";
import {PJManager} from "../pjmanager/PJManager.sol";
import {QuestryPlatform} from "../platform/QuestryPlatform.sol";
import {Board, AccessControl} from "../token/soulbound/Board.sol";

contract PJManagerFactory is IPJManagerFactory, AccessControl, ERC2771Context {
  event PJManagerCreated(address indexed businessOwner, address pjManager);

  QuestryPlatform public immutable questryPlatform;
  mapping(address => IPJManager[]) public pjManagersByAdmin;
  mapping(IPJManager => address) public adminByPJManager;

  constructor(QuestryPlatform _questryPlatform, address _trustedForwarder)
    ERC2771Context(_trustedForwarder)
  {
    questryPlatform = _questryPlatform;
  }

  /**
   * @dev Create a new PJManager contract.
   */
  function createPJManager(
    uint32 _boardingMembersProportion,
    LibPJManager.AllocationShare[] memory _businessOwners
  ) external returns (PJManager pjManager) {
    pjManager = new PJManager(
      questryPlatform,
      _msgSender(),
      _boardingMembersProportion,
      _businessOwners
    );
    pjManagersByAdmin[_msgSender()].push(pjManager);
    adminByPJManager[pjManager] = _msgSender();
    emit PJManagerCreated(_msgSender(), address(pjManager));
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
   * @dev Returns PJManagers created by a business owner.
   */
  function getPJManagers(address _businessOwner)
    external
    view
    returns (IPJManager[] memory)
  {
    return pjManagersByAdmin[_businessOwner];
  }

  /**
   * @dev See {ERC2771Context-_msgSender}
   */
  function _msgSender()
    internal
    view
    override(Context, ERC2771Context)
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
    override(Context, ERC2771Context)
    returns (bytes calldata)
  {
    return ERC2771Context._msgData();
  }
}
