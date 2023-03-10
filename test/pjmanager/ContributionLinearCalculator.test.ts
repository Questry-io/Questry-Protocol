/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("ContributionLinearCalculator constructor", function () {
  it("[R] mismatch array length error", async function () {
    const factory = await ethers.getContractFactory("ContributionLinearCalculator");
    const dummyPool = "0x00E9C198af8F6a8692d83d1702e691A03F2cdc63";
    await expect(factory.deploy([dummyPool], [1, 2])).to.be.revertedWith("CLC: mismatch array length");
  });
});

describe("ContributionLinearCalculator", function () {
  let deployer: SignerWithAddress;
  let superAdmin: SignerWithAddress;
  let user: SignerWithAddress;
  let cPool1: Contract;
  let cPool2: Contract;
  let cCalculator: Contract;

  beforeEach(async function () {
    [deployer, superAdmin, user] = await ethers.getSigners();
    const cfPool = await ethers.getContractFactory("ContributionPool");

    cPool1 = await cfPool.deploy(superAdmin.address);
    cPool2 = await cfPool.deploy(superAdmin.address);

    const cfCalculator = await ethers.getContractFactory("ContributionLinearCalculator");
    cCalculator = await cfCalculator.deploy([cPool1.address, cPool2.address], [2, 3]);
  });

  describe("getContribution", function () {
    it("[S] check user has no contribution", async function () {
      expect(await cCalculator.getContribution(user.address)).to.be.equal(0);
    });

    it("[S] check user contributes to pool1", async function () {
      await cPool1.connect(superAdmin).addContribution(user.address, 2);
      expect(await cCalculator.getContribution(user.address)).to.be.equal(4); // 2 * 2
    });

    it("[S] check user contributes to pool1 and pool2", async function () {
      await cPool1.connect(superAdmin).addContribution(user.address, 2);
      await cPool2.connect(superAdmin).addContribution(user.address, 3);
      expect(await cCalculator.getContribution(user.address)).to.be.equal(13); // 2 * 2 + 3 * 3
    });
  });
});
