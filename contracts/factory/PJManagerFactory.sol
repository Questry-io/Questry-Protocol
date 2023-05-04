// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IPJManagerFactory} from "../interface/factory/IPJManagerFactory.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {LibPJManager} from "../library/LibPJManager.sol";
import {PJManager} from "../pjmanager/PJManager.sol";
import {QuestryPlatform} from "../platform/QuestryPlatform.sol";
import {SBT, AccessControl} from "../token/soulbound/SBT.sol";

contract PJManagerFactory is IPJManagerFactory, AccessControl {
  event PJManagerCreated(address indexed businessOwner, address pjManager);

  QuestryPlatform public immutable questryPlatform;
  mapping(address => IPJManager[]) public pjManagersByAdmin;
  mapping(IPJManager => address) public adminByPJManager;

  constructor(QuestryPlatform _questryPlatform) {
    questryPlatform = _questryPlatform;
  }

  /**
   * @dev Create a new PJManager contract.
   */
  function createPJManager(
    uint32 boardingMembersProportion,
    LibPJManager.AllocationShare[] memory businessOwners
  ) external returns (PJManager pjManager) {
    pjManager = new PJManager(
      questryPlatform,
      _msgSender(),
      boardingMembersProportion,
      businessOwners
    );
    pjManagersByAdmin[_msgSender()].push(pjManager);
    adminByPJManager[pjManager] = _msgSender();
    emit PJManagerCreated(_msgSender(), address(pjManager));
  }

  /// @inheritdoc IPJManagerFactory
  function getPJManagerAdmin(IPJManager pjManager)
    external
    view
    returns (address)
  {
    return adminByPJManager[pjManager];
  }

  /**
   * @dev Returns PJManagers created by a business owner.
   */
  function getPJManagers(address businessOwner)
    external
    view
    returns (IPJManager[] memory)
  {
    return pjManagersByAdmin[businessOwner];
  }
}
