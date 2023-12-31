/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getMetaTx, getMetaTxAndSignForGas } from "../utils";

describe("QuestryForwarder", function () {
  let QuestryForwarderFactory: ContractFactory;
  let questryForwarder: Contract;
  let admin: SignerWithAddress;
  let executor: SignerWithAddress;
  let executor2: SignerWithAddress;
  let nonExecutor: SignerWithAddress;
  let issuer: SignerWithAddress;
  let questryErc20: Contract;

  beforeEach(async function () {
    [admin, executor, executor2, nonExecutor, issuer] =
      await ethers.getSigners();
    QuestryForwarderFactory = await ethers.getContractFactory(
      "QuestryForwarder"
    );
    questryForwarder = await QuestryForwarderFactory.deploy();
    questryForwarder.deployed();

    await questryForwarder
      .connect(admin)
      .initialize(admin.address, executor.address);
    await questryForwarder
      .connect(admin)
      .grantRole(questryForwarder.EXECUTOR_ROLE(), executor2.address);
    const ERC20 = await ethers.getContractFactory("QuestryERC20");
    questryErc20 = await ERC20.deploy(
      questryForwarder.address,
      admin.address,
      issuer.address
    );
    await questryErc20.deployed();

    this.name = "QuestryForwarder";
    this.chainId = (await ethers.provider.getNetwork()).chainId;
    this.value = "0";
    this.gas = (await ethers.provider.getBlock("latest")).gasLimit.toString();
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
          executor.address
        )
      ).to.equal(true);
    });
    it("[R] should fail if initialize is called more than once", async function () {
      // The contract has already been initialized in the beforeEach hook, so trying to initialize it again should fail.
      await expect(
        questryForwarder
          .connect(admin)
          .initialize(admin.address, executor.address)
      ).to.be.revertedWith("Initializable: contract is already initialized");
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

    it("[R] should fail if deposit value is 0", async function () {
      await expect(
        questryForwarder
          .connect(nonExecutor)
          .deposit({ value: ethers.utils.parseEther("0") })
      ).to.be.revertedWith(
        "QuestryForwarder: deposit value must be greater than 0"
      );
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
      const startBalance = await ethers.provider.getBalance(executor.address);
      await questryForwarder
        .connect(executor2)
        .withdraw(executor.address, withdrawAmount);
      expect(
        await ethers.provider.getBalance(questryForwarder.address)
      ).to.equal(depositAmount.sub(withdrawAmount));
      expect(await ethers.provider.getBalance(executor.address)).to.equal(
        startBalance.add(withdrawAmount)
      );
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
    this.beforeEach(async function () {
      const depositAmount = ethers.utils.parseEther("1");
      await questryForwarder
        .connect(executor)
        .deposit({ value: depositAmount });
    });

    it("[S] should process the meta-transaction correctly", async function () {
      const startBalance = await ethers.provider.getBalance(executor.address);
      // Prepare meta-transaction
      const data = questryErc20.interface.encodeFunctionData("selfMint", [
        1000,
      ]);
      const from = issuer.address;
      const nonce: string = (await questryForwarder.getNonce(from)).toString();
      const to = questryErc20.address;
      // get proper gas to execute meta tx
      const { metaTxForGas, signForGas } = await getMetaTxAndSignForGas(
        this.name,
        this.chainId,
        questryForwarder.address,
        from,
        to,
        nonce,
        data,
        this.value,
        this.gas
      );
      const estimatedGas: string = (
        await questryForwarder
          .connect(executor)
          .estimateGas.execute(metaTxForGas.message, signForGas)
      ).toString();
      // create typedData for sign meta tx
      const metaTx = await getMetaTx(
        this.name,
        this.chainId,
        questryForwarder.address,
        from,
        to,
        nonce,
        data,
        this.value,
        estimatedGas
      );
      // sign meta tx
      const signature = await ethers.provider.send("eth_signTypedData_v4", [
        from,
        JSON.stringify(metaTx),
      ]);
      expect(
        await questryForwarder
          .connect(executor)
          .verify(metaTx.message, signature)
      ).to.equal(true);
      // Relay meta-transaction
      await questryForwarder
        .connect(executor)
        .execute(metaTx.message, signature);
      // Check if the meta-transaction was processed successfully
      expect(await questryForwarder.getNonce(from)).to.equal(nonce + 1);
      expect(await questryErc20.balanceOf(questryErc20.address)).to.equal(1000);
      expect(
        (await ethers.provider.getBalance(executor.address))
          .sub(startBalance)
          .isNegative()
      ).to.equal(false);
    });

    it("[S] should be greater or equal amount of contract's ether than before executing many times", async function () {
      await questryErc20.connect(issuer).selfMint(10000000);
      const startBalance = await ethers.provider.getBalance(executor.address);
      for (let i = 0; i < 100; i++) {
        // Prepare meta-transaction
        const data = questryErc20.interface.encodeFunctionData("withdraw", [
          admin.address,
          100,
        ]);
        const from = admin.address;
        const nonce: string = (
          await questryForwarder.getNonce(from)
        ).toString();
        const to = questryErc20.address;
        // get proper gas to execute meta tx
        const { metaTxForGas, signForGas } = await getMetaTxAndSignForGas(
          this.name,
          this.chainId,
          questryForwarder.address,
          from,
          to,
          nonce,
          data,
          this.value,
          this.gas
        );

        const estimatedGas: string = (
          await questryForwarder
            .connect(executor)
            .estimateGas.execute(metaTxForGas.message, signForGas)
        ).toString();
        const metaTx = await getMetaTx(
          this.name,
          this.chainId,
          questryForwarder.address,
          from,
          to,
          nonce,
          data,
          this.value,
          estimatedGas
        );
        // sign meta tx
        const signature = await ethers.provider.send("eth_signTypedData_v4", [
          from,
          JSON.stringify(metaTx),
        ]);

        // Relay meta-transaction
        await questryForwarder
          .connect(executor)
          .execute(metaTx.message, signature);
      }

      expect(
        (await ethers.provider.getBalance(executor.address))
          .sub(startBalance)
          .isNegative()
      ).to.equal(false);
    });

    it("[R] should fail if the sender is not an executor", async function () {
      await questryForwarder
        .connect(executor)
        .deposit({ value: ethers.utils.parseEther("0.1") });
      // const value = ethers.utils.parseEther("0.1");
      const from = issuer.address;
      const to = questryErc20.address;
      const nonce: string = (await questryForwarder.getNonce(from)).toString();
      const data = questryErc20.interface.encodeFunctionData("selfMint", [
        1000,
      ]);
      const metaTx = await getMetaTx(
        this.name,
        this.chainId,
        questryForwarder.address,
        from,
        to,
        nonce,
        data,
        this.value
      );
      // sign meta tx
      const signature = await ethers.provider.send("eth_signTypedData_v4", [
        from,
        JSON.stringify(metaTx),
      ]);

      await expect(
        questryForwarder.connect(nonExecutor).execute(metaTx.message, signature)
      ).to.be.reverted;
    });

    it("[R] should fail if the gas price is too high", async function () {
      const withdrawAmount = ethers.utils.parseEther("1");
      await questryForwarder
        .connect(executor)
        .withdraw(executor.address, withdrawAmount);
      const data = questryErc20.interface.encodeFunctionData("selfMint", [
        1000,
      ]);
      const from = issuer.address;
      const nonce: string = (await questryForwarder.getNonce(from)).toString();
      const to = questryErc20.address;

      // create typedData for sign meta tx
      const metaTx = await getMetaTx(
        this.name,
        this.chainId,
        questryForwarder.address,
        from,
        to,
        nonce,
        data,
        this.value,
        this.gas
      );
      // sign meta tx
      const signature = await ethers.provider.send("eth_signTypedData_v4", [
        from,
        JSON.stringify(metaTx),
      ]);

      await expect(
        questryForwarder.connect(executor).execute(metaTx.message, signature)
      ).to.be.revertedWith(
        "QuestryForwarder: withdraw value must be less than balance"
      );
    });

    it("[R] should fail if the destination address is invalid", async function () {
      const invalidAddress = "0x0000000000000000000000000000000000000000";
      const from = issuer.address;
      const to = questryErc20.address;
      const nonce: string = (await questryForwarder.getNonce(from)).toString();
      const data = questryErc20.interface.encodeFunctionData("selfMint", [
        1000,
      ]);
      const metaTx = await getMetaTx(
        this.name,
        this.chainId,
        questryForwarder.address,
        invalidAddress,
        to,
        nonce,
        data,
        this.value
      );
      // sign meta tx
      const signature = await ethers.provider.send("eth_signTypedData_v4", [
        from,
        JSON.stringify(metaTx),
      ]);

      await expect(
        questryForwarder.connect(executor).execute(metaTx.message, signature)
      ).to.be.reverted;
    });

    it("[R] should fail if the contract is paused", async function () {
      await questryForwarder.connect(admin).pause();
      const from = issuer.address;
      const to = questryErc20.address;
      const nonce: string = (await questryForwarder.getNonce(from)).toString();
      const data = questryErc20.interface.encodeFunctionData("selfMint", [
        1000,
      ]);
      const metaTx = await getMetaTx(
        this.name,
        this.chainId,
        questryForwarder.address,
        from,
        to,
        nonce,
        data,
        this.value
      );
      // sign meta tx
      const signature = await ethers.provider.send("eth_signTypedData_v4", [
        from,
        JSON.stringify(metaTx),
      ]);

      await expect(
        questryForwarder.connect(executor).execute(metaTx.message, signature)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("[R] should fail if the signature does not match the request", async function () {
      const from = issuer.address;
      const to = questryErc20.address;
      const nonce: string = (await questryForwarder.getNonce(from)).toString();
      const data = questryErc20.interface.encodeFunctionData("selfMint", [
        1000,
      ]);
      const metaTx = await getMetaTx(
        this.name,
        this.chainId,
        questryForwarder.address,
        from,
        to,
        nonce,
        data,
        this.value
      );

      const invalidSignature = ethers.utils.hexZeroPad("0x01", 65);

      await expect(
        questryForwarder
          .connect(executor)
          .verify(metaTx.message, invalidSignature)
      ).to.be.revertedWith("ECDSA: invalid signature");
    });

    it("[R] should fail if there is not enough gas for the call", async function () {
      const from = issuer.address;
      const to = questryErc20.address;
      const nonce: string = (await questryForwarder.getNonce(from)).toString();
      const data = questryErc20.interface.encodeFunctionData("selfMint", [
        1000,
      ]);
      const metaTx = await getMetaTx(
        this.name,
        this.chainId,
        questryForwarder.address,
        from,
        to,
        nonce,
        data,
        this.value
      );
      // sign meta tx
      const signature = await ethers.provider.send("eth_signTypedData_v4", [
        from,
        JSON.stringify(metaTx),
      ]);

      // Modify the gas value to be insufficient for the call
      const insufficientGas = 1000;
      metaTx.message.gas = insufficientGas.toString();

      await expect(
        questryForwarder.connect(executor).execute(metaTx.message, signature)
      ).to.be.reverted;
    });
  });

  describe("grantRole", function () {
    it("[S] should add a new executor successfully", async function () {
      await questryForwarder
        .connect(admin)
        .grantRole(questryForwarder.EXECUTOR_ROLE(), nonExecutor.address);
      expect(
        await questryForwarder.hasRole(
          await questryForwarder.EXECUTOR_ROLE(),
          nonExecutor.address
        )
      ).to.equal(true);
    });

    it("[R] should fail if the sender is not the admin", async function () {
      await expect(
        questryForwarder
          .connect(nonExecutor)
          .grantRole(questryForwarder.EXECUTOR_ROLE(), executor.address)
      ).to.be.reverted;
    });
  });

  describe("revokeRole", function () {
    it("[S] should remove an executor successfully", async function () {
      await questryForwarder
        .connect(admin)
        .revokeRole(questryForwarder.EXECUTOR_ROLE(), executor.address);
      expect(
        await questryForwarder.hasRole(
          await questryForwarder.EXECUTOR_ROLE(),
          executor.address
        )
      ).to.equal(false);
    });

    it("[R] should fail if the sender is not the admin", async function () {
      await expect(
        questryForwarder
          .connect(nonExecutor)
          .revokeRole(questryForwarder.EXECUTOR_ROLE(), executor.address)
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
  describe("receive", function () {
    it("[S] should receive ETH successfully", async function () {
      const amount = 100;
      await issuer.sendTransaction({
        to: questryForwarder.address,
        value: amount,
      });
      expect(
        await ethers.provider.getBalance(questryForwarder.address)
      ).to.equal(amount);
    });
  });
  describe("fallback", function () {
    it("[S] should successfully receive ethers via fallback", async function () {
      const valueToSend = ethers.utils.parseEther("1");
      await expect(() =>
        nonExecutor.sendTransaction({
          to: questryForwarder.address,
          value: valueToSend,
          data: "0x", // Empty data to trigger fallback
        })
      ).to.changeEtherBalance(questryForwarder, valueToSend);
    });
  });
});
