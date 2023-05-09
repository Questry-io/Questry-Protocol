// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IPaymentResolver} from "../interface/platform/IPaymentResolver.sol";
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";

contract MockPaymentResolver is IPaymentResolver {
  mapping(bytes32 => bool) public isResolved;

  function resolveAfterPayment(
    LibQuestryPlatform.ExecutePaymentArgs calldata _args
  ) external {
    isResolved[keccak256(abi.encode(_args))] = true;
  }
}
