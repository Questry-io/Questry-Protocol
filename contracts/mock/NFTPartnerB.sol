// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract NFTPartnerB is ERC721 {
  constructor() ERC721("PartnerB", "PB") {}

  function mint(address to, uint256 newItemId) public returns (uint256) {
    _mint(to, newItemId);

    return newItemId;
  }
}
