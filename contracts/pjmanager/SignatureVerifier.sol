// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {ISignatureVerifier} from "../interface/pjmanager/ISignatureVerifier.sol";
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";

import {console} from "hardhat/console.sol";

abstract contract SignatureVerifier is ISignatureVerifier {
  /// @inheritdoc ISignatureVerifier
  function verifySignature(LibQuestryPlatform.Signature calldata)
    public
    view
    returns (bool)
  {
    console.log("TODO: verifySignature not implemented yet");
    return true;
  }
}
