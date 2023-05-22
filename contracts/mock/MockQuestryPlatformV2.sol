// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
//library import
import {LibPJManager} from "../library/LibPJManager.sol";
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";
//interface import
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {IContributionCalculator} from "../interface/platform/IContributionCalculator.sol";
import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";
import {IQuestryPlatform} from "../interface/platform/IQuestryPlatform.sol";
import {IBoard} from "../interface/token/IBoard.sol";
import {ITokenControlProxy} from "../interface/token-control-proxy/ITokenControlProxy.sol";
import {QuestryPlatform} from "../platform/QuestryPlatform.sol";

/**
 * @dev Mock V2 implementation for QuestryPlatform, which is used for upgrade testing.
 */
contract MockQuestryPlatformV2 is QuestryPlatform {
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address _trustedForwarder) QuestryPlatform(_trustedForwarder) {
    _disableInitializers();
  }
}
