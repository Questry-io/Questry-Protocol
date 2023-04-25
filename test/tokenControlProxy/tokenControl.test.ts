/* eslint-disable node/no-missing-import */
import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { RandomERC20, NFTRandom, RandomERC1155 } from "../../typechain";

describe("TokenControllProxy", function () {
  let admin: SignerWithAddress;
  let forwarder: SignerWithAddress;
  let executor: SignerWithAddress;
  let nonExecutor: SignerWithAddress;
  let user: SignerWithAddress;
  let tokenControlProxy: Contract;
  let erc20: RandomERC20;
  let erc721: NFTRandom;
  let erc1155: RandomERC1155;

  beforeEach(async function () {
    [admin, forwarder, executor, nonExecutor, user] = await ethers.getSigners();

    // tokenControlProxyのデプロイ
    const TokenControlProxy = await ethers.getContractFactory(
      "TokenControllProxy"
    );

    tokenControlProxy = await upgrades.deployProxy(
      TokenControlProxy,
      [admin.address],
      {
        initializer: "__TokenControlProxy_init",
        constructorArgs: [forwarder.address],
      }
    );
    await tokenControlProxy.deployed();
    await tokenControlProxy
      .connect(admin)
      .grantRole(await tokenControlProxy.EXECUTOR_ROLE(), executor.address);

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
        "TokenControllProxy: must have executor role to exec"
      );
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
        "TokenControllProxy: must have executor role to exec"
      );
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
        "TokenControllProxy: must have executor role to exec"
      );
    });
  });
});
