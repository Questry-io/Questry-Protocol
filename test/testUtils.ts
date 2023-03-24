/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { utils } from "ethers";
import { keccak256 } from "ethers/lib/utils";

export type Signature = {
  signer: string;
  signature: string;
  signedTime: number;
};

export type SharesWithLinear = {
  pools: string[];
  coefs: number[];
};

export class TestUtils {
  static linearAlgorithm = keccak256(utils.toUtf8Bytes("LINEAR")).slice(0, 10);

  static createArgsWithLinear(args: SharesWithLinear) {
    return {
      algorithm: TestUtils.linearAlgorithm,
      args: utils.defaultAbiCoder.encode(
        ["(address[] pools,uint120[] coefs)"],
        [args]
      ),
    };
  }

  static async createDummySignature() {
    return {
      signer: "0x3b0Ba9F781c0c090e55E544c2252CF1037239874",
      signature: ethers.constants.HashZero,
      signedTime: 123,
    };
  }
}
