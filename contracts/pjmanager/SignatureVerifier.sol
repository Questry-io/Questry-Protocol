// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {ISignatureVerifier} from "../interface/pjmanager/ISignatureVerifier.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";
import {LibPJManager} from "../library/LibPJManager.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";



import {console} from "hardhat/console.sol";

abstract contract SignatureVerifier is 
  ISignatureVerifier,
  IAccessControl,
  EIP712
{
  using Counters for Counters.Counter;
  Counters.Counter public Nonce;

  //Sigthreshold
  uint256 public Threshold;

  /// @inheritdoc ISignatureVerifier
  function verifySignature(LibQuestryPlatform.AllocateArgs calldata _args, bytes[] calldata _signatures)
    public
    view
    returns (bool)
  {
    // Step1 : Parameters and signatures checks
    // Check parameters
    LibQuestryPlatform._checkParameterForAllocation(_args);
    // Verify signatures
    _verifySignaturesForAllocation(
      _args,
      _signatures
    );
    return true;
  }

  function _verifySignaturesForAllocation(
    LibQuestryPlatform.AllocateArgs calldata _args,
    bytes[] calldata _signatures
  ) private view {
    uint256 verifycount = 0;
    for(uint idx= 0; idx < _signatures.length;idx++){
      // Prepares ERC712 message hash of Allcator
      address recoverdAddress = _domainSeparatorV4()
        .toTypedDataHash(LibQuestryPlatform._hashAllocate(_args))
        .recover(_signatures[idx]);
      // EM: invalid Allocate signer
      if(IAccessControl(address(this)).hasroll(LibPJManager.PJ_VERIFY_SIGNER_ROLE,recoverdAddress)){
        verifycount += 1;
      }
    }
    require(verifycount >= getThreshold(),"SignatureVerifier: signare verify's threshold not reached");
  }

  /// @inheritdoc SignatureVerifier
  function _incrementNonce()
    internal
  {
    Nonce.increment();
  }

  /// @inheritdoc SignatureVerifier
  function _setThreshold(uint256 _threshold)
    internal
  {
    Threshold = _threshold;
  }

  /**
   * @dev Signature verify nonce view
   */
  function getNonce() 
    public 
    view 
    returns(uint256)
  {
    return Nonce.current();
  }

  /**
   * @dev Signature verify threshold view
   */
  function getThreshold() 
    public 
    view 
    returns(uint256)
  {
    return Threshold;
  }
  
}
