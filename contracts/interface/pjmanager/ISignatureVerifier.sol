// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;



interface ISignatureVerifier {
  /**
   * @dev Get PJManager signature nonce
   */
  function getNonce() 
    public 
    view 
    returns(uint256);

  /**
   * @dev Get PJManager signature verify threshold
   */
  function getThreshold() 
    public 
    view 
    returns(uint256);

}
