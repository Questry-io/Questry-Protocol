/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { Contract, utils } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("ContributionPool", function () {
  let deployer: SignerWithAddress;
  let superAdmin: SignerWithAddress;
  let updater: SignerWithAddress;
  let notUpdater: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let cPoolAdd: Contract;
  let cPoolFull: Contract;

  const MutationMode = {
    AddOnlyAccess: 0,
    FullControl: 1,
  } as const;

  const adminRoleHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const updaterRoleHash = utils.keccak256(utils.toUtf8Bytes("CONTRIBUTION_UPDATER_ROLE"));

  function missingRoleError(address: string, roleHash: string) {
    return `AccessControl: account ${address.toLowerCase()} is missing role ${updaterRoleHash}`;
  }

  beforeEach(async function () {
    [deployer, superAdmin, updater, notUpdater, user1, user2] = await ethers.getSigners();
    const cfPool = await ethers.getContractFactory("ContributionPool");
    cPoolAdd = await cfPool.deploy(MutationMode.AddOnlyAccess, updater.address, superAdmin.address);
    cPoolFull = await cfPool.deploy(MutationMode.FullControl, updater.address, superAdmin.address);
  });

  describe("Post deployment checks", function () {
    it("check admin role", async function () {
      expect(await cPoolAdd.hasRole(adminRoleHash, superAdmin.address)).to.be.true;
    });

    it("check contribution updater role for admin", async function () {
      expect(await cPoolAdd.hasRole(updaterRoleHash, superAdmin.address)).to.be.true;
    });

    it("check contribution updater role for updater", async function () {
      expect(await cPoolAdd.hasRole(updaterRoleHash, updater.address)).to.be.true;
    });
  });

  describe("addContribution", function () {
    it("[S] can addContribution if account has updater role", async function () {
      const tx1 = await cPoolAdd.connect(updater).addContribution(user1.address, 1);
      expect(await cPoolAdd.connect(updater).getContribution(user1.address)).equals(1);
      expect(tx1).to.emit(cPoolAdd, "AddContribution").withArgs(user1.address, 1);

      const tx2 = await cPoolAdd.connect(updater).addContribution(user1.address, 2);
      expect(await cPoolAdd.connect(updater).getContribution(user1.address)).equals(3);
      expect(tx2).to.emit(cPoolAdd, "AddContribution").withArgs(user1.address, 2);
    });

    it("[R] cannot addContribution if account has no updater role", async function () {
      await expect(cPoolAdd.connect(notUpdater).addContribution(user1.address, 1))
        .to.be.revertedWith(missingRoleError(notUpdater.address, updaterRoleHash));
    });
  });

  describe("bulkAddContribution", function () {
    it("[S] can bulkAddContribution if account has updater role", async function () {
      const tx1 = await cPoolAdd.connect(updater).bulkAddContribution([user1.address, user2.address], [1, 2]);
      expect(await cPoolAdd.connect(updater).getContribution(user1.address)).equals(1);
      expect(await cPoolAdd.connect(updater).getContribution(user2.address)).equals(2);
      expect(tx1).to.emit(cPoolAdd, "BulkAddContribution").withArgs([user1.address, user2.address], [1, 2]);

      const tx2 = await cPoolAdd.connect(updater).bulkAddContribution([user1.address, user2.address], [3, 4]);
      expect(await cPoolAdd.connect(updater).getContribution(user1.address)).equals(4);
      expect(await cPoolAdd.connect(updater).getContribution(user2.address)).equals(6);
      expect(tx2).to.emit(cPoolAdd, "BulkAddContribution").withArgs([user1.address, user2.address], [3, 4]);
    });

    it("[R] cannot bulkAddContribution if account has no updater role", async function () {
      await expect(cPoolAdd.connect(notUpdater).bulkAddContribution([user1.address, user2.address], [1, 2]))
        .to.be.revertedWith(missingRoleError(notUpdater.address, updaterRoleHash));
    });
  });

  describe("subtractContribution", function () {
    it("[S] can subtractContribution if account has updater role", async function () {
      await cPoolFull.connect(updater).addContribution(user1.address, 3);
      const tx = await cPoolFull.connect(updater).subtractContribution(user1.address, 2);
      expect(await cPoolFull.connect(updater).getContribution(user1.address)).equals(1);
      expect(tx).to.emit(cPoolFull, "SubtractContribution").withArgs(user1.address, 2);
    });

    it("[R] cannot subtractContribution if result value is negative", async function () {
      await expect(cPoolFull.connect(updater).subtractContribution(user1.address, 1)).to.be.revertedWith(
        "reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)"
      );
    });

    it("[R] cannot subtractContribution if account has no updater role", async function () {
      await cPoolFull.connect(updater).addContribution(user1.address, 3);
      await expect(cPoolFull.connect(notUpdater).subtractContribution(user1.address, 1))
        .to.be.revertedWith(missingRoleError(notUpdater.address, updaterRoleHash));
    });
  });

  describe("bulkSubtractContribution", function () {
    it("[S] can bulkSubtractContribution if account has updater role", async function () {
      await cPoolFull.connect(updater).bulkAddContribution([user1.address, user2.address], [2, 2]);
      const tx = await cPoolFull.connect(updater).bulkSubtractContribution([user1.address, user2.address], [1, 2]);
      expect(await cPoolFull.connect(updater).getContribution(user1.address)).equals(1);
      expect(await cPoolFull.connect(updater).getContribution(user2.address)).equals(0);
      expect(tx).to.emit(cPoolFull, "BulkSubtractContribution").withArgs([user1.address, user2.address], [1, 2]);
    });

    it("[R] cannot bulkSubtractContribution if result values are negative", async function () {
      await expect(cPoolFull.connect(updater).bulkSubtractContribution([user1.address, user2.address], [1, 2])).to.be.revertedWith(
        "reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)"
      );
    });

    it("[R] cannot bulkSubtractContribution if account has no updater role", async function () {
      await cPoolFull.connect(updater).bulkAddContribution([user1.address, user2.address], [2, 2]);
      await expect(cPoolFull.connect(notUpdater).bulkSubtractContribution([user1.address, user2.address], [1, 2]))
        .to.be.revertedWith(missingRoleError(notUpdater.address, updaterRoleHash));
    });
  });

  describe("setContribution", function () {
    it("[S] can setContribution if account has updater role", async function () {
      const tx1 = await cPoolFull.connect(updater).setContribution(user1.address, 1);
      expect(await cPoolFull.connect(updater).getContribution(user1.address)).equals(1);
      expect(tx1).to.emit(cPoolFull, "SetContribution").withArgs(user1.address, 1);

      const tx2 = await cPoolFull.connect(updater).setContribution(user1.address, 2);
      expect(await cPoolFull.connect(updater).getContribution(user1.address)).equals(2);
      expect(tx2).to.emit(cPoolFull, "SetContribution").withArgs(user1.address, 2);
    });

    it("[R] cannot setContribution if account has no updater role", async function () {
      await expect(cPoolFull.connect(notUpdater).setContribution(user1.address, 1))
        .to.be.revertedWith(missingRoleError(notUpdater.address, updaterRoleHash));
    });
  });

  describe("bulkSetContribution", function () {
    it("[S] can bulkSetContribution if account has updater role", async function () {
      const tx1 = await cPoolFull.connect(updater).bulkSetContribution([user1.address, user2.address], [1, 2]);
      expect(await cPoolFull.connect(updater).getContribution(user1.address)).equals(1);
      expect(await cPoolFull.connect(updater).getContribution(user2.address)).equals(2);
      expect(tx1).to.emit(cPoolFull, "BulkSetContribution").withArgs([user1.address, user2.address], [1, 2]);

      const tx2 = await cPoolFull.connect(updater).bulkSetContribution([user1.address, user2.address], [3, 4]);
      expect(await cPoolFull.connect(updater).getContribution(user1.address)).equals(3);
      expect(await cPoolFull.connect(updater).getContribution(user2.address)).equals(4);
      expect(tx2).to.emit(cPoolFull, "BulkSetContribution").withArgs([user1.address, user2.address], [3, 4]);
    });

    it("[R] cannot bulkSetContribution if account has no updater role", async function () {
      await expect(cPoolFull.connect(notUpdater).bulkSetContribution([user1.address, user2.address], [1, 2]))
        .to.be.revertedWith(missingRoleError(notUpdater.address, updaterRoleHash));
    });
  });

  describe("getContribution", function () {
    it("[S] can getContribution if account has no contribution", async function () {
      expect(await cPoolFull.connect(user1).getContribution(user1.address)).to.be.equal(0);
    });
  });
});
