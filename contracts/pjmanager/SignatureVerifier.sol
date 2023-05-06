// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {ISignatureVerifier} from "../interface/pjmanager/ISignatureVerifier.sol";
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

import {console} from "hardhat/console.sol";

abstract contract SignatureVerifier is 
  ISignatureVerifier,
  EIP712
{
  using Counters for Counters.Counter;
  //PJ Manage sig nonce
  Counters.Counter public Nonce;
  //Sigthreshold
  uint256 public Threshold;

  function _verifySignaturesForAllocation(
    LibQuestryPlatform.AllocateArgs calldata _args,
    bytes calldata _signature
  ) internal view returns (address){
    // Prepares ERC712 message hash of Allcator
    address recoverdAddress = _domainSeparatorV4()
      .toTypedDataHash(LibQuestryPlatform._hashAllocate(_args))
      .recover(_signature);
    // EM: invalid Allocate signer
    return recoverdAddress;
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
