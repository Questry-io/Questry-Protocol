// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import {LibQuestryPlatform} from "../../library/LibQuestryPlatform.sol";

interface ISignatureVerifier {
  /**
   * @dev Verifies the signature of SignatureVerifier signers.
   */
  function verifySignature(LibQuestryPlatform.Signature calldata _args)
    external
    view
    returns (bool);
  
  /**
   * @dev Get PJManager signature nonce
   */
  function getNonce() 
    public 
    view 
    returns(uint256);

}
