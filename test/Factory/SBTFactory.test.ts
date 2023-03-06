/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SBTFactory } from "../../typechain/SBTFactory";

describe("SBTFactory", function () {
  let deployer: SignerWithAddress;
  let SuperAdmin: SignerWithAddress;
  let SetForwarderer: SignerWithAddress;
  let NotSetForwarderer: SignerWithAddress;
  let SBTCreator: SignerWithAddress;
  let cFactoryMock: SBTFactory;

  const SBTExistsError = "SBTFactory: must use another name and symbol";
  const SetForwarderRoleError = "SBTFactory: must have SET_FORWARDER_ROLE";

  const name = "SugaiYuuka";
  const symbol = "SY";
  const defaultURI = "https://sample.com";

  const dummyContract = "0x00E9C198af8F6a8692d83d1702e691A03F2cdc63";
  const zeroaddress = "0x0000000000000000000000000000000000000000";
  const Adminhash = "0x0000000000000000000000000000000000000000000000000000000000000000";

  beforeEach(async function () {
    [deployer, SuperAdmin, SetForwarderer, NotSetForwarderer, SBTCreator] = await ethers.getSigners();
    const cfFactoryContract = await ethers.getContractFactory("SBTFactory");
    cFactoryMock = await cfFactoryContract.deploy(SuperAdmin.address);
    const forwarderRole = await cFactoryMock.SET_FORWARDER_ROLE();
    await cFactoryMock.connect(SuperAdmin).grantRole(forwarderRole, SetForwarderer.address);
});

  describe("Post deployment checks", function () {
    it("Admin Role Check", async function () {
      // eslint-disable-next-line no-unused-expressions
      expect(await cFactoryMock.hasRole(Adminhash, SuperAdmin.address)).to.be.true;
    });
  });

  describe("createSBT", function () {
    it("[S] check SBT address stored", async function () {
      await cFactoryMock.createSBT(name, symbol, defaultURI, SBTCreator.address);
      const sbt = await cFactoryMock.getContractAddress(name, symbol);
      expect(sbt).not.equal(zeroaddress);
    });

    it("[S] check event emitted", async function () {
      const tx = await cFactoryMock.createSBT(name, symbol, defaultURI, SBTCreator.address);
      const sbt = await cFactoryMock.getContractAddress(name, symbol);
      expect(tx)
        .to.emit(cFactoryMock, "SBTCreated")
        .withArgs([sbt, name, symbol, SBTCreator.address]);
    });

    it("[R] check SBT exists error", async function () {
      await cFactoryMock.createSBT(name, symbol, defaultURI, SBTCreator.address);
      await cFactoryMock.getContractAddress(name, symbol);
      await expect(cFactoryMock.createSBT(name, symbol, defaultURI, SBTCreator.address))
        .to.be.revertedWith(SBTExistsError);
    });
  });

  describe("setChildTrustedforwarder", function () {
    it("[S] can update forwarder by admin", async function () {
      await cFactoryMock.connect(SuperAdmin).setChildTrustedforwarder(dummyContract);
      expect(await cFactoryMock.getChildTrustedforwarder()).to.be.equal(dummyContract);
    });

    it("[S] can update forwarder by set-forwarder-role account", async function () {
      await cFactoryMock.connect(SetForwarderer).setChildTrustedforwarder(dummyContract);
      expect(await cFactoryMock.getChildTrustedforwarder()).to.be.equal(dummyContract);
    });

    it("[R] can not update forwarder by no role account", async function () {
      await expect(
        cFactoryMock
          .connect(NotSetForwarderer)
          .setChildTrustedforwarder(dummyContract)
      ).to.be.revertedWith(SetForwarderRoleError);
    });
  });
});
