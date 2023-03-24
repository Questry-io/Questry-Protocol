// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";
import {ContributionPool} from "../pjmanager/ContributionPool.sol";

/**
 * @dev Factory contract for ContributionPool.
 */
contract ContributionPoolFactory {
  event PoolCreated(
    address indexed businessOwner,
    address pool,
    IContributionPool.MutationMode mode,
    address indexed contributionUpdater,
    address indexed admin
  );

  mapping (address => IContributionPool[]) public poolsByBusinessOwners;

  /**
   * @dev Creates a new ContributionPool contract.
   * msg.sender must be business owner of PJManager.
   *
   * Emits a {PoolCreated} event
   */
  function createPool(
    IContributionPool.MutationMode mode,
    address contributionUpdater,
    address admin
  )
    external
    returns (IContributionPool pool)
  {
    pool = new ContributionPool(mode, contributionUpdater, admin);
    poolsByBusinessOwners[msg.sender].push(pool);
    emit PoolCreated(msg.sender, address(pool), mode, contributionUpdater, admin);
  }

  /**
   * @dev Returns ContributionPool contracts which `businessOwner` created.
   */
  function getPools(address businessOwner)
    external
    view
    returns (IContributionPool[] memory)
  {
    return poolsByBusinessOwners[businessOwner];
  }
}
