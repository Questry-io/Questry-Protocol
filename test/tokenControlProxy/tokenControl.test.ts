/* eslint-disable node/no-missing-import */
import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { RandomERC20, NFTRandom, RandomERC1155 } from "../../typechain";
import { getMetaTx, getMetaTxAndSignForGas } from "../utils";

describe("TokenControlProxy", function () {
  let admin: SignerWithAddress;
  let executor: SignerWithAddress;
  let nonExecutor: SignerWithAddress;
  let user: SignerWithAddress;
  let tokenControlProxy: Contract;
  let erc20: RandomERC20;
  let erc721: NFTRandom;
  let erc1155: RandomERC1155;
  let forwarderContract: Contract;

  beforeEach(async function () {
    [admin, executor, nonExecutor, user] = await ethers.getSigners();

    // forwarderContractのデプロイ
    const QuestryForwarder = await ethers.getContractFactory(
      "QuestryForwarder"
    );

    forwarderContract = await upgrades.deployProxy(
      QuestryForwarder,
      [admin.address, executor.address],
      { initializer: "initialize" }
    );
    await forwarderContract.deployed();

    await admin.sendTransaction({
      to: forwarderContract.address,
      value: ethers.utils.parseEther("1.0"),
    });

    this.name = "QuestryForwarder";
    this.chainId = (await ethers.provider.getNetwork()).chainId;
    this.value = "0";
    this.gas = (await ethers.provider.getBlock("latest")).gasLimit.toString();

    // tokenControlProxyのデプロイ
    const TokenControlProxy = await ethers.getContractFactory(
      "TokenControlProxy"
    );

    tokenControlProxy = await upgrades.deployProxy(
      TokenControlProxy,
      [admin.address],
      {
        initializer: "__TokenControlProxy_init",
        constructorArgs: [forwarderContract.address],
      }
    );
    await tokenControlProxy.deployed();
    await tokenControlProxy
      .connect(admin)
      .grantExecutorRoleToQuestryPlatform(executor.address);

    // erc20, erc721, erc1155のデプロイ
    const erc20Factory = await ethers.getContractFactory("RandomERC20");
    erc20 = await erc20Factory.deploy();
    erc20.deployed();
    erc20.mint([nonExecutor.address]);

    const erc721Factory = await ethers.getContractFactory("NFTRandom");
    erc721 = await erc721Factory.deploy();
    erc721.deployed();
    erc721.mint(nonExecutor.address, 1);

    const erc1155Factory = await ethers.getContractFactory("RandomERC1155");
    erc1155 = await erc1155Factory.deploy();
    erc1155.deployed();
    erc1155.mint([nonExecutor.address]);
  });

  describe("grantExecutorRoleToQuestryPlatform", function () {
    it("[S] should be that QuestryPlatform has the executor role", async function () {
      expect(await tokenControlProxy.questryPlatform()).to.equal(
        executor.address
      );
      expect(
        await tokenControlProxy.hasRole(
          await tokenControlProxy.EXECUTOR_ROLE(),
          executor.address
        )
      ).to.equal(true);
    });

    it("[R] should not grant the executor role to another one", async function () {
      await expect(
        tokenControlProxy
          .connect(admin)
          .grantExecutorRoleToQuestryPlatform(nonExecutor.address)
      ).revertedWith("TokenControlProxy: already granted");
    });
  });

  describe("erc20safeTransferFrom", function () {
    it("[S] should transfer ERC20 token", async function () {
      const nonExecutorBalance = await erc20.balanceOf(nonExecutor.address);
      await erc20.connect(nonExecutor).approve(tokenControlProxy.address, 10);
      await tokenControlProxy
        .connect(executor)
        .erc20safeTransferFrom(
          erc20.address,
          nonExecutor.address,
          user.address,
          10
        );
      const userBalance = await erc20.balanceOf(user.address);
      const nonExecutorBalanceAfter = await erc20.balanceOf(
        nonExecutor.address
      );
      expect(userBalance).to.equal(10);
      expect(nonExecutorBalanceAfter).to.equal(nonExecutorBalance.sub(10));
    });

    it("[R] should revert with non-executor address", async function () {
      await erc20.connect(nonExecutor).approve(tokenControlProxy.address, 10);
      await expect(
        tokenControlProxy
          .connect(user)
          .erc20safeTransferFrom(
            erc20.address,
            nonExecutor.address,
            user.address,
            10
          )
      ).to.be.revertedWith(
        "TokenControlProxy: must have executor role to exec"
      );
    });

    it("[R] should revert when insufficient allowance", async function () {
      await erc20.connect(nonExecutor).approve(tokenControlProxy.address, 100);
      await expect(
        tokenControlProxy
          .connect(executor)
          .erc20safeTransferFrom(
            erc20.address,
            nonExecutor.address,
            user.address,
            1000
          )
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("[R] should revert when amount exceeds balance", async function () {
      await erc20
        .connect(nonExecutor)
        .approve(tokenControlProxy.address, 100000);
      await expect(
        tokenControlProxy
          .connect(executor)
          .erc20safeTransferFrom(
            erc20.address,
            nonExecutor.address,
            user.address,
            100000
          )
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("erc721safeTransferFrom", function () {
    it("[S] should transfer ERC721 token", async function () {
      await erc721.connect(nonExecutor).approve(tokenControlProxy.address, 1);
      await tokenControlProxy
        .connect(executor)
        .erc721safeTransferFrom(
          erc721.address,
          nonExecutor.address,
          user.address,
          1
        );
      const owner = await erc721.ownerOf(1);
      expect(owner).to.equal(user.address);
    });

    it("[R] should revert with non-executor address", async function () {
      await erc721.connect(nonExecutor).approve(tokenControlProxy.address, 1);
      await expect(
        tokenControlProxy
          .connect(user)
          .erc721safeTransferFrom(
            erc721.address,
            nonExecutor.address,
            user.address,
            1
          )
      ).to.be.revertedWith(
        "TokenControlProxy: must have executor role to exec"
      );
    });

    it("[R] should revert when caller is not token owner or approved", async function () {
      await erc721.connect(admin).mint(nonExecutor.address, 2);
      await erc721.connect(nonExecutor).approve(tokenControlProxy.address, 1);
      await expect(
        tokenControlProxy
          .connect(executor)
          .erc721safeTransferFrom(
            erc721.address,
            nonExecutor.address,
            user.address,
            2
          )
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");
    });
  });

  describe("erc1155safeTransferFrom", function () {
    it("[S] should transfer ERC1155 token", async function () {
      const nonExecutorBalance = await erc1155.balanceOf(
        nonExecutor.address,
        1
      );
      await erc1155
        .connect(nonExecutor)
        .setApprovalForAll(tokenControlProxy.address, true);
      await tokenControlProxy
        .connect(executor)
        .erc1155safeTransferFrom(
          erc1155.address,
          nonExecutor.address,
          user.address,
          1,
          10,
          "0x"
        );
      const userBalance = await erc1155.balanceOf(user.address, 1);
      const nonExecutorBalanceAfter = await erc1155.balanceOf(
        nonExecutor.address,
        1
      );
      expect(userBalance).to.equal(10);
      expect(nonExecutorBalanceAfter).to.equal(nonExecutorBalance.sub(10));
    });

    it("[R] should revert with non-executor address", async function () {
      await erc1155
        .connect(nonExecutor)
        .setApprovalForAll(tokenControlProxy.address, true);
      await expect(
        tokenControlProxy
          .connect(user)
          .erc1155safeTransferFrom(
            erc1155.address,
            nonExecutor.address,
            user.address,
            1,
            10,
            "0x"
          )
      ).to.be.revertedWith(
        "TokenControlProxy: must have executor role to exec"
      );
    });

    it("[R] should revert when insufficient balance for transfer", async function () {
      await erc1155
        .connect(nonExecutor)
        .setApprovalForAll(tokenControlProxy.address, true);
      await expect(
        tokenControlProxy
          .connect(executor)
          .erc1155safeTransferFrom(
            erc1155.address,
            nonExecutor.address,
            user.address,
            1,
            1000000,
            "0x"
          )
      ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
    });
    it("[R] should revert when token with id that user does not have nor mint", async function () {
      await erc1155
        .connect(nonExecutor)
        .setApprovalForAll(tokenControlProxy.address, true);
      await expect(
        tokenControlProxy
          .connect(executor)
          .erc1155safeTransferFrom(
            erc1155.address,
            nonExecutor.address,
            user.address,
            2,
            100,
            "0x"
          )
      ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
    });
  });

  describe("meta tx", async function () {
    describe("execute", function () {
      describe("erc20safeTransferFrom", function () {
        it("[S] should transfer ERC20 token", async function () {
          // Prepare meta-transaction
          const nonExecutorBalance = await erc20.balanceOf(nonExecutor.address);

          await erc20
            .connect(nonExecutor)
            .approve(tokenControlProxy.address, 10);
          const from = executor.address;
          const nonce: string = (
            await forwarderContract.getNonce(from)
          ).toString();
          const to = tokenControlProxy.address;
          const data = tokenControlProxy.interface.encodeFunctionData(
            "erc20safeTransferFrom",
            [erc20.address, nonExecutor.address, user.address, 10]
          );
          // get proper gas to execute meta tx
          const { metaTxForGas, signForGas } = await getMetaTxAndSignForGas(
            this.name,
            this.chainId,
            forwarderContract.address,
            from,
            to,
            nonce,
            data,
            this.value,
            this.gas
          );
          const estimatedGas: string = (
            await forwarderContract
              .connect(executor)
              .estimateGas.execute(metaTxForGas.message, signForGas)
          ).toString();
          // create typedData for sign meta tx
          const metaTx = await getMetaTx(
            this.name,
            this.chainId,
            forwarderContract.address,
            from,
            to,
            nonce,
            data,
            this.value,
            estimatedGas
          );
          const signature = await ethers.provider.send("eth_signTypedData_v4", [
            from,
            JSON.stringify(metaTx),
          ]);

          // Check if the meta-transaction was processed successfully
          await forwarderContract
            .connect(executor)
            .execute(metaTx.message, signature);
          const userBalance = await erc20.balanceOf(user.address);
          const nonExecutorBalanceAfter = await erc20.balanceOf(
            nonExecutor.address
          );
          expect(userBalance).to.equal(10);
          expect(nonExecutorBalanceAfter).to.equal(nonExecutorBalance.sub(10));
        });

        it("[R] should revert with non-executor address", async function () {
          await erc20
            .connect(nonExecutor)
            .approve(tokenControlProxy.address, 10);
          const from = executor.address;
          const nonce: string = (
            await forwarderContract.getNonce(from)
          ).toString();
          const to = tokenControlProxy.address;
          const data = tokenControlProxy.interface.encodeFunctionData(
            "erc20safeTransferFrom",
            [erc20.address, nonExecutor.address, user.address, 10]
          );
          // get proper gas to execute meta tx
          const { metaTxForGas, signForGas } = await getMetaTxAndSignForGas(
            this.name,
            this.chainId,
            forwarderContract.address,
            from,
            to,
            nonce,
            data,
            this.value,
            this.gas
          );
          const estimatedGas: string = (
            await forwarderContract
              .connect(executor)
              .estimateGas.execute(metaTxForGas.message, signForGas)
          ).toString();
          // create typedData for sign meta tx
          const metaTx = await getMetaTx(
            this.name,
            this.chainId,
            forwarderContract.address,
            from,
            to,
            nonce,
            data,
            this.value,
            estimatedGas
          );
          const signature = await ethers.provider.send("eth_signTypedData_v4", [
            from,
            JSON.stringify(metaTx),
          ]);

          // Check if the execution revert
          await expect(
            forwarderContract
              .connect(nonExecutor)
              .execute(metaTx.message, signature)
          ).to.be.revertedWith(
            `AccessControl: account ${nonExecutor.address.toLowerCase()} is missing role ${await forwarderContract.EXECUTOR_ROLE()}`
          );
        });

        it("[R] should revert when signature does not match request", async function () {
          await erc20
            .connect(nonExecutor)
            .approve(tokenControlProxy.address, 10);
          const from = executor.address;
          const nonce: string = (
            await forwarderContract.getNonce(from)
          ).toString();
          const to = tokenControlProxy.address;
          const data = tokenControlProxy.interface.encodeFunctionData(
            "erc20safeTransferFrom",
            [erc20.address, nonExecutor.address, user.address, 10]
          );
          // get proper gas to execute meta tx
          const { metaTxForGas, signForGas } = await getMetaTxAndSignForGas(
            this.name,
            this.chainId,
            forwarderContract.address,
            from,
            to,
            nonce,
            data,
            this.value,
            this.gas
          );
          const estimatedGas: string = (
            await forwarderContract
              .connect(executor)
              .estimateGas.execute(metaTxForGas.message, signForGas)
          ).toString();
          // create typedData for sign meta tx
          const metaTx = await getMetaTx(
            this.name,
            this.chainId,
            forwarderContract.address,
            from,
            to,
            nonce,
            data,
            this.value,
            estimatedGas
          );
          const signature = await ethers.provider.send("eth_signTypedData_v4", [
            from,
            JSON.stringify(metaTx),
          ]);

          // Check if the execution revert
          await expect(
            forwarderContract
              .connect(executor)
              .execute({ ...metaTx.message, nonce: 10 }, signature)
          ).to.be.revertedWith(
            "QuestryForwarder: signature does not match request"
          );
        });
      });

      describe("erc721safeTransferFrom", function () {
        it("[S] should transfer ERC721 token", async function () {
          // Prepare meta-transaction
          await erc721
            .connect(nonExecutor)
            .approve(tokenControlProxy.address, 1);

          const from = executor.address;
          const nonce: string = (
            await forwarderContract.getNonce(from)
          ).toString();
          const to = tokenControlProxy.address;
          const data = tokenControlProxy.interface.encodeFunctionData(
            "erc721safeTransferFrom",
            [erc721.address, nonExecutor.address, user.address, 1]
          );
          // get proper gas to execute meta tx
          const { metaTxForGas, signForGas } = await getMetaTxAndSignForGas(
            this.name,
            this.chainId,
            forwarderContract.address,
            from,
            to,
            nonce,
            data,
            this.value,
            this.gas
          );
          const estimatedGas: string = (
            await forwarderContract
              .connect(executor)
              .estimateGas.execute(metaTxForGas.message, signForGas)
          ).toString();
          // create typedData for sign meta tx
          const metaTx = await getMetaTx(
            this.name,
            this.chainId,
            forwarderContract.address,
            from,
            to,
            nonce,
            data,
            this.value,
            estimatedGas
          );
          const signature = await ethers.provider.send("eth_signTypedData_v4", [
            from,
            JSON.stringify(metaTx),
          ]);

          // Check if the meta-transaction was processed successfully
          await forwarderContract
            .connect(executor)
            .execute(metaTx.message, signature);
          const owner = await erc721.ownerOf(1);
          expect(owner).to.equal(user.address);
        });

        it("[R] should revert when signature does not match request", async function () {
          await erc721.connect(nonExecutor).mint(nonExecutor.address, 2);
          await erc721
            .connect(nonExecutor)
            .approve(tokenControlProxy.address, 2);
          const from = executor.address;
          const nonce: string = (
            await forwarderContract.getNonce(from)
          ).toString();
          const to = tokenControlProxy.address;
          const data = tokenControlProxy.interface.encodeFunctionData(
            "erc721safeTransferFrom",
            [erc721.address, nonExecutor.address, user.address, 2]
          );
          // get proper gas to execute meta tx
          const { metaTxForGas, signForGas } = await getMetaTxAndSignForGas(
            this.name,
            this.chainId,
            forwarderContract.address,
            from,
            to,
            nonce,
            data,
            this.value,
            this.gas
          );
          const estimatedGas: string = (
            await forwarderContract
              .connect(executor)
              .estimateGas.execute(metaTxForGas.message, signForGas)
          ).toString();
          // create typedData for sign meta tx
          const metaTx = await getMetaTx(
            this.name,
            this.chainId,
            forwarderContract.address,
            from,
            to,
            nonce,
            data,
            this.value,
            estimatedGas
          );
          const signature = await ethers.provider.send("eth_signTypedData_v4", [
            from,
            JSON.stringify(metaTx),
          ]);

          // Check if the execution revert
          await expect(
            forwarderContract
              .connect(executor)
              .execute(
                { ...metaTx.message, from: nonExecutor.address },
                signature
              )
          ).to.be.revertedWith(
            "QuestryForwarder: signature does not match request"
          );
        });
      });

      describe("erc1155safeTransferFrom", function () {
        it("[S] should transfer ERC1155 token", async function () {
          // Prepare meta-transaction
          const nonExecutorBalance = await erc1155.balanceOf(
            nonExecutor.address,
            1
          );
          await erc1155
            .connect(nonExecutor)
            .setApprovalForAll(tokenControlProxy.address, true);
          const from = executor.address;
          const nonce: string = (
            await forwarderContract.getNonce(from)
          ).toString();
          const to = tokenControlProxy.address;
          const data = tokenControlProxy.interface.encodeFunctionData(
            "erc1155safeTransferFrom",
            [erc1155.address, nonExecutor.address, user.address, 1, 10, "0x"]
          );
          // get proper gas to execute meta tx
          const { metaTxForGas, signForGas } = await getMetaTxAndSignForGas(
            this.name,
            this.chainId,
            forwarderContract.address,
            from,
            to,
            nonce,
            data,
            this.value,
            this.gas
          );
          const estimatedGas: string = (
            await forwarderContract
              .connect(executor)
              .estimateGas.execute(metaTxForGas.message, signForGas)
          ).toString();
          // create typedData for sign meta tx
          const metaTx = await getMetaTx(
            this.name,
            this.chainId,
            forwarderContract.address,
            from,
            to,
            nonce,
            data,
            this.value,
            estimatedGas
          );
          const signature = await ethers.provider.send("eth_signTypedData_v4", [
            from,
            JSON.stringify(metaTx),
          ]);

          // Check if the meta-transaction was processed successfully
          await forwarderContract
            .connect(executor)
            .execute(metaTx.message, signature);
          const userBalance = await erc1155.balanceOf(user.address, 1);
          const nonExecutorBalanceAfter = await erc1155.balanceOf(
            nonExecutor.address,
            1
          );
          expect(userBalance).to.equal(10);
          expect(nonExecutorBalanceAfter).to.equal(nonExecutorBalance.sub(10));
        });

        it("[R] should revert when signature does not match request", async function () {
          // Prepare meta-transaction
          await erc1155
            .connect(nonExecutor)
            .setApprovalForAll(tokenControlProxy.address, true);
          const from = executor.address;
          const nonce: string = (
            await forwarderContract.getNonce(from)
          ).toString();
          const to = tokenControlProxy.address;
          const data = tokenControlProxy.interface.encodeFunctionData(
            "erc1155safeTransferFrom",
            [erc1155.address, nonExecutor.address, user.address, 1, 10, "0x"]
          );
          // get proper gas to execute meta tx
          const { metaTxForGas, signForGas } = await getMetaTxAndSignForGas(
            this.name,
            this.chainId,
            forwarderContract.address,
            from,
            to,
            nonce,
            data,
            this.value,
            this.gas
          );
          const estimatedGas: string = (
            await forwarderContract
              .connect(executor)
              .estimateGas.execute(metaTxForGas.message, signForGas)
          ).toString();
          // create typedData for sign meta tx
          const metaTx = await getMetaTx(
            this.name,
            this.chainId,
            forwarderContract.address,
            from,
            to,
            nonce,
            data,
            this.value,
            estimatedGas
          );
          const signature = await ethers.provider.send("eth_signTypedData_v4", [
            from,
            JSON.stringify(metaTx),
          ]);

          // Check if the execution revert
          await expect(
            forwarderContract
              .connect(executor)
              .execute(
                { ...metaTx.message, from: nonExecutor.address },
                signature
              )
          ).to.be.revertedWith(
            "QuestryForwarder: signature does not match request"
          );
        });
      });
    });
  });
});
