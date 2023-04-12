// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract MockCallerContract {
  function callFunction(address c, bytes memory _encodeWithSignature)
    external
    returns (bytes memory)
  {
    (bool success, bytes memory result) = c.call(_encodeWithSignature);
    if (success == false) {
      assembly {
        let ptr := mload(0x40)
        let size := returndatasize()
        returndatacopy(ptr, 0, size)
        revert(ptr, size)
      }
    }
    return result;
  }
}
