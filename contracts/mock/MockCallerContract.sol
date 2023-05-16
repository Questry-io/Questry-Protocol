// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract MockCallerContract {
  function callFunction(address _c, bytes memory _encodeWithSignature)
    external
    returns (bytes memory)
  {
    (bool success, bytes memory result) = _c.call(_encodeWithSignature);
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

  function callAndSendFunction(address _c, bytes memory _encodeWithSignature)
    external
    payable
    returns (bytes memory)
  {
    (bool success, bytes memory result) = _c.call{value: msg.value}(
      _encodeWithSignature
    );
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
