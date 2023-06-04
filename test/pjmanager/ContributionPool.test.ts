/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { Contract, utils } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TestUtils } from "../testUtils";
import { MockCallerContract } from "../../typechain";

describe("ContributionPool", function () {
  let deployer: SignerWithAddress;
  let superAdmin: SignerWithAddress;
  let updater: SignerWithAddress;
  let notUpdater: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let cQuestryPlatform: MockCallerContract;
  let cPoolAdd: Contract;
  let cPoolFull: Contract;

  const MutationMode = {
    AddOnlyAccess: 0,
    FullControl: 1,
  } as const;

  const poolAdminRoleHash = utils.keccak256(
    utils.toUtf8Bytes("POOL_ADMIN_ROLE")
  );
  const updaterRoleHash = utils.keccak256(
    utils.toUtf8Bytes("POOL_CONTRIBUTION_UPDATER_ROLE")
  );
  const verifySignerRoleHash = utils.keccak256(
    utils.toUtf8Bytes("POOL_VERIFY_SIGNER_ROLE")
  );
  const platformExclusiveRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PJ_PLATFORM_EXCLUSIVE_ROLE")
  );

  function missingRoleError(address: string, roleHash: string) {
    return `AccessControl: account ${address.toLowerCase()} is missing role ${roleHash}`;
  }

  beforeEach(async function () {
    [deployer, superAdmin, updater, notUpdater, user1, user2] =
      await ethers.getSigners();
    const cfMockQuestryPlatform = await ethers.getContractFactory(
      "MockCallerContract"
    );
    cQuestryPlatform = await cfMockQuestryPlatform.deploy();
    const cfPool = await ethers.getContractFactory("ContributionPool");
    cPoolAdd = await cfPool.deploy(
      cQuestryPlatform.address,
      MutationMode.AddOnlyAccess,
      updater.address,
      superAdmin.address
    );
    cPoolFull = await cfPool.deploy(
      cQuestryPlatform.address,
      MutationMode.FullControl,
      updater.address,
      superAdmin.address
    );
  });

  describe("Post deployment checks", function () {
    it("check pool admin role", async function () {
      expect(await cPoolAdd.hasRole(poolAdminRoleHash, superAdmin.address)).to
        .be.true;
    });

    it("check contribution updater role for admin", async function () {
      expect(await cPoolAdd.hasRole(updaterRoleHash, superAdmin.address)).to.be
        .true;
    });

    it("check contribution updater role for updater", async function () {
      expect(await cPoolAdd.hasRole(updaterRoleHash, updater.address)).to.be
        .true;
    });
  });

  const testSuites = [
    { name: "AddOnlyAccess", mode: MutationMode.AddOnlyAccess },
    { name: "FullControl", mode: MutationMode.FullControl },
  ];

  function getTestPool(mode: number) {
    if (mode === MutationMode.AddOnlyAccess) {
      return cPoolAdd;
    } else if (mode === MutationMode.FullControl) {
      return cPoolFull;
    } else {
      throw new Error();
    }
  }

  describe("addContribution", function () {
    testSuites.forEach(function (suite) {
      describe(`MutationMode: ${suite.name}`, async function () {
        let cPool: Contract;

        beforeEach(async function () {
          cPool = getTestPool(suite.mode);
        });

        it("[S] can addContribution if account has updater role", async function () {
          const tx1 = await cPool
            .connect(updater)
            .addContribution(user1.address, 1);
          expect(
            await cPool.connect(updater).getContribution(user1.address)
          ).equals(1);
          expect(tx1)
            .to.emit(cPool, "AddContribution")
            .withArgs(user1.address, 1);

          const tx2 = await cPool
            .connect(updater)
            .addContribution(user1.address, 2);
          expect(
            await cPool.connect(updater).getContribution(user1.address)
          ).equals(3);
          expect(tx2)
            .to.emit(cPool, "AddContribution")
            .withArgs(user1.address, 2);
        });

        it("[R] cannot addContribution if account has no updater role", async function () {
          await expect(
            cPool.connect(notUpdater).addContribution(user1.address, 1)
          ).to.be.revertedWith(
            missingRoleError(notUpdater.address, updaterRoleHash)
          );
        });
      });
    });
  });

  describe("bulkAddContribution", function () {
    testSuites.forEach(function (suite) {
      describe(`MutationMode: ${suite.name}`, function () {
        let cPool: Contract;

        beforeEach(async function () {
          cPool = getTestPool(suite.mode);
        });

        it("[S] can bulkAddContribution if account has updater role", async function () {
          const tx1 = await cPool
            .connect(updater)
            .bulkAddContribution([user1.address, user2.address], [1, 2]);
          expect(
            await cPool.connect(updater).getContribution(user1.address)
          ).equals(1);
          expect(
            await cPool.connect(updater).getContribution(user2.address)
          ).equals(2);
          expect(tx1)
            .to.emit(cPool, "BulkAddContribution")
            .withArgs([user1.address, user2.address], [1, 2]);

          const tx2 = await cPool
            .connect(updater)
            .bulkAddContribution([user1.address, user2.address], [3, 4]);
          expect(
            await cPool.connect(updater).getContribution(user1.address)
          ).equals(4);
          expect(
            await cPool.connect(updater).getContribution(user2.address)
          ).equals(6);
          expect(tx2)
            .to.emit(cPool, "BulkAddContribution")
            .withArgs([user1.address, user2.address], [3, 4]);
        });

        it("[R] cannot bulkAddContribution if account has no updater role", async function () {
          await expect(
            cPool
              .connect(notUpdater)
              .bulkAddContribution([user1.address, user2.address], [1, 2])
          ).to.be.revertedWith(
            missingRoleError(notUpdater.address, updaterRoleHash)
          );
        });
      });
    });
  });

  describe("subtractContribution", function () {
    describe("MutationMode: AddOnlyAccess", function () {
      it("[R] cannot subtractContribution if account has updater role", async function () {
        await cPoolAdd.connect(updater).addContribution(user1.address, 3);
        await expect(
          cPoolAdd.connect(updater).subtractContribution(user1.address, 2)
        ).to.be.revertedWith("ContributionPool: operation not allowed");
      });
    });

    describe("MutationMode: FullControl", function () {
      it("[S] can subtractContribution if account has updater role", async function () {
        await cPoolFull.connect(updater).addContribution(user1.address, 3);
        const tx = await cPoolFull
          .connect(updater)
          .subtractContribution(user1.address, 2);
        expect(
          await cPoolFull.connect(updater).getContribution(user1.address)
        ).equals(1);
        expect(tx)
          .to.emit(cPoolFull, "SubtractContribution")
          .withArgs(user1.address, 2);
      });

      it("[R] cannot subtractContribution if result value is negative", async function () {
        await expect(
          cPoolFull.connect(updater).subtractContribution(user1.address, 1)
        ).to.be.revertedWith(
          "reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)"
        );
      });

      it("[R] cannot subtractContribution if account has no updater role", async function () {
        await cPoolFull.connect(updater).addContribution(user1.address, 3);
        await expect(
          cPoolFull.connect(notUpdater).subtractContribution(user1.address, 1)
        ).to.be.revertedWith(
          missingRoleError(notUpdater.address, updaterRoleHash)
        );
      });
    });
  });

  describe("bulkSubtractContribution", function () {
    describe("MutationMode: AddOnlyAccess", function () {
      it("[R] cannot bulkSubtractContribution if account has updater role", async function () {
        await cPoolAdd
          .connect(updater)
          .bulkAddContribution([user1.address, user2.address], [2, 2]);
        await expect(
          cPoolAdd
            .connect(updater)
            .bulkSubtractContribution([user1.address, user2.address], [1, 2])
        ).to.be.revertedWith("ContributionPool: operation not allowed");
      });
    });

    describe("MutationMode: FullControl", function () {
      it("[S] can bulkSubtractContribution if account has updater role", async function () {
        await cPoolFull
          .connect(updater)
          .bulkAddContribution([user1.address, user2.address], [2, 2]);
        const tx = await cPoolFull
          .connect(updater)
          .bulkSubtractContribution([user1.address, user2.address], [1, 2]);
        expect(
          await cPoolFull.connect(updater).getContribution(user1.address)
        ).equals(1);
        expect(
          await cPoolFull.connect(updater).getContribution(user2.address)
        ).equals(0);
        expect(tx)
          .to.emit(cPoolFull, "BulkSubtractContribution")
          .withArgs([user1.address, user2.address], [1, 2]);
      });

      it("[R] cannot bulkSubtractContribution if result values are negative", async function () {
        await expect(
          cPoolFull
            .connect(updater)
            .bulkSubtractContribution([user1.address, user2.address], [1, 2])
        ).to.be.revertedWith(
          "reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)"
        );
      });

      it("[R] cannot bulkSubtractContribution if account has no updater role", async function () {
        await cPoolFull
          .connect(updater)
          .bulkAddContribution([user1.address, user2.address], [2, 2]);
        await expect(
          cPoolFull
            .connect(notUpdater)
            .bulkSubtractContribution([user1.address, user2.address], [1, 2])
        ).to.be.revertedWith(
          missingRoleError(notUpdater.address, updaterRoleHash)
        );
      });
    });
  });

  describe("setContribution", function () {
    describe("MutationMode: AddOnlyAccess", function () {
      it("[R] cannot setContribution if account has updater role", async function () {
        await expect(
          cPoolAdd.connect(updater).setContribution(user1.address, 1)
        ).to.be.revertedWith("ContributionPool: operation not allowed");
      });
    });

    describe("MutationMode: FullControl", function () {
      it("[S] can setContribution if account has updater role", async function () {
        const tx1 = await cPoolFull
          .connect(updater)
          .setContribution(user1.address, 1);
        expect(
          await cPoolFull.connect(updater).getContribution(user1.address)
        ).equals(1);
        expect(tx1)
          .to.emit(cPoolFull, "SetContribution")
          .withArgs(user1.address, 1);

        const tx2 = await cPoolFull
          .connect(updater)
          .setContribution(user1.address, 2);
        expect(
          await cPoolFull.connect(updater).getContribution(user1.address)
        ).equals(2);
        expect(tx2)
          .to.emit(cPoolFull, "SetContribution")
          .withArgs(user1.address, 2);
      });

      it("[R] cannot setContribution if account has no updater role", async function () {
        await expect(
          cPoolFull.connect(notUpdater).setContribution(user1.address, 1)
        ).to.be.revertedWith(
          missingRoleError(notUpdater.address, updaterRoleHash)
        );
      });
    });
  });

  describe("bulkSetContribution", function () {
    describe("MutationMode: AddOnlyAccess", function () {
      it("[R] cannot bulkSetContribution if account has updater role", async function () {
        await expect(
          cPoolAdd
            .connect(updater)
            .bulkSetContribution([user1.address, user2.address], [1, 2])
        ).to.be.revertedWith("ContributionPool: operation not allowed");
      });
    });

    describe("MutationMode: FullControl", function () {
      it("[S] can bulkSetContribution if account has updater role", async function () {
        const tx1 = await cPoolFull
          .connect(updater)
          .bulkSetContribution([user1.address, user2.address], [1, 2]);
        expect(
          await cPoolFull.connect(updater).getContribution(user1.address)
        ).equals(1);
        expect(
          await cPoolFull.connect(updater).getContribution(user2.address)
        ).equals(2);
        expect(tx1)
          .to.emit(cPoolFull, "BulkSetContribution")
          .withArgs([user1.address, user2.address], [1, 2]);

        const tx2 = await cPoolFull
          .connect(updater)
          .bulkSetContribution([user1.address, user2.address], [3, 4]);
        expect(
          await cPoolFull.connect(updater).getContribution(user1.address)
        ).equals(3);
        expect(
          await cPoolFull.connect(updater).getContribution(user2.address)
        ).equals(4);
        expect(tx2)
          .to.emit(cPoolFull, "BulkSetContribution")
          .withArgs([user1.address, user2.address], [3, 4]);
      });

      it("[R] cannot bulkSetContribution if account has no updater role", async function () {
        await expect(
          cPoolFull
            .connect(notUpdater)
            .bulkSetContribution([user1.address, user2.address], [1, 2])
        ).to.be.revertedWith(
          missingRoleError(notUpdater.address, updaterRoleHash)
        );
      });
    });
  });

  describe("add incrementTermSigner role", function () {
    it("[S] can add incrementTermSigner role by admin", async function () {
      await cPoolAdd
        .connect(superAdmin)
        .grantRole(verifySignerRoleHash, user2.address);
      expect(await cPoolAdd.isIncrementTermSigner(user2.address)).to.be.true;
    });

    it("[R] cannot addIncrementTermSigner by others", async function () {
      await expect(
        cPoolAdd.connect(user1).grantRole(verifySignerRoleHash, user2.address)
      ).to.be.revertedWith(missingRoleError(user1.address, poolAdminRoleHash));
    });
  });

  describe("remove incrementTermSigner role", function () {
    it("[S] can remove incrementTermSigner role by admin", async function () {
      await cPoolAdd
        .connect(superAdmin)
        .grantRole(verifySignerRoleHash, user2.address);
      await cPoolAdd
        .connect(superAdmin)
        .revokeRole(verifySignerRoleHash, user2.address);
      expect(await cPoolAdd.isIncrementTermSigner(user2.address)).to.be.false;
    });

    it("[R] cannot remove incrementTermSigner role by others", async function () {
      await cPoolAdd
        .connect(superAdmin)
        .grantRole(verifySignerRoleHash, user2.address);
      await expect(
        cPoolAdd.connect(user1).revokeRole(verifySignerRoleHash, user2.address)
      ).to.be.revertedWith(missingRoleError(user1.address, poolAdminRoleHash));
    });
  });

  describe("incrementTerm", function () {
    it("[S] can incrementTerm by QuestryPlatform", async function () {
      await cPoolAdd
        .connect(superAdmin)
        .grantRole(verifySignerRoleHash, user1.address);
      await TestUtils.call(
        cQuestryPlatform,
        cPoolAdd,
        "incrementTerm(address[] verifiedSigners)",
        [[user1.address]]
      );
      expect(await cPoolAdd.getTerm()).equals(1);
      await TestUtils.call(
        cQuestryPlatform,
        cPoolAdd,
        "incrementTerm(address[] verifiedSigners)",
        [[user1.address]]
      );
      expect(await cPoolAdd.getTerm()).equals(2);
    });

    it("[S] can incrementTerm for multiple signers", async function () {
      await cPoolAdd
        .connect(superAdmin)
        .grantRole(verifySignerRoleHash, user1.address);
      await cPoolAdd
        .connect(superAdmin)
        .grantRole(verifySignerRoleHash, user2.address);
      await TestUtils.call(
        cQuestryPlatform,
        cPoolAdd,
        "incrementTerm(address[] verifiedSigners)",
        [[user1.address]]
      );
      expect(await cPoolAdd.getTerm()).equals(1);
      await TestUtils.call(
        cQuestryPlatform,
        cPoolAdd,
        "incrementTerm(address[] verifiedSigners)",
        [[user2.address]]
      );
      expect(await cPoolAdd.getTerm()).equals(2);
      await TestUtils.call(
        cQuestryPlatform,
        cPoolAdd,
        "incrementTerm(address[] verifiedSigners)",
        [[user1.address, user2.address]]
      );
      expect(await cPoolAdd.getTerm()).equals(3);
    });

    it("[S] can incrementTerm if signers length is greater than threshold", async function () {
      await cPoolAdd
        .connect(superAdmin)
        .grantRole(verifySignerRoleHash, user1.address);
      await cPoolAdd
        .connect(superAdmin)
        .grantRole(verifySignerRoleHash, user2.address);
      await cPoolAdd.connect(superAdmin).setThreshold(2);
      await TestUtils.call(
        cQuestryPlatform,
        cPoolAdd,
        "incrementTerm(address[] verifiedSigners)",
        [[user1.address, user2.address]]
      );
      expect(await cPoolAdd.getTerm()).equals(1);
      await TestUtils.call(
        cQuestryPlatform,
        cPoolAdd,
        "incrementTerm(address[] verifiedSigners)",
        [[ethers.constants.AddressZero, user1.address, user2.address]]
      );
      expect(await cPoolAdd.getTerm()).equals(2);
    });

    it("[R] cannot incrementTerm if signers length is less than threshold", async function () {
      const extraUser = "0x90fA7809574b4f8206ec1a47aDc37eCEE57443cb";
      await cPoolAdd
        .connect(superAdmin)
        .grantRole(verifySignerRoleHash, user1.address);
      await cPoolAdd
        .connect(superAdmin)
        .grantRole(verifySignerRoleHash, user2.address);
      await cPoolAdd
        .connect(superAdmin)
        .grantRole(verifySignerRoleHash, extraUser);
      await cPoolAdd.connect(superAdmin).setThreshold(3);
      await expect(
        TestUtils.call(
          cQuestryPlatform,
          cPoolAdd,
          "incrementTerm(address[] verifiedSigners)",
          [[user1.address, user2.address]]
        )
      ).revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'ContributionPool: insufficient whitelisted signers'"
      );
      await expect(
        TestUtils.call(
          cQuestryPlatform,
          cPoolAdd,
          "incrementTerm(address[] verifiedSigners)",
          [[extraUser, user2.address]]
        )
      ).revertedWith(
        "VM Exception while processing transaction: reverted with reason string 'ContributionPool: insufficient whitelisted signers'"
      );
    });

    it("[R] cannot incrementTerm by not platform even if by admin", async function () {
      await expect(
        cPoolAdd.connect(superAdmin).incrementTerm([user1.address])
      ).to.be.revertedWith(
        missingRoleError(superAdmin.address, platformExclusiveRoleHash)
      );
    });

    it("[R] cannot incrementTerm if signer is not allowed", async function () {
      await expect(
        TestUtils.call(
          cQuestryPlatform,
          cPoolAdd,
          "incrementTerm(address[] memory verifiedSigners)",
          [[user1.address]]
        )
      ).to.be.revertedWith(
        "ContributionPool: insufficient whitelisted signers"
      );
    });
  });

  describe("threshold", function () {
    it("[S] should be that default threshold = 1", async function () {
      expect(await cPoolAdd.getThreshold()).equals(1);
    });

    it("[S] can setThreshold by admin", async function () {
      await cPoolAdd.connect(superAdmin).setThreshold(2);
      expect(await cPoolAdd.getThreshold()).equals(2);
    });

    it("[S] cannot setThreshold by others", async function () {
      await expect(cPoolAdd.connect(user1).setThreshold(2)).revertedWith(
        missingRoleError(user1.address, poolAdminRoleHash)
      );
    });
  });

  describe("getContribution", function () {
    it("[S] can getContribution if account has no contribution", async function () {
      expect(
        await cPoolFull.connect(user1).getContribution(user1.address)
      ).to.be.equal(0);
    });
  });
});
