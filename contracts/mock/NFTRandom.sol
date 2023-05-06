// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract NFTRandom is ERC721 {
  constructor() ERC721("Random", "RAND") {}

  function mint(address _to, uint256 _newItemId) public returns (uint256) {
    _mint(_to, _newItemId);

    return _newItemId;
  }
}
