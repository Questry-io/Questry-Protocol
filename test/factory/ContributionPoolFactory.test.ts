/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("ContributionPoolFactory", function () {
  let deployer: SignerWithAddress;
  let superAdmin: SignerWithAddress;
  let contributionUpdater: SignerWithAddress;
  let businessOwner: SignerWithAddress;
  let cPoolFactory: Contract;

  beforeEach(async function () {
    [deployer, superAdmin, contributionUpdater, businessOwner] =
      await ethers.getSigners();
    const cfPoolFactory = await ethers.getContractFactory(
      "ContributionPoolFactory"
    );
    cPoolFactory = await cfPoolFactory.deploy(ethers.constants.AddressZero);
  });

  describe("createPool", function () {
    it("[S] check ContributionPool address stored", async function () {
      await cPoolFactory
        .connect(businessOwner)
        .createPool(0, contributionUpdater.address, superAdmin.address);
      const pools = await cPoolFactory.getPools(businessOwner.address);
      expect(pools.length).equals(1);
      expect(pools[0]).not.equals(ethers.constants.AddressZero);
    });

    it("[S] check event emitted", async function () {
      const tx = await cPoolFactory
        .connect(businessOwner)
        .createPool(1, contributionUpdater.address, superAdmin.address);
      const pools = await cPoolFactory.getPools(businessOwner.address);
      expect(tx)
        .to.emit(cPoolFactory, "PoolCreated")
        .withArgs(
          businessOwner.address,
          pools[0],
          1,
          contributionUpdater.address,
          superAdmin.address
        );
    });
  });

  describe("getPools", function () {
    it("[S] can getPools if businessOwner has no pool", async function () {
      expect(
        await cPoolFactory
          .connect(businessOwner)
          .getPools(businessOwner.address)
      ).deep.equals([]);
    });
  });
});
