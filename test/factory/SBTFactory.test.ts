/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SBTFactory, PJManagerFactory } from "../../typechain";

describe("SBTFactory", function () {
  let deployer: SignerWithAddress;
  let sbtFactoryAdmin: SignerWithAddress;
  let setForwarderer: SignerWithAddress;
  let user: SignerWithAddress;
  let pjManagerAdmin: SignerWithAddress;
  let cSBTFactory: SBTFactory;
  let cPJManagerFactory: PJManagerFactory;
  let pjManagerAddress: string;

  const sbtExistsError = "SBTFactory: must use another name and symbol";
  const setForwarderRoleError = "SBTFactory: must have SET_FORWARDER_ROLE";

  const name = "SugaiYuuka";
  const symbol = "SY";
  const baseURI = "https://sample.com/";

  const dummyContract = "0x00E9C198af8F6a8692d83d1702e691A03F2cdc63";

  beforeEach(async function () {
    [deployer, setForwarderer, user, sbtFactoryAdmin, pjManagerAdmin] =
      await ethers.getSigners();

    const cfPJManagerFactory = await ethers.getContractFactory(
      "PJManagerFactory"
    );
    cPJManagerFactory = await cfPJManagerFactory.deploy(
      ethers.constants.AddressZero,
      ethers.constants.AddressZero
    );
    await cPJManagerFactory.deployed();

    await cPJManagerFactory.connect(pjManagerAdmin).createPJManager(10000, []);
    pjManagerAddress = (
      await cPJManagerFactory.getPJManagers(pjManagerAdmin.address)
    )[0];

    const cfSBTFactory = await ethers.getContractFactory("SBTFactory");
    cSBTFactory = await cfSBTFactory.deploy(
      cPJManagerFactory.address,
      sbtFactoryAdmin.address
    );
    await cSBTFactory.deployed();

    const forwarderRole = await cSBTFactory.SET_FORWARDER_ROLE();
    await cSBTFactory
      .connect(sbtFactoryAdmin)
      .grantRole(forwarderRole, setForwarderer.address);
  });

  describe("Post deployment checks", function () {
    it("Admin Role Check", async function () {
      expect(
        await cSBTFactory.hasRole(
          ethers.constants.HashZero,
          sbtFactoryAdmin.address
        )
      ).to.be.true;
    });
  });

  describe("createSBT", function () {
    it("[S] check SBT address stored", async function () {
      await cSBTFactory
        .connect(pjManagerAdmin)
        .createSBT(
          name,
          symbol,
          baseURI,
          pjManagerAddress,
          pjManagerAdmin.address
        );
      const sbt = await cSBTFactory.getContractAddress(name, symbol);
      expect(sbt).not.equal(ethers.constants.AddressZero);
    });

    it("[S] check event emitted", async function () {
      const tx = await cSBTFactory
        .connect(pjManagerAdmin)
        .createSBT(
          name,
          symbol,
          baseURI,
          pjManagerAddress,
          pjManagerAdmin.address
        );
      const sbt = await cSBTFactory.getContractAddress(name, symbol);
      expect(tx)
        .to.emit(cSBTFactory, "SBTCreated")
        .withArgs(sbt, name, symbol, pjManagerAddress, pjManagerAdmin.address);
    });

    it("[R] check createSBT by not admin error", async function () {
      await expect(
        cSBTFactory
          .connect(user)
          .createSBT(
            name,
            symbol,
            baseURI,
            pjManagerAddress,
            pjManagerAdmin.address
          )
      ).revertedWith("SBTFactory: only PJManager admin can create SBT");
    });

    it("[R] check SBT exists error", async function () {
      await cSBTFactory
        .connect(pjManagerAdmin)
        .createSBT(
          name,
          symbol,
          baseURI,
          pjManagerAddress,
          pjManagerAdmin.address
        );
      await cSBTFactory.getContractAddress(name, symbol);
      await expect(
        cSBTFactory
          .connect(pjManagerAdmin)
          .createSBT(
            name,
            symbol,
            baseURI,
            pjManagerAddress,
            pjManagerAdmin.address
          )
      ).to.be.revertedWith(sbtExistsError);
    });
  });

  describe("setChildTrustedforwarder", function () {
    it("[S] can update forwarder by factory admin", async function () {
      await cSBTFactory
        .connect(sbtFactoryAdmin)
        .setChildTrustedForwarder(dummyContract);
      expect(await cSBTFactory.getChildTrustedForwarder()).to.be.equal(
        dummyContract
      );
    });

    it("[S] can update forwarder by set-forwarder-role account", async function () {
      await cSBTFactory
        .connect(setForwarderer)
        .setChildTrustedForwarder(dummyContract);
      expect(await cSBTFactory.getChildTrustedForwarder()).to.be.equal(
        dummyContract
      );
    });

    it("[R] can not update forwarder by no role account", async function () {
      await expect(
        cSBTFactory.connect(user).setChildTrustedForwarder(dummyContract)
      ).to.be.revertedWith(setForwarderRoleError);
    });
  });
});
