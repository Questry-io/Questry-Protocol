/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { Contract, utils } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import { MockCallerContract } from "../typechain";

export type AllocateArgs = {
  pjManager: string;
  paymentMode: string; 
  paymentToken: string; 
  board: string; 
  calculateArgs:  CalculateDispatchArgs;
  updateNeededPools: string[]; 
  ContributePoolOwner: string[]; 
  pjnonce: string;
};

export type SharesWithLinear = {
  pools: string[];
  coefs: number[];
};

export type AllocationShare = {
  recipient: string;
  share: number;
};

export type CalculateDispatchArgs = {
  algorithm: string;
  args: string;
};

const AllOCATE_TYPEHASH = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(
    "AllocateArgs(address pjManager,bytes4 paymentMode,address paymentToken,address board,CalculateDispatchArgs calculateArgs,address[] updateNeededPools,address[] ContributePoolOwner,uint256 pjnonce)CalculateDispatchArgs(bytes4 algorithm,bytes args)"
  )
);

const CALCURATEDISPATCHARGS_TYPEHASH = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(
    "CalculateDispatchArgs(bytes4 algorithm,bytes args)"
  )
);

export class TestUtils {
  static linearAlgorithm = keccak256(utils.toUtf8Bytes("LINEAR")).slice(0, 10);
  static dummySigner = "0x3b0Ba9F781c0c090e55E544c2252CF1037239874";

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
      signer: TestUtils.dummySigner,
      signature: ethers.constants.HashZero,
      signedTime: 123,
    };
  }

  static async call(
    caller: MockCallerContract,
    callee: Contract,
    func: string,
    args: any[]
  ) {
    const iface = new ethers.utils.Interface([`function ${func}`]);
    const fname = func.split("(")[0];
    const signature = iface.encodeFunctionData(fname, args);
    return await caller.callFunction(callee.address, signature);
  }

}






