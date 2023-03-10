/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { Contract, utils } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("ContributionPool", function () {
  let deployer: SignerWithAddress;
  let superAdmin: SignerWithAddress;
  let notUpdater: SignerWithAddress;
  let cPool: Contract;

  const adminRoleHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const updaterRoleHash = utils.keccak256(utils.toUtf8Bytes("CONTRIBUTION_UPDATER_ROLE"));

  function missingRoleError(address: string, roleHash: string) {
    return `AccessControl: account ${address.toLowerCase()} is missing role ${updaterRoleHash}`;
  }

  beforeEach(async function () {
    [deployer, superAdmin, notUpdater] = await ethers.getSigners();
    const cfPool = await ethers.getContractFactory("ContributionPool");
    cPool = await cfPool.deploy(superAdmin.address);
  });

  describe("Post deployment checks", function () {
    it("check admin role", async function () {
      expect(await cPool.hasRole(adminRoleHash, superAdmin.address)).to.be.true;
    });

    it("check contribution updater role", async function () {
      expect(await cPool.hasRole(updaterRoleHash, superAdmin.address)).to.be.true;
    });
  });

  describe("addContribution", function () {
    it("[S] can addContribution if account has updater role", async function () {
      const tx1 = await cPool.connect(superAdmin).addContribution(superAdmin.address, 1);
      const got1 = await cPool.connect(superAdmin).getContribution(superAdmin.address);
      expect(got1).to.be.equal(1);
      expect(tx1).to.emit(cPool, "AddContribution").withArgs([superAdmin.address, 1]);

      const tx2 = await cPool.connect(superAdmin).addContribution(superAdmin.address, 2);
      const got2 = await cPool.connect(superAdmin).getContribution(superAdmin.address);
      expect(got2).to.be.equal(3);
      expect(tx2).to.emit(cPool, "AddContribution").withArgs([superAdmin.address, 3]);
    });

    it("[R] cannot addContribution if account has no updater role", async function () {
      await expect(cPool.connect(notUpdater).addContribution(notUpdater.address, 1))
        .to.be.revertedWith(missingRoleError(notUpdater.address, updaterRoleHash));
    });
  });

  describe("getContribution", function () {
    it("[S] can getContribution if account has no contribution", async function () {
      expect(await cPool.connect(superAdmin).getContribution(superAdmin.address)).to.be.equal(0);
    });
  });
});
