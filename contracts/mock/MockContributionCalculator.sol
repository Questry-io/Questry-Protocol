// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";
import {IContributionCalculator} from "../interface/platform/IContributionCalculator.sol";
import {ContributionCalculator} from "../platform/ContributionCalculator.sol";

/**
 * @dev Mock V2 implementation for ContributionCalculator, which is used for upgrade testing.
 */
contract MockContributionCalculatorV2 is ContributionCalculator {
}
