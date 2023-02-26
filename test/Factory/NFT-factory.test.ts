/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { Contract, utils } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractReceipt } from "ethers";

describe("Factory", function () {
  let deployer: SignerWithAddress;
  let SuperAdmin: SignerWithAddress;
  let NotMinter: SignerWithAddress;
  let NotBurner: SignerWithAddress;
  let address3: SignerWithAddress;
  let cFactoryMock: Contract;

  const TokenexistsError = "ERC721Metadata: URI query for nonexistent token";
  const URIUpdaterError = "SBT: must have URI updater role to update URI";
  const NotMinterRollError = "SBT: must have minter role to mint";
  const NotBurnerRollError = "SBT: must have burner role to burn";
  const SBTError = "SBT: Err Token is SBT";

  const name = 'SugaiYuuka'
  const symbol = 'SY'
  const defaultURI = 'https://sample.com'
  
  const dummyContract = '0x00E9C198af8F6a8692d83d1702e691A03F2cdc63'
  const zeroaddress = '0x0000000000000000000000000000000000000000'
  const Adminhash =  '0x0000000000000000000000000000000000000000000000000000000000000000'

  beforeEach(async function () {
    [ SuperAdmin, NotMinter, NotBurner, address3] =
      await ethers.getSigners();

    const cfFactoryContract = await ethers.getContractFactory("Factory");

    cFactoryMock = await cfFactoryContract.deploy(SuperAdmin.address);

  });

  describe("Post deployment checks", function () {
    it("Admin Roll Check", async function () {
      expect(await cFactoryMock.hasRole(Adminhash,SuperAdmin.address)).to.equal(true);
    });

  });

  describe("createERC721", function () {
    it("[S] createERC721", async function () {
      await cFactoryMock.createERC721(name,symbol,defaultURI,address3.address)
      console.log(await cFactoryMock.getContractAddress(name,symbol))
    });
  });

});