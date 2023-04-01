/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("QuestryForwarder", function () {
  let QuestryForwarderFactory: ContractFactory;
  let questryForwarder: Contract;
  let admin: SignerWithAddress;
  let executor: SignerWithAddress;
  let nonExecutor: SignerWithAddress;
  let to: Contract;

  beforeEach(async function () {
    [admin, executor, nonExecutor] = await ethers.getSigners();
    QuestryForwarderFactory = await ethers.getContractFactory(
      "QuestryForwarder"
    );
    questryForwarder = await QuestryForwarderFactory.deploy();
    await questryForwarder
      .connect(admin)
      .initialize(admin.address, executor.address);
    const ERC20 = await ethers.getContractFactory("ERC20");
    to = await ERC20.deploy("Questry", "QRY");
    await to.deployed();
  });

  describe("initialize", function () {
    it("[S] should initialize the contract with default roles", async function () {
      expect(
        await questryForwarder.hasRole(
          await questryForwarder.DEFAULT_ADMIN_ROLE(),
          admin.address
        )
      ).to.equal(true);
      expect(
        await questryForwarder.hasRole(
          await questryForwarder.EXECUTOR_ROLE(),
          admin.address
        )
      ).to.equal(true);
    });
  });

  describe("deposit", function () {
    it("[S] should deposit ethers successfully", async function () {
      // await questryForwarder.connect(admin).initialize(admin.address, executor.address);
      const depositAmount = ethers.utils.parseEther("1");
      await questryForwarder
        .connect(executor)
        .deposit({ value: depositAmount });
      expect(
        await ethers.provider.getBalance(questryForwarder.address)
      ).to.equal(depositAmount);
    });

    it("[R] should fail if the sender is not an executor", async function () {
      await expect(
        questryForwarder
          .connect(nonExecutor)
          .deposit({ value: ethers.utils.parseEther("1") })
      ).to.be.reverted;
    });
  });

  describe("withdraw", function () {
    const depositAmount = ethers.utils.parseEther("1");

    beforeEach(async function () {
      await questryForwarder
        .connect(executor)
        .deposit({ value: depositAmount });
    });

    it("[S] should withdraw ethers successfully", async function () {
      const withdrawAmount = ethers.utils.parseEther("0.5");
      await questryForwarder
        .connect(executor)
        .withdraw(executor.address, withdrawAmount);
      expect(
        await ethers.provider.getBalance(questryForwarder.address)
      ).to.equal(depositAmount.sub(withdrawAmount));
    });

    it("[R] should fail if the sender is not an executor", async function () {
      await expect(
        questryForwarder
          .connect(nonExecutor)
          .withdraw(nonExecutor.address, ethers.utils.parseEther("0.5"))
      ).to.be.reverted;
    });
  });

  describe("execute", function () {
    it("[S] should process the meta-transaction correctly", async function () {
      const startBalance = await ethers.provider.getBalance(executor.address);
      const value = ethers.utils.parseEther("0.1");
      const data = to.interface.encodeFunctionData("receiveEth");

      await questryForwarder.connect(executor).deposit({ value });
      const tx = await questryForwarder
        .connect(executor)
        .execute(to.address, value, data);
      const receipt = await tx.wait();

      expect(await ethers.provider.getBalance(to.address)).to.equal(value);
      expect(
        await ethers.provider.getBalance(questryForwarder.address)
      ).to.equal(0);

      const gasUsed = receipt.gasUsed.toNumber();
      const actualRefund = startBalance
        .sub(await ethers.provider.getBalance(executor.address))
        .sub(gasUsed * tx.gasPrice);

      expect(actualRefund).to.be.closeTo(value, 1000); // 1000 wei
      expect(
        await questryForwarder
          .connect(executor)
          .execute(to.address, value, data)
      )
        .to.emit(questryForwarder, "Withdraw")
        .withArgs(executor.address, actualRefund);
    });

    it("[R] should fail if the sender is not an executor", async function () {
      await questryForwarder
        .connect(executor)
        .deposit({ value: ethers.utils.parseEther("0.1") });
      const value = ethers.utils.parseEther("0.1");
      const data = to.interface.encodeFunctionData("receiveEth");
      await expect(
        questryForwarder.connect(nonExecutor).execute(to.address, value, data)
      ).to.be.reverted;
    });

    it("[R] should fail if the contract is paused", async function () {
      await questryForwarder.connect(admin).pause();
      const value = ethers.utils.parseEther("0.1");
      const data = to.interface.encodeFunctionData("receiveEth");
      await expect(
        questryForwarder.connect(executor).execute(to.address, value, data)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("addExecutor", function () {
    it("[S] should add a new executor successfully", async function () {
      await questryForwarder.connect(admin).addExecutor(executor.address);
      expect(
        await questryForwarder.hasRole(
          await questryForwarder.EXECUTOR_ROLE(),
          executor.address
        )
      ).to.equal(true);
    });

    it("[R] should fail if the sender is not the admin", async function () {
      await expect(
        questryForwarder.connect(nonExecutor).addExecutor(executor.address)
      ).to.be.reverted;
    });
  });

  describe("removeExecutor", function () {
    beforeEach(async function () {
      await questryForwarder.connect(admin).addExecutor(executor.address);
    });

    it("[S] should remove an executor successfully", async function () {
      await questryForwarder.connect(admin).removeExecutor(executor.address);
      expect(
        await questryForwarder.hasRole(
          await questryForwarder.EXECUTOR_ROLE(),
          executor.address
        )
      ).to.equal(false);
    });

    it("[R] should fail if the sender is not the admin", async function () {
      await expect(
        questryForwarder.connect(nonExecutor).removeExecutor(executor.address)
      ).to.be.reverted;
    });
  });

  describe("pause", function () {
    it("[S] should pause the contract successfully", async function () {
      await questryForwarder.connect(admin).pause();
      expect(await questryForwarder.paused()).to.equal(true);
    });

    it("[R] should fail if the sender is not the admin", async function () {
      await expect(questryForwarder.connect(nonExecutor).pause()).to.be
        .reverted;
    });
  });

  describe("unpause", function () {
    beforeEach(async function () {
      await questryForwarder.connect(admin).pause();
    });

    it("[S] should unpause the contract successfully", async function () {
      await questryForwarder.connect(admin).unpause();
      expect(await questryForwarder.paused()).to.equal(false);
    });

    it("[R] should fail if the sender is not the admin", async function () {
      await expect(questryForwarder.connect(nonExecutor).unpause()).to.be
        .reverted;
    });
  });
});
