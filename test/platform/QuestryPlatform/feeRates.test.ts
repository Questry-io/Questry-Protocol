/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */
import { ethers, upgrades } from "hardhat";
import { utils } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  ContributionCalculator,
  ContributionCalculator__factory,
  QuestryPlatform,
  TokenControlProxy,
  QuestryForwarder,
} from "../../../typechain";

describe("QuestryPlatform - feeRates", function () {
  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let signers: SignerWithAddress[];
  let daoTreasuryPool: SignerWithAddress;
  let cTokenControlProxy: TokenControlProxy;
  let cQuestryPlatform: QuestryPlatform;
  let cQuestryForwarder: QuestryForwarder;
  let cCalculator: ContributionCalculator;

  const platformExecutorRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PLATFORM_EXECUTOR_ROLE")
  );

  function missingRoleError(address: string, roleHash: string) {
    return `AccessControl: account ${address.toLowerCase()} is missing role ${roleHash}`;
  }

  beforeEach(async function () {
    let rest: SignerWithAddress[];
    [deployer, admin, daoTreasuryPool, ...rest] = await ethers.getSigners();
    signers = rest.slice(0, 2);

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
  });

  describe("FeeRates", function () {
    it("[S] should setCommonFeeRate", async function () {
      await cQuestryPlatform.setCommonFeeRate(100);
      expect(await cQuestryPlatform.getCommonFeeRate()).equals(100);
    });

    it("[S] should setInvestmentFeeRate", async function () {
      await cQuestryPlatform.setInvestmentFeeRate(200);
      expect(await cQuestryPlatform.getInvestmentFeeRate()).equals(200);
    });

    it("[S] should setProtocolFeeRate", async function () {
      await cQuestryPlatform.setProtocolFeeRate(300);
      expect(await cQuestryPlatform.getProtocolFeeRate()).equals(300);
    });

    it("[S] should be that all default fee rates are set to 300", async function () {
      expect(await cQuestryPlatform.getCommonFeeRate()).equals(300);
      expect(await cQuestryPlatform.getInvestmentFeeRate()).equals(300);
      expect(await cQuestryPlatform.getProtocolFeeRate()).equals(300);
    });

    it("[R] should revert setCommonFeeRate by not deployer", async function () {
      await expect(
        cQuestryPlatform.connect(signers[0]).setCommonFeeRate(100)
      ).revertedWith(
        missingRoleError(signers[0].address, platformExecutorRoleHash)
      );
    });

    it("[R] should revert setInvestmentFeeRate by not deployer", async function () {
      await expect(
        cQuestryPlatform.connect(signers[0]).setInvestmentFeeRate(100)
      ).revertedWith(
        missingRoleError(signers[0].address, platformExecutorRoleHash)
      );
    });

    it("[R] should revert setProtocolFeeRate by not deployer", async function () {
      await expect(
        cQuestryPlatform.connect(signers[0]).setProtocolFeeRate(100)
      ).revertedWith(
        missingRoleError(signers[0].address, platformExecutorRoleHash)
      );
    });
  });
});
