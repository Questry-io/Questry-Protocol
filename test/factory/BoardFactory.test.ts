/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BoardFactory, PJManagerFactory } from "../../typechain";

describe("BoardFactory", function () {
  let deployer: SignerWithAddress;
  let boardFactoryAdmin: SignerWithAddress;
  let setForwarderer: SignerWithAddress;
  let user: SignerWithAddress;
  let pjManagerAdmin: SignerWithAddress;
  let cBoardFactory: BoardFactory;
  let cPJManagerFactory: PJManagerFactory;
  let pjManagerAddress: string;

  const boardExistsError = "BoardFactory: must use another name and symbol";
  const setForwarderRoleError = "BoardFactory: must have SET_FORWARDER_ROLE";

  const name = "SugaiYuuka";
  const symbol = "SY";
  const baseURI = "https://sample.com/";

  const dummyContract = "0x00E9C198af8F6a8692d83d1702e691A03F2cdc63";

  beforeEach(async function () {
    [deployer, setForwarderer, user, boardFactoryAdmin, pjManagerAdmin] =
      await ethers.getSigners();

    const cfPJManagerFactory = await ethers.getContractFactory(
      "PJManagerFactory"
    );
    cPJManagerFactory = await cfPJManagerFactory.deploy(
      ethers.constants.AddressZero,
      ethers.constants.AddressZero
    );
    await cPJManagerFactory.deployed();

    await cPJManagerFactory
      .connect(pjManagerAdmin)
      .createPJManager(10000, ethers.constants.AddressZero);
    pjManagerAddress = (
      await cPJManagerFactory.getPJManagers(pjManagerAdmin.address)
    )[0];

    const cfBoardFactory = await ethers.getContractFactory("BoardFactory");
    cBoardFactory = await cfBoardFactory.deploy(
      cPJManagerFactory.address,
      boardFactoryAdmin.address
    );
    await cBoardFactory.deployed();

    const forwarderRole = await cBoardFactory.SET_FORWARDER_ROLE();
    await cBoardFactory
      .connect(boardFactoryAdmin)
      .grantRole(forwarderRole, setForwarderer.address);
  });

  describe("Post deployment checks", function () {
    it("Admin Role Check", async function () {
      expect(
        await cBoardFactory.hasRole(
          ethers.constants.HashZero,
          boardFactoryAdmin.address
        )
      ).to.be.true;
    });
  });

  describe("createBoard", function () {
    it("[S] check Board address stored", async function () {
      await cBoardFactory
        .connect(pjManagerAdmin)
        .createBoard(
          name,
          symbol,
          baseURI,
          pjManagerAddress,
          [ethers.constants.AddressZero],
          pjManagerAdmin.address
        );
      const board = await cBoardFactory.getContractAddress(name, symbol);
      expect(board).not.equal(ethers.constants.AddressZero);
    });

    it("[S] check event emitted", async function () {
      const tx = await cBoardFactory
        .connect(pjManagerAdmin)
        .createBoard(
          name,
          symbol,
          baseURI,
          pjManagerAddress,
          [ethers.constants.AddressZero],
          pjManagerAdmin.address
        );
      const board = await cBoardFactory.getContractAddress(name, symbol);
      expect(tx)
        .to.emit(cBoardFactory, "BoardCreated")
        .withArgs(
          board,
          name,
          symbol,
          pjManagerAddress,
          pjManagerAdmin.address
        );
    });

    it("[R] check createBoard by not admin error", async function () {
      await expect(
        cBoardFactory
          .connect(user)
          .createBoard(
            name,
            symbol,
            baseURI,
            pjManagerAddress,
            [ethers.constants.AddressZero],
            pjManagerAdmin.address
          )
      ).revertedWith("BoardFactory: only PJManager admin can create Board");
    });

    it("[R] check Board exists error", async function () {
      await cBoardFactory
        .connect(pjManagerAdmin)
        .createBoard(
          name,
          symbol,
          baseURI,
          pjManagerAddress,
          [ethers.constants.AddressZero],
          pjManagerAdmin.address
        );
      await cBoardFactory.getContractAddress(name, symbol);
      await expect(
        cBoardFactory
          .connect(pjManagerAdmin)
          .createBoard(
            name,
            symbol,
            baseURI,
            pjManagerAddress,
            [ethers.constants.AddressZero],
            pjManagerAdmin.address
          )
      ).to.be.revertedWith(boardExistsError);
    });
  });

  describe("setChildTrustedforwarder", function () {
    it("[S] can update forwarder by factory admin", async function () {
      await cBoardFactory
        .connect(boardFactoryAdmin)
        .setChildTrustedForwarder(dummyContract);
      expect(await cBoardFactory.getChildTrustedForwarder()).to.be.equal(
        dummyContract
      );
    });

    it("[S] can update forwarder by set-forwarder-role account", async function () {
      await cBoardFactory
        .connect(setForwarderer)
        .setChildTrustedForwarder(dummyContract);
      expect(await cBoardFactory.getChildTrustedForwarder()).to.be.equal(
        dummyContract
      );
    });

    it("[R] can not update forwarder by no role account", async function () {
      await expect(
        cBoardFactory.connect(user).setChildTrustedForwarder(dummyContract)
      ).to.be.revertedWith(setForwarderRoleError);
    });
  });
});
