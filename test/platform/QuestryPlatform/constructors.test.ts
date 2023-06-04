/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */
import { ethers, upgrades } from "hardhat";
import { utils } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  ContributionCalculator,
  ContributionCalculator__factory,
  ContributionPool,
  ContributionPool__factory,
  QuestryPlatform,
  TokenControlProxy,
  QuestryForwarder,
} from "../../../typechain";
import { TestUtils } from "../../testUtils";

describe("QuestryPlatform - constructors", function () {
  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let poolAdmin: SignerWithAddress;
  let contributionUpdater: SignerWithAddress;
  let platformUpgrader: SignerWithAddress;
  let daoTreasuryPool: SignerWithAddress;
  let cTokenControlProxy: TokenControlProxy;
  let cQuestryPlatform: QuestryPlatform;
  let cQuestryForwarder: QuestryForwarder;
  let cCalculator: ContributionCalculator;
  let cContributionPool: ContributionPool;

  const platformAdminRole = utils.keccak256(
    utils.toUtf8Bytes("PLATFORM_ADMIN_ROLE")
  );
  const platformExecutorRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PLATFORM_EXECUTOR_ROLE")
  );
  const verifySignerRoleHash = utils.keccak256(
    utils.toUtf8Bytes("POOL_VERIFY_SIGNER_ROLE")
  );

  beforeEach(async function () {
    [
      deployer,
      admin,
      poolAdmin,
      contributionUpdater,
      daoTreasuryPool,
      platformUpgrader,
    ] = await ethers.getSigners();

    // Deploy ContributionCalculator
    cCalculator = await new ContributionCalculator__factory(deployer).deploy();
    await cCalculator.deployed();

    // Deploy TokenControlProxy
    const cfTokenControlProxy = await ethers.getContractFactory(
      "TokenControlProxy"
    );
    cTokenControlProxy = (await upgrades.deployProxy(
      cfTokenControlProxy,
      [admin.address],
      {
        initializer: "__TokenControlProxy_init",
        constructorArgs: [ethers.constants.AddressZero],
      }
    )) as TokenControlProxy;
    await cTokenControlProxy.deployed();

    // Deploy QuestryForwarder
    const cfQuestryForwarder = await ethers.getContractFactory(
      "QuestryForwarder"
    );
    cQuestryForwarder = await cfQuestryForwarder.deploy();
    await cQuestryForwarder.deployed();
    await cQuestryForwarder
      .connect(deployer)
      .initialize(deployer.address, admin.address);

    // Deploy QuestryPlatform
    const cfQuestryPlatform = await ethers.getContractFactory(
      "QuestryPlatform"
    );
    cQuestryPlatform = (await upgrades.deployProxy(
      cfQuestryPlatform,
      [
        cCalculator.address,
        daoTreasuryPool.address,
        cTokenControlProxy.address,
        deployer.address,
      ],
      {
        constructorArgs: [cQuestryForwarder.address],
        kind: "uups",
      }
    )) as QuestryPlatform;
    await cQuestryPlatform.deployed();

    // Deploy ContributionPool
    cContributionPool = await new ContributionPool__factory(deployer).deploy(
      cQuestryPlatform.address,
      0,
      contributionUpdater.address,
      poolAdmin.address
    );
    await cContributionPool.deployed();

    await cContributionPool
      .connect(poolAdmin)
      .grantRole(verifySignerRoleHash, TestUtils.dummySigner);
  });

  describe("role check", function () {
    it("[S] should be that deployer has PLATFORM_ADMIN_ROLE", async function () {
      expect(
        await cQuestryPlatform.hasRole(platformAdminRole, deployer.address)
      ).to.equal(true);
    });

    it("[S] should be that deployer has PLATFORM_EXECUTOR_ROLE", async function () {
      expect(
        await cQuestryPlatform.hasRole(
          platformExecutorRoleHash,
          deployer.address
        )
      ).to.equal(true);
    });
  });

  describe("Upgrade contract", function () {
    it("[S] should be upgraded by deployer", async function () {
      const implV2 = await ethers.getContractFactory("MockQuestryPlatformV2");
      const upgraded = await upgrades.upgradeProxy(cQuestryPlatform, implV2, {
        constructorArgs: [cQuestryForwarder.address],
      });
      await expect(upgraded.deployed()).not.reverted;
    });
    it("[S] should be upgraded by user with PLATFORM_EXECUTOR_ROLE", async function () {
      await cQuestryPlatform
        .connect(deployer)
        .grantRole(platformExecutorRoleHash, platformUpgrader.address);
      const implV2 = await ethers.getContractFactory(
        "MockQuestryPlatformV2",
        platformUpgrader
      );
      const upgraded = await upgrades.upgradeProxy(cQuestryPlatform, implV2, {
        constructorArgs: [cQuestryForwarder.address],
      });
      await expect(upgraded.deployed()).not.reverted;
    });
    it("[R] should not be upgraded by user without PLATFORM_EXECUTOR_ROLE", async function () {
      const implV2 = await ethers.getContractFactory(
        "MockQuestryPlatformV2",
        platformUpgrader
      );
      await expect(
        upgrades.upgradeProxy(cQuestryPlatform, implV2, {
          constructorArgs: [cQuestryForwarder.address],
        })
      ).to.be.revertedWith(
        "AccessControl: account " +
          platformUpgrader.address.toLowerCase() +
          " is missing role " +
          platformExecutorRoleHash.toLowerCase()
      );
    });
  });
});
