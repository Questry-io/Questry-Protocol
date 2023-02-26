/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { Contract, utils } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractReceipt } from "ethers";

describe("ERC721", function () {
  let SuperAdmin: SignerWithAddress;
  let NotMinter: SignerWithAddress;
  let NotBurner: SignerWithAddress;
  let address3: SignerWithAddress;
  let cNFTMock: Contract;

  const TokenexistsError = "ERC721URIStorage: URI query for nonexistent token";
  const NotMinterRollError = "ERC721: must have minter role to mint";

  const name = 'SugaiYuuka'
  const symbol = 'SY'
  const defaultURI = 'https://sample.com'
  const dummyURI1 = 'https://dummy.com'
  const dummyURI2 = 'https://dummydummy.com'
  
  const dummyContract = '0x00E9C198af8F6a8692d83d1702e691A03F2cdc63'
  const zeroaddress = '0x0000000000000000000000000000000000000000'
  const Adminhash =  '0x0000000000000000000000000000000000000000000000000000000000000000'

  beforeEach(async function () {
    [ SuperAdmin, NotMinter, NotBurner, address3] =
      await ethers.getSigners();

    const cfNFTContract = await ethers.getContractFactory("NFT");

    cNFTMock = await cfNFTContract.deploy(name,symbol,defaultURI,SuperAdmin.address,dummyContract);

  });

  describe("Post deployment checks", function () {
    it("name check", async function () {
      expect(await cNFTMock.name()).to.equal(name);
    });

    it("symbol check", async function () {
      expect(await cNFTMock.symbol()).to.equal(symbol);
    });

    it("Admin Roll Check", async function () {
      expect(await cNFTMock.hasRole(Adminhash,SuperAdmin.address)).to.equal(true);
    });

    it("Minter Roll Check", async function () {
      const MInterhash = utils.keccak256(utils.toUtf8Bytes("MINTER_ROLE"))
      expect(await cNFTMock.hasRole(MInterhash,SuperAdmin.address)).to.equal(true);
    });

  });

  describe("tokenURI", function () {
    it("[R] err check tokenURI", async function () {
      await expect(cNFTMock.tokenURI(1)).to.be.revertedWith(TokenexistsError);
    });


    it("[S] check tokenURI for defaultURI", async function () {
      await cNFTMock.connect(SuperAdmin).mint(address3.address,defaultURI)
      expect(await cNFTMock.tokenURI(1)).to.equal(defaultURI);
    });
  });

  describe("mint test", function () {
    it("[S] mint check", async function () {
      await cNFTMock.connect(SuperAdmin).mint(address3.address,defaultURI);
      expect(await cNFTMock.balanceOf(address3.address)).to.equal(1);
      expect(await cNFTMock.ownerOf(1)).to.equal(address3.address);
      expect(await cNFTMock.tokenURI(1)).to.equal(defaultURI);
    });

    it("[S] Bulk mint check", async function () {
      const recipents = [
        NotMinter.address,
        NotBurner.address,
        address3.address
      ]

      const tokenURIs = [
        defaultURI,
        dummyURI1,
        dummyURI2
      ]
      
      await cNFTMock.connect(SuperAdmin).Bulkmint(recipents,tokenURIs);
      //check Not Minter address recipent
      expect(await cNFTMock.balanceOf(NotMinter.address)).to.equal(1);
      expect(await cNFTMock.ownerOf(1)).to.equal(NotMinter.address);
      expect(await cNFTMock.tokenURI(1)).to.equal(defaultURI);
      //check Not Burner address reci
      expect(await cNFTMock.balanceOf(NotBurner.address)).to.equal(1);
      expect(await cNFTMock.ownerOf(2)).to.equal(NotBurner.address);
      expect(await cNFTMock.tokenURI(2)).to.equal(dummyURI1);
      //check address3 address recipient
      expect(await cNFTMock.balanceOf(address3.address)).to.equal(1);
      expect(await cNFTMock.ownerOf(3)).to.equal(address3.address);
      expect(await cNFTMock.tokenURI(3)).to.equal(dummyURI2);
    });

    it("[R]can not Mint by NotMinter not have roll", async function () {
      await expect(
        cNFTMock.connect(NotMinter).mint(address3.address,defaultURI)
      ).to.be.revertedWith(NotMinterRollError);
    });

    it("[R]can not Mint by NotMinter not have roll", async function () {
      const recipents = [
        NotMinter.address,
        NotBurner.address,
        address3.address
      ]

      const tokenURIs = [
        defaultURI,
        dummyURI1,
        dummyURI2
      ]

      await expect(
        cNFTMock.connect(NotMinter).Bulkmint(recipents,tokenURIs)
      ).to.be.revertedWith(NotMinterRollError);
    });
  });

});