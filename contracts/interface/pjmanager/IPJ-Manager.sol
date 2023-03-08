// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IPJManager {
  /**
   * @dev Register a new board which is identified by `sbt` and `tokenId` pair.
   */
  function registerBoard(address sbt, uint256 tokenId) external;

  /**
   * @dev Resolve unique boardId in the project from `sbt` and `tokenId` pair.
   */
  function resolveBoardId(address sbt, uint256 tokenId) external view returns (uint256);
}
