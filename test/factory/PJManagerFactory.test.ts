/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { PJManagerFactory } from "../../typechain";
import { expect } from "chai";

describe("PJManagerFactory", function () {
  let deployer: SignerWithAddress;
  let superAdmin: SignerWithAddress;
  let pjManagerAdmin: SignerWithAddress;
  let cPJManagerFactory: PJManagerFactory;

  const dummyContract = "0x00E9C198af8F6a8692d83d1702e691A03F2cdc63";

  beforeEach(async function () {
    [deployer, superAdmin, pjManagerAdmin] = await ethers.getSigners();

    const cfPJManagerFactory = await ethers.getContractFactory(
      "PJManagerFactory"
    );
    cPJManagerFactory = await cfPJManagerFactory.deploy(dummyContract);
    await cPJManagerFactory.deployed();
  });

  describe("createPJManager", function () {
    it("[S] should createPJManager", async function () {
      const tx = await cPJManagerFactory
        .connect(pjManagerAdmin)
        .createPJManager(10000, []);
      const pjManagers = await cPJManagerFactory.getPJManagers(
        pjManagerAdmin.address
      );
      expect(pjManagers.length).to.equal(1);
      expect(pjManagers[0]).not.equal(ethers.constants.AddressZero);
      expect(await cPJManagerFactory.getPJManagerAdmin(pjManagers[0])).to.equal(
        pjManagerAdmin.address
      );
      expect(tx)
        .to.emit(cPJManagerFactory, "PJManagerCreated")
        .withArgs(pjManagerAdmin.address, pjManagers[0]);
    });
  });
});
