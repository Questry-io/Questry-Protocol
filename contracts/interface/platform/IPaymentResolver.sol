// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {LibQuestryPlatform} from "contracts/library/LibQuestryPlatform.sol";

interface IPaymentResolver {
  function resolveAfterPayment(
    LibQuestryPlatform.ExecutePaymentArgs calldata _args
  ) external;
}
