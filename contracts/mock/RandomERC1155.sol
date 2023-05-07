//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract RandomERC1155 is ERC1155 {
  constructor() ERC1155("https://sbinft.market/json/{id}.json") {}

  function mint(address[] calldata _mintToList) public {
    for (uint256 idx = 0; idx < _mintToList.length; idx++) {
      _mint(_mintToList[idx], idx + 1, 10000, "");
    }
  }
}
