//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RandomERC20 is ERC20 {
  constructor() ERC20("Random", "RAND") {}

  function mint(address[] calldata mintToList) public {
    for (uint256 idx = 0; idx < mintToList.length; idx++) {
      _mint(mintToList[idx], 10000);
    }
  }
}
