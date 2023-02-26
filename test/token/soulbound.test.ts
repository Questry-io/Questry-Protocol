/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { Contract, utils } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractReceipt } from "ethers";

describe("SBT", function () {
  let deployer: SignerWithAddress;
  let SuperAdmin: SignerWithAddress;
  let NotMinter: SignerWithAddress;
  let NotBurner: SignerWithAddress;
  let address3: SignerWithAddress;
  let cSBTMock: Contract;

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

    const cfSBTContract = await ethers.getContractFactory("SBT");

    cSBTMock = await cfSBTContract.deploy(name,symbol,defaultURI,SuperAdmin.address,dummyContract);

  });

  describe("Post deployment checks", function () {
    it("name check", async function () {
      expect(await cSBTMock.name()).to.equal(name);
    });

    it("symbol check", async function () {
      expect(await cSBTMock.symbol()).to.equal(symbol);
    });

    it("Admin Roll Check", async function () {
      expect(await cSBTMock.hasRole(Adminhash,SuperAdmin.address)).to.equal(true);
    });

    it("Minter Roll Check", async function () {
      const MInterhash = utils.keccak256(utils.toUtf8Bytes("MINTER_ROLE"))
      expect(await cSBTMock.hasRole(MInterhash,SuperAdmin.address)).to.equal(true);
    });

    it("BURNER Roll Check", async function () {
      const Burnerhash = utils.keccak256(utils.toUtf8Bytes("BUNER_ROLE"))
      expect(await cSBTMock.hasRole(Burnerhash,SuperAdmin.address)).to.equal(true);
    });

    it("URI UPDATER Roll Check", async function () {
      const URIupdaterhash = utils.keccak256(utils.toUtf8Bytes("URIUPDATER_ROLE"))
      expect(await cSBTMock.hasRole(URIupdaterhash,SuperAdmin.address)).to.equal(true);
    });

    it("Trusted Forworder Check", async function () {
      expect(await cSBTMock.isTrustedForwarder(dummyContract)).to.equal(true);
    });

  });

  describe("tokenURI", function () {
    it("[R] err check tokenURI", async function () {
      await expect(cSBTMock.tokenURI(1)).to.be.revertedWith(TokenexistsError);
    });


    it("[S] check tokenURI for defaultURI", async function () {
      await cSBTMock.connect(SuperAdmin).mint(address3.address)
      expect(await cSBTMock.tokenURI(1)).to.equal(defaultURI);
    });

    it("[S] check tokenURI for baseURI", async function () {
      await cSBTMock.connect(SuperAdmin).mint(address3.address)
      await cSBTMock.updateBaseTokenURI(defaultURI + '/')
      expect(await cSBTMock.tokenURI(1)).to.equal(defaultURI + '/1.json');
    });

    it("[R] err check updateBaseTokenURI", async function () {
      await expect(cSBTMock.connect(address3).updateBaseTokenURI(defaultURI)).to.be.revertedWith(URIUpdaterError);
    });

    it("[R] err check updateDefaultURI", async function () {
      await expect(cSBTMock.connect(address3).updateDefaultURI(defaultURI)).to.be.revertedWith(URIUpdaterError);
    });
  });

  describe("mint test", function () {
    it("[S] mint check", async function () {
      await cSBTMock.connect(SuperAdmin).mint(address3.address);
      expect(await cSBTMock.balanceOf(address3.address)).to.equal(1);
      expect(await cSBTMock.ownerOf(1)).to.equal(address3.address);
    });

    it("[S] Bulk mint check", async function () {
      const recipents = [
        NotMinter.address,
        NotBurner.address,
        address3.address
      ]
      
      await cSBTMock.connect(SuperAdmin).Bulkmint(recipents);
      //check Not Minter address recipent
      expect(await cSBTMock.balanceOf(NotMinter.address)).to.equal(1);
      expect(await cSBTMock.ownerOf(1)).to.equal(NotMinter.address);
      //check Not Burner address reci
      expect(await cSBTMock.balanceOf(NotBurner.address)).to.equal(1);
      expect(await cSBTMock.ownerOf(2)).to.equal(NotBurner.address);
      //check address3 address recipient
      expect(await cSBTMock.balanceOf(address3.address)).to.equal(1);
      expect(await cSBTMock.ownerOf(3)).to.equal(address3.address);
    });

    it("[R]can not Mint by NotMinter not have roll", async function () {
      await expect(
        cSBTMock.connect(NotMinter).mint(address3.address)
      ).to.be.revertedWith(NotMinterRollError);
    });

    it("[R]can not Mint by NotMinter not have roll", async function () {
      const recipents = [
        NotMinter.address,
        NotBurner.address,
        address3.address
      ]
      await expect(
        cSBTMock.connect(NotMinter).Bulkmint(recipents)
      ).to.be.revertedWith(NotMinterRollError);
    });
  });

  describe("burn", function () {
    it("[S] Burn check", async function () {
      await cSBTMock.connect(SuperAdmin).mint(address3.address);
      expect(await cSBTMock.balanceOf(address3.address)).to.equal(1);
      expect(await cSBTMock.ownerOf(1)).to.equal(address3.address);
      
      await cSBTMock.burn(1);
      expect(await cSBTMock.balanceOf(address3.address)).to.equal(0);
      await expect(cSBTMock.ownerOf(1)).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });

    it("[S] Bulk Burn check", async function () {
      const recipents = [
        NotMinter.address,
        NotBurner.address,
        address3.address
      ]
      await cSBTMock.Bulkmint(recipents);
      //check Not Minter address recipent
      expect(await cSBTMock.balanceOf(NotMinter.address)).to.equal(1);
      expect(await cSBTMock.ownerOf(1)).to.equal(NotMinter.address);
      //check Not Burner address recipient
      expect(await cSBTMock.balanceOf(NotBurner.address)).to.equal(1);
      expect(await cSBTMock.ownerOf(2)).to.equal(NotBurner.address);
      //check address3 address recipient
      expect(await cSBTMock.balanceOf(address3.address)).to.equal(1);
      expect(await cSBTMock.ownerOf(3)).to.equal(address3.address);

      const tokenIDs = [
        1,2,3
      ];
      await cSBTMock.Bulkburn(tokenIDs);
      //check Not Minter address recipent
      expect(await cSBTMock.balanceOf(NotMinter.address)).to.equal(0);
      await expect(cSBTMock.ownerOf(1)).to.be.revertedWith('ERC721: owner query for nonexistent token');
      //check Not Burner address recipient
      expect(await cSBTMock.balanceOf(NotBurner.address)).to.equal(0);
      await expect(cSBTMock.ownerOf(2)).to.be.revertedWith('ERC721: owner query for nonexistent token');
      //check address3 address recipient
      expect(await cSBTMock.balanceOf(address3.address)).to.equal(0);
      await expect(cSBTMock.ownerOf(3)).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });

    it("[R] NotBurner Err check", async function () {
      await cSBTMock.mint(address3.address);
      await expect(
        cSBTMock.connect(NotBurner).burn(1)
      ).to.be.revertedWith(NotBurnerRollError);
    });
  });

  describe("SBT Test", function () {
    it("[R] SBT transfer err", async function () {
      await cSBTMock.mint(NotMinter.address);
      await expect(
        cSBTMock.connect(NotMinter).transferFrom(NotMinter.address,NotBurner.address,1)
      ).to.be.revertedWith(SBTError);
    });

    it("[R] SBT approve err", async function () {
      await cSBTMock.mint(NotMinter.address);
      await expect(
        cSBTMock.connect(NotMinter).approve(dummyContract,1)
      ).to.be.revertedWith(SBTError);
    });
    
    it("[R] SBT setapproveforAll err", async function () {
      await cSBTMock.mint(NotMinter.address);
      await expect(
        cSBTMock.connect(NotMinter).setApprovalForAll(dummyContract,true)
      ).to.be.revertedWith(SBTError);
    });

  });

});