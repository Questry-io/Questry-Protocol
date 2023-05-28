/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import * as chai from "chai";
import { utils } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  ContributionCalculator,
  ContributionCalculator__factory,
  ContributionPool,
  ContributionPool__factory,
  RandomERC20,
  RandomERC20__factory,
  Board__factory,
  PJManager__factory,
  MockCallerContract__factory,
  MockCallerContract,
  PJManager,
  Board,
} from "../../typechain";
import { AllocateArgs, TestUtils } from "../testUtils";
import { solidity } from "ethereum-waffle";

chai.use(solidity);

describe("PJManager", function () {
  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let signer: SignerWithAddress;
  let signer2: SignerWithAddress;
  let signer3: SignerWithAddress;
  let stateManager: SignerWithAddress;
  let whitelistController: SignerWithAddress;
  let depositer: SignerWithAddress;
  let boardMinter: SignerWithAddress;
  let businessOwner: SignerWithAddress;
  let user: SignerWithAddress;
  let cMockQuestryPlatform: MockCallerContract;
  let cCalculator: ContributionCalculator;
  let cContributionPool: ContributionPool;

  const maxBasisPoint = 10000;

  const nativeMode = utils.keccak256(utils.toUtf8Bytes("NATIVE")).slice(0, 10);
  const erc20Mode = utils.keccak256(utils.toUtf8Bytes("ERC20")).slice(0, 10);

  const withdrawRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PJ_WITHDRAW_ROLE")
  );

  const managementRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PJ_MANAGEMENT_ROLE")
  );

  const depositRoleHash = utils.keccak256(utils.toUtf8Bytes("PJ_DEPOSIT_ROLE"));

  const whitelistRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PJ_WHITELIST_ROLE")
  );

  const boardIdRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PJ_BOARD_ID_ROLE")
  );

  const SignerRoleHash = utils.keccak256(utils.toUtf8Bytes("PJ_VERIFY_SIGNER"));

  function missingRoleError(address: string, roleHash: string) {
    return `AccessControl: account ${address.toLowerCase()} is missing role ${roleHash}`;
  }

  async function deployPJManager(_boardingMembersProportion: number) {
    const cPJManager = await new PJManager__factory(deployer).deploy(
      cMockQuestryPlatform.address,
      admin.address,
      _boardingMembersProportion,
      businessOwner.address
    );
    await cPJManager.deployed();

    // assign roles
    await cPJManager
      .connect(admin)
      .grantRole(managementRoleHash, stateManager.address);
    await cPJManager
      .connect(admin)
      .grantRole(whitelistRoleHash, whitelistController.address);

    // deploy Board associated with the project.
    const cBoard = await new Board__factory(deployer).deploy(
      "board",
      "BRD",
      "https://example.com",
      cPJManager.address,
      cContributionPool.address,
      boardMinter.address,
      ethers.constants.AddressZero
    );
    await cBoard.deployed();

    // deploy mock ERC20
    const cERC20 = await new RandomERC20__factory(deployer).deploy();
    await cERC20.mint([depositer.address, admin.address]);
    await cERC20.connect(depositer).approve(cPJManager.address, 100);
    await cERC20.connect(admin).approve(cPJManager.address, 100);

    return {
      cPJManager,
      cBoard,
      cERC20,
    };
  }

  async function deployDummyPJManager() {
    return await deployPJManager(0);
  }

  beforeEach(async function () {
    [
      deployer,
      admin,
      signer,
      signer2,
      signer3,
      stateManager,
      whitelistController,
      depositer,
      boardMinter,
      user,
      businessOwner,
    ] = await ethers.getSigners();

    cMockQuestryPlatform = await new MockCallerContract__factory(
      deployer
    ).deploy();

    cCalculator = await new ContributionCalculator__factory(deployer).deploy();
    await cCalculator.deployed();

    cContributionPool = await new ContributionPool__factory(deployer).deploy(
      cMockQuestryPlatform.address,
      0,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero
    );
    await cContributionPool.deployed();
  });

  describe("constructor", function () {
    it("[S] should deploy if boardingMembersProportion is 0", async function () {
      await deployPJManager(0);
    });

    it("[S] should deploy if boardingMembersProportion is 4000", async function () {
      await deployPJManager(4000);
    });

    it("[S] should deploy if boardingMembersProportion is _boardingMemberProportionDenominator()", async function () {
      await deployPJManager(maxBasisPoint);
    });

    it("[R] should not deploy if boardingMembersProportion is over _boardingMemberProportionDenominator()", async function () {
      await expect(deployPJManager(maxBasisPoint + 1)).revertedWith(
        "LibPJManager: proportion is out of range"
      );
    });
  });

  describe("registerBoard", function () {
    let cPJManager: PJManager;
    let cBoard: Board;

    beforeEach(async function () {
      ({ cPJManager, cBoard } = await deployPJManager(4000));
    });

    it("[S] should registerBoard by stateManager", async function () {
      const tx = await cPJManager
        .connect(stateManager)
        .registerBoard(cBoard.address);
      const got = await cPJManager.getBoards();
      expect(got.length).equals(1);
      expect(got[0]).equals(cBoard.address);
      expect(tx).to.emit(cPJManager, "RegisterBoard").withArgs(cBoard.address);
    });

    it("[S] should register multiple boards by stateManager", async function () {
      const cBoard2 = await new Board__factory(deployer).deploy(
        "board2",
        "BRD2",
        "https://example.com",
        cPJManager.address,
        ethers.constants.AddressZero,
        boardMinter.address,
        ethers.constants.AddressZero
      );
      await cPJManager.connect(stateManager).registerBoard(cBoard.address);
      await cPJManager.connect(stateManager).registerBoard(cBoard2.address);
      const got = await cPJManager.getBoards();
      expect(got.length).equals(2);
      expect(got[0]).equals(cBoard.address);
      expect(got[1]).equals(cBoard2.address);
    });

    it("[S] should registerBoard by admin", async function () {
      await cPJManager.connect(admin).registerBoard(cBoard.address);
      const got = await cPJManager.getBoards();
      expect(got.length).equals(1);
      expect(got[0]).equals(cBoard.address);
    });

    it("[R] should not registerBoard by others", async function () {
      await expect(
        cPJManager.connect(user).registerBoard(cBoard.address)
      ).revertedWith("Invalid executor role");
    });

    it("[R] should not register the same board two times", async function () {
      await cPJManager.connect(stateManager).registerBoard(cBoard.address);
      await expect(
        cPJManager.connect(stateManager).registerBoard(cBoard.address)
      ).revertedWith("PJManager: board already exists");
    });
  });

  describe("verifysignature (unit test)", function () {
    let cPJManager: PJManager;
    let cERC20: RandomERC20;
    let cBoard: Board;
    let cContributionPool: ContributionPool;
    let cContributionPool2: ContributionPool;

    beforeEach(async function () {
      ({ cPJManager, cERC20, cBoard } = await deployPJManager(4000));

      cContributionPool = await new ContributionPool__factory(deployer).deploy(
        cMockQuestryPlatform.address,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        signer.address
      );
      await cContributionPool.deployed();

      cContributionPool2 = await new ContributionPool__factory(deployer).deploy(
        cMockQuestryPlatform.address,
        0,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        signer.address
      );
      await cContributionPool2.deployed();
    });

    it("[S] signature verifyer success on single signature", async function () {
      await cPJManager.connect(admin).grantRole(SignerRoleHash, signer.address);
      expect(
        await cPJManager.hasRole(SignerRoleHash, signer.address)
      ).to.be.equal(true);
      const SharesWithLinearArgs = {
        pools: [cContributionPool.address, cContributionPool2.address],
        coefs: [2, 3],
      };

      const args: AllocateArgs = {
        pjManager: cPJManager.address,
        paymentMode: erc20Mode,
        paymentToken: cERC20.address,
        board: cBoard.address,
        calculateArgs: TestUtils.createArgsWithLinear(SharesWithLinearArgs),
        updateNeededPools: [
          cContributionPool.address,
          cContributionPool2.address,
        ],
        pjnonce: Number(await cPJManager.getNonce()).toString(),
      };

      // EIP712 create domain separator
      const domain = {
        name: "QUESTRY_PLATFORM",
        version: "1.0",
        chainId: await signer.getChainId(),
        verifyingContract: cPJManager.address,
      };

      const types2 = {
        AllocateArgs: [
          { name: "pjManager", type: "address" },
          { name: "paymentMode", type: "bytes4" },
          { name: "paymentToken", type: "address" },
          { name: "board", type: "address" },
          { name: "calculateArgs", type: "CalculateDispatchArgs" },
          { name: "updateNeededPools", type: "address[]" },
          { name: "pjnonce", type: "uint256" },
        ],
        CalculateDispatchArgs: [
          { name: "algorithm", type: "bytes4" },
          { name: "args", type: "bytes" },
        ],
      };

      const message = await signer._signTypedData(domain, types2, args);
      const recoverAddress = ethers.utils.verifyTypedData(
        domain,
        types2,
        args,
        message
      );
      expect(await cPJManager.verifySignature(args, [message])).deep.equal([
        signer.address,
      ]);
    });

    it("[S] signature verifyer success on Multi signature", async function () {
      await cPJManager.connect(admin).grantRole(SignerRoleHash, signer.address);
      await cPJManager
        .connect(admin)
        .grantRole(SignerRoleHash, signer2.address);
      expect(
        await cPJManager.hasRole(SignerRoleHash, signer.address)
      ).to.be.equal(true);
      expect(
        await cPJManager.hasRole(SignerRoleHash, signer2.address)
      ).to.be.equal(true);

      // Set sig threshold
      expect(await cPJManager.getThreshold()).to.be.equal(1);
      await cPJManager.connect(admin).setThreshold(2);
      expect(await cPJManager.getThreshold()).to.be.equal(2);

      // signeture message parameta
      const SharesWithLinearArgs = {
        pools: [cContributionPool.address, cContributionPool2.address],
        coefs: [2, 3],
      };

      const args: AllocateArgs = {
        pjManager: cPJManager.address,
        paymentMode: erc20Mode,
        paymentToken: cERC20.address,
        board: cBoard.address,
        calculateArgs: TestUtils.createArgsWithLinear(SharesWithLinearArgs),
        updateNeededPools: [
          cContributionPool.address,
          cContributionPool2.address,
        ],
        pjnonce: Number(await cPJManager.getNonce()).toString(),
      };

      // EIP712 create domain separator
      const domain = {
        name: "QUESTRY_PLATFORM",
        version: "1.0",
        chainId: await signer.getChainId(),
        verifyingContract: cPJManager.address,
      };

      const types2 = {
        AllocateArgs: [
          { name: "pjManager", type: "address" },
          { name: "paymentMode", type: "bytes4" },
          { name: "paymentToken", type: "address" },
          { name: "board", type: "address" },
          { name: "calculateArgs", type: "CalculateDispatchArgs" },
          { name: "updateNeededPools", type: "address[]" },
          { name: "pjnonce", type: "uint256" },
        ],
        CalculateDispatchArgs: [
          { name: "algorithm", type: "bytes4" },
          { name: "args", type: "bytes" },
        ],
      };

      const message = await signer._signTypedData(domain, types2, args);
      const message2 = await signer2._signTypedData(domain, types2, args);

      expect(
        await cPJManager.verifySignature(args, [message, message2])
      ).deep.equal([signer.address, signer2.address]);
    });

    it("[S] signature verifyer success on Multi signature (2 of 3)", async function () {
      await cPJManager.connect(admin).grantRole(SignerRoleHash, signer.address);
      await cPJManager
        .connect(admin)
        .grantRole(SignerRoleHash, signer2.address);
      await cPJManager
        .connect(admin)
        .grantRole(SignerRoleHash, signer3.address);
      expect(
        await cPJManager.hasRole(SignerRoleHash, signer.address)
      ).to.be.equal(true);
      expect(
        await cPJManager.hasRole(SignerRoleHash, signer2.address)
      ).to.be.equal(true);
      expect(
        await cPJManager.hasRole(SignerRoleHash, signer3.address)
      ).to.be.equal(true);

      // Set sig threshold
      expect(await cPJManager.getThreshold()).to.be.equal(1);
      await cPJManager.connect(admin).setThreshold(2);
      expect(await cPJManager.getThreshold()).to.be.equal(2);

      // signeture message parameta
      const SharesWithLinearArgs = {
        pools: [cContributionPool.address, cContributionPool2.address],
        coefs: [2, 3],
      };

      // diff equal paymnetmode is native
      const dummyargs: AllocateArgs = {
        pjManager: cPJManager.address,
        paymentMode: nativeMode,
        paymentToken: cERC20.address,
        board: cBoard.address,
        calculateArgs: TestUtils.createArgsWithLinear(SharesWithLinearArgs),
        updateNeededPools: [
          cContributionPool.address,
          cContributionPool2.address,
        ],
        pjnonce: Number(await cPJManager.getNonce()).toString(),
      };

      const args: AllocateArgs = {
        pjManager: cPJManager.address,
        paymentMode: erc20Mode,
        paymentToken: cERC20.address,
        board: cBoard.address,
        calculateArgs: TestUtils.createArgsWithLinear(SharesWithLinearArgs),
        updateNeededPools: [
          cContributionPool.address,
          cContributionPool2.address,
        ],
        pjnonce: Number(await cPJManager.getNonce()).toString(),
      };

      // EIP712 create domain separator
      const domain = {
        name: "QUESTRY_PLATFORM",
        version: "1.0",
        chainId: await signer.getChainId(),
        verifyingContract: cPJManager.address,
      };

      const types2 = {
        AllocateArgs: [
          { name: "pjManager", type: "address" },
          { name: "paymentMode", type: "bytes4" },
          { name: "paymentToken", type: "address" },
          { name: "board", type: "address" },
          { name: "calculateArgs", type: "CalculateDispatchArgs" },
          { name: "updateNeededPools", type: "address[]" },
          { name: "pjnonce", type: "uint256" },
        ],
        CalculateDispatchArgs: [
          { name: "algorithm", type: "bytes4" },
          { name: "args", type: "bytes" },
        ],
      };

      const dummymessage = await signer._signTypedData(
        domain,
        types2,
        dummyargs
      );
      const message2 = await signer2._signTypedData(domain, types2, args);
      const message3 = await signer3._signTypedData(domain, types2, args);
      expect(
        await cPJManager.verifySignature(args, [
          dummymessage,
          message2,
          message3,
        ])
      ).deep.equal([signer2.address, signer3.address]);

      expect(
        await cPJManager.verifySignature(args, [
          message2,
          dummymessage,
          message3,
        ])
      ).deep.equal([signer2.address, signer3.address]);

      expect(
        await cPJManager.verifySignature(args, [
          message2,
          message3,
          dummymessage,
        ])
      ).deep.equal([signer2.address, signer3.address]);

      // reverted for threshold is not short sig verify
      await expect(
        cPJManager.verifySignature(args, [dummymessage, dummymessage, message3])
      ).revertedWith("PJManager: fall short of threshold for verify");
    });

    it("[R] signature verifyer reverted not has roll", async function () {
      expect(
        await cPJManager.hasRole(SignerRoleHash, signer.address)
      ).to.be.equal(false);
      const SharesWithLinearArgs = {
        pools: [cContributionPool.address, cContributionPool2.address],
        coefs: [2, 3],
      };

      const args: AllocateArgs = {
        pjManager: cPJManager.address,
        paymentMode: erc20Mode,
        paymentToken: cERC20.address,
        board: cBoard.address,
        calculateArgs: TestUtils.createArgsWithLinear(SharesWithLinearArgs),
        updateNeededPools: [
          cContributionPool.address,
          cContributionPool2.address,
        ],
        pjnonce: Number(await cPJManager.getNonce()).toString(),
      };

      // EIP712 create domain separator
      const domain = {
        name: "QUESTRY_PLATFORM",
        version: "1.0",
        chainId: await signer.getChainId(),
        verifyingContract: cPJManager.address,
      };

      const types2 = {
        AllocateArgs: [
          { name: "pjManager", type: "address" },
          { name: "paymentMode", type: "bytes4" },
          { name: "paymentToken", type: "address" },
          { name: "board", type: "address" },
          { name: "calculateArgs", type: "CalculateDispatchArgs" },
          { name: "updateNeededPools", type: "address[]" },
          { name: "pjnonce", type: "uint256" },
        ],
        CalculateDispatchArgs: [
          { name: "algorithm", type: "bytes4" },
          { name: "args", type: "bytes" },
        ],
      };

      const message = await signer._signTypedData(domain, types2, args);
      await expect(cPJManager.verifySignature(args, [message])).revertedWith(
        "PJManager: fall short of threshold for verify"
      );
    });

    it("[R] signature verifyer reverted not has roll", async function () {
      expect(
        await cPJManager.hasRole(SignerRoleHash, signer.address)
      ).to.be.equal(false);
      const SharesWithLinearArgs = {
        pools: [cContributionPool.address, cContributionPool2.address],
        coefs: [2, 3],
      };

      const args: AllocateArgs = {
        pjManager: cPJManager.address,
        paymentMode: erc20Mode,
        paymentToken: cERC20.address,
        board: cBoard.address,
        calculateArgs: TestUtils.createArgsWithLinear(SharesWithLinearArgs),
        updateNeededPools: [
          cContributionPool.address,
          cContributionPool2.address,
        ],
        pjnonce: Number(await cPJManager.getNonce()).toString(),
      };

      // EIP712 create domain separator
      const domain = {
        name: "QUESTRY_PLATFORM",
        version: "1.0",
        chainId: await signer.getChainId(),
        verifyingContract: cPJManager.address,
      };

      const types2 = {
        AllocateArgs: [
          { name: "pjManager", type: "address" },
          { name: "paymentMode", type: "bytes4" },
          { name: "paymentToken", type: "address" },
          { name: "board", type: "address" },
          { name: "calculateArgs", type: "CalculateDispatchArgs" },
          { name: "updateNeededPools", type: "address[]" },
          { name: "pjnonce", type: "uint256" },
        ],
        CalculateDispatchArgs: [
          { name: "algorithm", type: "bytes4" },
          { name: "args", type: "bytes" },
        ],
      };

      const message = await signer._signTypedData(domain, types2, args);
      await expect(cPJManager.verifySignature(args, [message])).revertedWith(
        "PJManager: fall short of threshold for verify"
      );
    });
  });

  describe("getNonce", function () {
    let cPJManager: PJManager;

    beforeEach(async function () {
      ({ cPJManager } = await deployPJManager(4000));
    });

    it("[S] get nonce state", async function () {
      // Get Nonce
      expect(await cPJManager.getNonce()).to.be.equal(0);
    });

    it("[S] increment check", async function () {
      // Questry platform test
    });

    it("[R] Reverted increment check (Not has roll)", async function () {
      // Get Nonce
      expect(await cPJManager.getNonce()).to.be.equal(0);
      await expect(cPJManager.connect(signer).incrementNonce()).to.be.reverted;
    });
  });

  describe("setThreshold", function () {
    let cPJManager: PJManager;

    beforeEach(async function () {
      ({ cPJManager } = await deployPJManager(4000));
    });

    it("[S] set sig threshold check", async function () {
      // Set sig threshold
      expect(await cPJManager.getThreshold()).to.be.equal(1);
      await cPJManager.connect(admin).setThreshold(2);
      expect(await cPJManager.getThreshold()).to.be.equal(2);
    });

    it("[R] Not has roll signer", async function () {
      // Set sig threshold
      expect(await cPJManager.getThreshold()).to.be.equal(1);
      await expect(cPJManager.connect(signer).setThreshold(2)).to.be.reverted;
      expect(await cPJManager.getThreshold()).to.be.equal(1);

      /**
       * comment : The data that appears in the test in the local environment of each engineer is different, so it is to.be.reverted
       */
    });

    it("[R] reverted for zero set transaction", async function () {
      // Set sig threshold
      expect(await cPJManager.getThreshold()).to.be.equal(1);
      await expect(cPJManager.connect(admin).setThreshold(0)).revertedWith(
        "PJManager :threshold does not set zero"
      );
    });
  });

  describe("allowERC20", function () {
    let cPJManager: PJManager;
    let cERC20: RandomERC20;
    let cDummyERC20: RandomERC20;

    beforeEach(async function () {
      ({ cPJManager, cERC20 } = await deployDummyPJManager());
      // deploy additional mock ERC20
      cDummyERC20 = await new RandomERC20__factory(deployer).deploy();
    });

    it("[S] should allow by whitelistController", async function () {
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      expect(await cPJManager.getTokenWhitelists()).deep.equals([
        cERC20.address,
      ]);

      await cPJManager
        .connect(whitelistController)
        .allowERC20(cDummyERC20.address);
      expect(await cPJManager.getTokenWhitelists()).deep.equals([
        cERC20.address,
        cDummyERC20.address,
      ]);
      expect(await cPJManager.isWhitelisted(cDummyERC20.address)).true;
    });

    it("[S] should allow by admin", async function () {
      await cPJManager.connect(admin).allowERC20(cERC20.address);
      expect(await cPJManager.getTokenWhitelists()).deep.equals([
        cERC20.address,
      ]);
      expect(await cPJManager.isWhitelisted(cERC20.address)).true;
    });

    it("[R] should not allow by others", async function () {
      await expect(
        cPJManager.connect(user).allowERC20(cERC20.address)
      ).revertedWith("Invalid executor role");
    });

    it("[R] should not allow if token is not a contract", async function () {
      await expect(
        cPJManager
          .connect(whitelistController)
          .allowERC20(ethers.Wallet.createRandom().address)
      ).revertedWith("PJTreasuryPool: token is not a contract");
    });

    it("[R] should not allow if token is already whitelisted", async function () {
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await expect(
        cPJManager.connect(whitelistController).allowERC20(cERC20.address)
      ).revertedWith("PJTreasuryPool: already whitelisted");
    });
  });

  describe("disallowERC20", function () {
    let cPJManager: PJManager;
    let cERC20: RandomERC20;
    let cDummyERC20: RandomERC20;

    beforeEach(async function () {
      ({ cPJManager, cERC20 } = await deployDummyPJManager());
      // deploy additional mock ERC20
      cDummyERC20 = await new RandomERC20__factory(deployer).deploy();
    });

    it("[S] should disallow by whitelistController", async function () {
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cPJManager
        .connect(whitelistController)
        .disallowERC20(cERC20.address);
      expect(await cPJManager.getTokenWhitelists()).deep.equals([]);
      expect(await cPJManager.isWhitelisted(cERC20.address)).false;
    });

    it("[S] should disallow by admin", async function () {
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cPJManager.connect(admin).disallowERC20(cERC20.address);
      expect(await cPJManager.getTokenWhitelists()).deep.equals([]);
      expect(await cPJManager.isWhitelisted(cERC20.address)).false;
    });

    it("[S] should disallow even if not allowed the most recently", async function () {
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cPJManager
        .connect(whitelistController)
        .allowERC20(cDummyERC20.address);
      expect(await cPJManager.getTokenWhitelists()).deep.equals([
        cERC20.address,
        cDummyERC20.address,
      ]);
      await cPJManager
        .connect(whitelistController)
        .disallowERC20(cERC20.address);
      expect(await cPJManager.getTokenWhitelists()).deep.equals([
        cDummyERC20.address,
      ]);
      expect(await cPJManager.isWhitelisted(cERC20.address)).false;
    });

    it("[R] should not disallow if the whitelist is empty", async function () {
      await expect(
        cPJManager.connect(whitelistController).disallowERC20(cERC20.address)
      ).revertedWith("PJTreasuryPool: not whitelisted");
    });

    it("[R] should not disallow by others", async function () {
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await expect(
        cPJManager.connect(user).disallowERC20(cERC20.address)
      ).revertedWith("Invalid executor role");
    });
  });

  describe("deposit native token", function () {
    let cPJManager: PJManager;

    beforeEach(async function () {
      ({ cPJManager } = await deployDummyPJManager());
    });

    it("[R] should not deposit native tokens directly", async function () {
      await expect(
        depositer.sendTransaction({
          to: cPJManager.address,
          value: 2,
        })
      ).revertedWith(
        "function selector was not recognized and there's no fallback nor receive function"
      );

      await expect(
        admin.sendTransaction({
          to: cPJManager.address,
          value: 2,
        })
      ).revertedWith(
        "function selector was not recognized and there's no fallback nor receive function"
      );
    });

    it("[S] should deposit native tokens by QuestryPlatform", async function () {
      const tx = await TestUtils.callAndSend(
        cMockQuestryPlatform,
        cPJManager,
        "deposit(bytes4 _paymentMode,address _paymentToken,address _from,uint256 _amount)",
        [nativeMode, ethers.constants.AddressZero, depositer.address, 2],
        { value: 2 }
      );
      expect(
        await cPJManager.getTotalBalance(
          nativeMode,
          ethers.constants.AddressZero
        )
      ).equals(2);
      expect(await ethers.provider.getBalance(cPJManager.address)).equals(2);
      expect(tx).to.emit(cPJManager, "Deposit").withArgs(depositer.address, 2);
    });

    it("[R] should not deposit native tokens by others", async function () {
      await expect(
        cPJManager
          .connect(user)
          .deposit(nativeMode, ethers.constants.AddressZero, user.address, 2, {
            value: 2,
          })
      ).revertedWith(missingRoleError(user.address, depositRoleHash));
    });
  });

  describe("deposit ERC20", function () {
    let cPJManager: PJManager;
    let cERC20: RandomERC20;

    beforeEach(async function () {
      ({ cPJManager, cERC20 } = await deployDummyPJManager());
    });

    it("[S] should deposit ERC20 by QuestryPlatform", async function () {
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      const tx = await TestUtils.call(
        cMockQuestryPlatform,
        cPJManager,
        "deposit(bytes4 _paymentMode,address _paymentToken,address _from,uint256 _amount)",
        [erc20Mode, cERC20.address, depositer.address, 2]
      );
      expect(
        await cPJManager.getTotalBalance(erc20Mode, cERC20.address)
      ).equals(2);
      expect(await cERC20.balanceOf(cPJManager.address)).equals(2);
      expect(tx)
        .to.emit(cPJManager, "DepositERC20")
        .withArgs(cERC20.address, depositer.address, 2);
    });

    it("[R] should not deposit ERC20 by others", async function () {
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await expect(
        cPJManager
          .connect(user)
          .deposit(erc20Mode, cERC20.address, depositer.address, 2)
      ).revertedWith(missingRoleError(user.address, depositRoleHash));
    });
  });

  describe("withdrawForAllocation", function () {
    let cPJManager: PJManager;
    let cERC20: RandomERC20;

    beforeEach(async function () {
      ({ cPJManager, cERC20 } = await deployDummyPJManager());
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await TestUtils.callAndSend(
        cMockQuestryPlatform,
        cPJManager,
        "deposit(bytes4 _paymentMode,address _paymentToken,address _from,uint256 _amount)",
        [nativeMode, ethers.constants.AddressZero, depositer.address, 2],
        { value: 2 }
      );
      await TestUtils.call(
        cMockQuestryPlatform,
        cPJManager,
        "deposit(bytes4 _paymentMode,address _paymentToken,address _from,uint256 _amount)",
        [erc20Mode, cERC20.address, depositer.address, 2]
      );
    });

    it("[S] should withdraw native token by QuestryPlatform", async function () {
      const tx = await TestUtils.call(
        cMockQuestryPlatform,
        cPJManager,
        "withdrawForAllocation(bytes4 paymentMode,address paymentToken,address receiver,uint256 amount)",
        [nativeMode, ethers.constants.AddressZero, user.address, 1]
      );
      expect(
        await cPJManager.getTotalBalance(nativeMode, cERC20.address)
      ).equals(1);
      await expect(tx).to.changeEtherBalances([cPJManager, user], [-1, 1]);
    });

    it("[S] should withdraw ERC20 token by QuestryPlatform", async function () {
      await TestUtils.call(
        cMockQuestryPlatform,
        cPJManager,
        "withdrawForAllocation(bytes4 paymentMode,address paymentToken,address receiver,uint256 amount)",
        [erc20Mode, cERC20.address, user.address, 1]
      );
      expect(await cERC20.balanceOf(cPJManager.address)).equals(1);
      expect(
        await cPJManager.getTotalBalance(erc20Mode, cERC20.address)
      ).equals(1);
      expect(await cERC20.balanceOf(user.address)).equals(1);
    });

    it("[R] should not withdraw native token by others", async function () {
      await expect(
        cPJManager
          .connect(user)
          .deposit(erc20Mode, ethers.constants.AddressZero, user.address, 2)
      ).revertedWith(missingRoleError(user.address, depositRoleHash));
    });

    it("[R] should not withdraw ERC20 token by others", async function () {
      await expect(
        cPJManager
          .connect(user)
          .withdrawForAllocation(erc20Mode, cERC20.address, user.address, 1)
      ).revertedWith(missingRoleError(user.address, withdrawRoleHash));
    });

    it("[R] should not withdraw ERC20 tokens if they are transferred directly", async function () {
      await cERC20.connect(depositer).transfer(cPJManager.address, 1);
      expect(
        await cPJManager.getTotalBalance(erc20Mode, cERC20.address)
      ).equals(2);
      expect(await cERC20.balanceOf(cPJManager.address)).equals(3);
      await expect(
        TestUtils.call(
          cMockQuestryPlatform,
          cPJManager,
          "withdrawForAllocation(bytes4 paymentMode,address paymentToken,address receiver,uint256 amount)",
          [erc20Mode, cERC20.address, user.address, 3]
        )
      ).revertedWith("PJTreasuryPool: insufficient balance");
    });
  });

  describe("assign[resolve]BoardId", function () {
    let cPJManager: PJManager;
    let cMockBoard: MockCallerContract;

    beforeEach(async function () {
      ({ cPJManager } = await deployDummyPJManager());
      cMockBoard = await new MockCallerContract__factory(deployer).deploy();
      await cPJManager.connect(admin).registerBoard(cMockBoard.address);
    });

    it("[S] should assignBoardId by registered board", async function () {
      await TestUtils.call(
        cMockBoard,
        cPJManager,
        "assignBoardId(address _board,uint256 _tokenId)",
        [cMockBoard.address, 1]
      );
      let boardId = await cPJManager.resolveBoardId(cMockBoard.address, 1);
      expect(boardId).equals(1);

      await TestUtils.call(
        cMockBoard,
        cPJManager,
        "assignBoardId(address _board,uint256 _tokenId)",
        [cMockBoard.address, 2]
      );
      boardId = await cPJManager.resolveBoardId(cMockBoard.address, 2);
      expect(boardId).equals(2);
    });

    it("[R] should not assignBoardId to the same token", async function () {
      await TestUtils.call(
        cMockBoard,
        cPJManager,
        "assignBoardId(address _board,uint256 _tokenId)",
        [cMockBoard.address, 1]
      );
      const boardId = await cPJManager.resolveBoardId(cMockBoard.address, 1);
      expect(boardId).equals(1);

      await expect(
        TestUtils.call(
          cMockBoard,
          cPJManager,
          "assignBoardId(address _board,uint256 _tokenId)",
          [cMockBoard.address, 1]
        )
      ).revertedWith("PJManager: assign for existent boardId");
    });

    it("[R] should not registerBoardId by others", async function () {
      await expect(
        cPJManager.connect(admin).assignBoardId(cMockBoard.address, 1)
      ).revertedWith(missingRoleError(admin.address, boardIdRoleHash));
    });
  });
});
