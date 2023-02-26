// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract NFTRandom is ERC721 {
  constructor() ERC721("Random", "RAND") {}

  function mint(address to, uint256 newItemId) public returns (uint256) {
    _mint(to, newItemId);

    return newItemId;
  }
}
