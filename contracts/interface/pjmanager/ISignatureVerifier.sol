// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import {LibQuestryPlatform} from "../../library/LibQuestryPlatform.sol";

interface ISignatureVerifier {
  /**
   * @dev Verifies the signature of SignatureVerifier signers.
   */
  function verifySignature(LibQuestryPlatform.AllocateArgs calldata _args, bytes[] calldata _signatures)
    public
    view
    returns (bool);
  
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
