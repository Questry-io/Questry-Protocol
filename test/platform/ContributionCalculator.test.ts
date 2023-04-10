/* eslint-disable node/no-missing-import */
import { ethers, upgrades } from "hardhat";
import { Contract, utils } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("ContributionCalculator", function () {
  let superAdmin: SignerWithAddress;
  let notAdmin: SignerWithAddress;
  let poolUpdater: SignerWithAddress;
  let member1: SignerWithAddress;
  let member2: SignerWithAddress;
  let cPool1: Contract;
  let cPool2: Contract;
  let cCalculator: Contract;

  const linearAlgorithm = utils
    .keccak256(utils.toUtf8Bytes("LINEAR"))
    .slice(0, 10);

  beforeEach(async function () {
    [superAdmin, notAdmin, poolUpdater, member1, member2] =
      await ethers.getSigners();
    const cfPool = await ethers.getContractFactory("ContributionPool");

    cPool1 = await cfPool.deploy(0, poolUpdater.address, superAdmin.address);
    cPool2 = await cfPool.deploy(0, poolUpdater.address, superAdmin.address);

    const cfCalculator = await ethers.getContractFactory(
      "ContributionCalculator",
      superAdmin
    );
    cCalculator = await upgrades.deployProxy(cfCalculator, [], {
      kind: "uups",
    });
  });

  describe("Upgrade contract", function () {
    it("[S] can upgrade by admin (deployer)", async function () {
      const implV2 = await ethers.getContractFactory(
        "MockContributionCalculatorV2"
      );
      const upgraded = await upgrades.upgradeProxy(cCalculator, implV2);
      await expect(upgraded.deployed()).not.reverted;
    });

    it("[S] cannot upgrade by notAdmin", async function () {
      const implV2 = await ethers.getContractFactory(
        "MockContributionCalculatorV2",
        notAdmin
      );
      await expect(
        upgrades.upgradeProxy(cCalculator, implV2)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("calculateDispatch", function () {
    it("[R] reverts if invalid arguments", async function () {
      await expect(
        cCalculator.calculateDispatch([member1.address], {
          algorithm: linearAlgorithm,
          args: ethers.constants.HashZero,
        })
      ).to.be.revertedWith(""); // expects abi.decode error
    });

    it("[R] reverts if unknown algorithm", async function () {
      await expect(
        cCalculator.calculateDispatch([member1.address], {
          algorithm: utils.keccak256(utils.toUtf8Bytes("UNKNOWN")).slice(0, 10),
          args: ethers.constants.HashZero,
        })
      ).to.be.revertedWith("Calculator: unknown algorithm");
    });
  });

  describe("calculateSharesWithLinear", function () {
    type SharesWithLinear = {
      pools: string[];
      coefs: number[];
    };
    function createArgsWithLinear(args: SharesWithLinear) {
      return {
        algorithm: linearAlgorithm,
        args: utils.defaultAbiCoder.encode(
          ["(address[] pools,uint120[] coefs)"],
          [args]
        ),
      };
    }

    it("[S] check member1 has no contribution", async function () {
      const result = await cCalculator.calculateDispatch(
        [member1.address],
        createArgsWithLinear({
          pools: [cPool1.address, cPool2.address],
          coefs: [2, 3],
        })
      );
      expect(result.shares.length).equals(1);
      expect(result.shares[0]).equals(0);
      expect(result.totalShare).equals(0);
    });

    it("[S] check member1 contributes to pool1", async function () {
      await cPool1.connect(superAdmin).addContribution(member1.address, 2);
      const result = await cCalculator.calculateDispatch(
        [member1.address],
        createArgsWithLinear({
          pools: [cPool1.address, cPool2.address],
          coefs: [2, 3],
        })
      );
      expect(result.shares.length).equals(1);
      expect(result.shares[0]).equals(4); // 2 * 2
      expect(result.totalShare).equals(4);
    });

    it("[S] check member1 contributes to pool1 and pool2", async function () {
      await cPool1.connect(superAdmin).addContribution(member1.address, 2);
      await cPool2.connect(superAdmin).addContribution(member1.address, 3);
      const result = await cCalculator.calculateDispatch(
        [member1.address],
        createArgsWithLinear({
          pools: [cPool1.address, cPool2.address],
          coefs: [2, 3],
        })
      );
      expect(result.shares.length).equals(1);
      expect(result.shares[0]).equals(13); // 2 * 2 + 3 * 3
      expect(result.totalShare).equals(13);
    });

    it("[S] check member1 and member2 contribute", async function () {
      await cPool1.connect(superAdmin).addContribution(member1.address, 2);
      await cPool1.connect(superAdmin).addContribution(member2.address, 2);
      await cPool2.connect(superAdmin).addContribution(member2.address, 3);
      const result = await cCalculator.calculateDispatch(
        [member1.address, member2.address],
        createArgsWithLinear({
          pools: [cPool1.address, cPool2.address],
          coefs: [2, 3],
        })
      );
      expect(result.shares.length).equals(2);
      expect(result.shares[0]).equals(4); // 2 * 2
      expect(result.shares[1]).equals(13); // 2 * 2 + 3 * 3
      expect(result.totalShare).equals(17);
    });
  });
});