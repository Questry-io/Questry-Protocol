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
  ERC20,
  RandomERC20__factory,
  Board,
  Board__factory,
  PJManager__factory,
  PJManager,
  QuestryPlatform,
  TokenControlProxy,
  QuestryForwarder,
} from "../../../typechain";
import { TestUtils, ExecutePaymentArgs, AllocateArgs } from "../../testUtils";

describe("QuestryPlatform - allocate", function () {
  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let poolAdmin: SignerWithAddress;
  let whitelistController: SignerWithAddress;
  let boardMinter: SignerWithAddress;
  let contributionUpdater: SignerWithAddress;
  let businessOwner: SignerWithAddress;
  let boardingMembers: SignerWithAddress[];
  let signers: SignerWithAddress[];
  let daoTreasuryPool: SignerWithAddress;
  let cTokenControlProxy: TokenControlProxy;
  let cQuestryPlatform: QuestryPlatform;
  let cQuestryForwarder: QuestryForwarder;
  let cCalculator: ContributionCalculator;
  let cContributionPool: ContributionPool;

  const nativeMode = utils.keccak256(utils.toUtf8Bytes("NATIVE")).slice(0, 10);
  const erc20Mode = utils.keccak256(utils.toUtf8Bytes("ERC20")).slice(0, 10);

  const protocolPaymentCategory = utils
    .keccak256(utils.toUtf8Bytes("PROTOCOL_PAYMENT_CATEGORY"))
    .slice(0, 10);

  const whitelistRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PJ_WHITELIST_ROLE")
  );

  async function deployPJManager(_boardingMembersProportion: number) {
    const cPJManager = await new PJManager__factory(deployer).deploy(
      cQuestryPlatform.address,
      admin.address,
      _boardingMembersProportion,
      businessOwner.address
    );
    await cPJManager.deployed();

    // assign roles
    await cPJManager
      .connect(admin)
      .grantRole(whitelistRoleHash, whitelistController.address);

    // deploy Board associated with the project.
    const cBoard = await new Board__factory(deployer).deploy(
      "board",
      "BRD",
      "https://example.com",
      cPJManager.address,
      ethers.constants.AddressZero,
      boardMinter.address,
      ethers.constants.AddressZero
    );
    await cBoard.deployed();
    cPJManager.connect(admin).registerBoard(cBoard.address);

    // deploy mock ERC20
    const cERC20 = await new RandomERC20__factory(deployer).deploy();
    await cERC20.mint([signers[0].address, admin.address]);
    await cERC20.connect(signers[0]).approve(cPJManager.address, 100);
    await cERC20.connect(admin).approve(cPJManager.address, 100);

    // ERC20 approvals
    await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
    await cERC20.connect(signers[0]).approve(cTokenControlProxy.address, 100);
    await cERC20.connect(signers[0]).approve(cPJManager.address, 100);

    return {
      cPJManager,
      cBoard,
      cERC20,
    };
  }

  async function createDomainSeparator(contract: QuestryPlatform | PJManager) {
    return {
      name: "QUESTRY_PLATFORM",
      version: "1.0",
      chainId: await admin.getChainId(),
      verifyingContract: contract.address,
    };
  }

  function createExecutePaymentTypes() {
    return {
      ExecutePaymentArgs: [
        { name: "paymentMode", type: "bytes4" },
        { name: "paymentToken", type: "address" },
        { name: "paymentCategory", type: "bytes4" },
        { name: "pjManager", type: "address" },
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };
  }

  function createAllocateTypes() {
    return {
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
  }

  async function setupPaymentTypedData(args: ExecutePaymentArgs) {
    return signers[0]._signTypedData(
      await createDomainSeparator(cQuestryPlatform),
      createExecutePaymentTypes(),
      args
    );
  }

  async function setupAllocateTypedData(
    cPJManager: PJManager,
    args: AllocateArgs
  ) {
    return admin._signTypedData(
      await createDomainSeparator(cPJManager),
      createAllocateTypes(),
      args
    );
  }

  type ExpectedByAmounts = {
    accounts: SignerWithAddress[];
    byAmounts: number[];
  };

  beforeEach(async function () {
    let rest: SignerWithAddress[];
    [
      deployer,
      admin,
      poolAdmin,
      whitelistController,
      boardMinter,
      contributionUpdater,
      daoTreasuryPool,
      businessOwner,
      ...rest
    ] = await ethers.getSigners();
    boardingMembers = rest.slice(0, 2);
    signers = rest.slice(2);

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
      ],
      {
        constructorArgs: [cQuestryForwarder.address],
        kind: "uups",
      }
    )) as QuestryPlatform;
    await cQuestryPlatform.deployed();

    // Grant TokenControlProxy executor role to QuestryPlatform
    await cTokenControlProxy
      .connect(admin)
      .grantExecutorRoleToQuestryPlatform(cQuestryPlatform.address);

    // Deploy ContributionPool
    cContributionPool = await new ContributionPool__factory(deployer).deploy(
      cQuestryPlatform.address,
      0,
      contributionUpdater.address,
      ethers.constants.AddressZero,
      poolAdmin.address
    );
    await cContributionPool.deployed();

    await cContributionPool
      .connect(poolAdmin)
      .addIncrementTermSigner(TestUtils.dummySigner);
  });

  describe("allocate", function () {
    async function setupIncrementTermSigner() {
      await cContributionPool
        .connect(poolAdmin)
        .addIncrementTermSigner(admin.address);
    }

    async function addContribution(
      cBoard: Board,
      cContributionPool: ContributionPool,
      member: SignerWithAddress,
      contribution: number
    ) {
      await cBoard.connect(boardMinter).mint(member.address);
      await cContributionPool
        .connect(contributionUpdater)
        .addContribution(member.address, contribution);
    }

    async function allocateNative(cPJManager: PJManager, cBoard: Board) {
      const args = await createAllocateArgs(
        cPJManager,
        cBoard,
        nativeMode,
        ethers.constants.AddressZero
      );
      const signature = await setupAllocateTypedData(cPJManager, args);
      return await cQuestryPlatform.allocate(args, [signature]);
    }

    async function allocateERC20(
      cPJManager: PJManager,
      cBoard: Board,
      cERC20: ERC20
    ) {
      const args = await createAllocateArgs(
        cPJManager,
        cBoard,
        erc20Mode,
        cERC20.address
      );
      const signature = await setupAllocateTypedData(cPJManager, args);
      return await cQuestryPlatform.allocate(args, [signature]);
    }

    async function createAllocateArgs(
      cPJManager: PJManager,
      cBoard: Board,
      paymentMode: string,
      paymentToken: string
    ) {
      return {
        pjManager: cPJManager.address,
        paymentMode,
        paymentToken,
        board: cBoard.address,
        calculateArgs: TestUtils.createArgsWithLinear({
          pools: [cContributionPool.address],
          coefs: [1],
        }),
        updateNeededPools: [cContributionPool.address],
        pjnonce: (await cPJManager.getNonce()).toString(),
      };
    }
    async function createExecutePaymentProtocolCategoryArgs(
      paymentMode: string,
      paymentToken: string,
      from: string,
      cPJManager: PJManager,
      amount: number
    ) {
      const nonce = (await cQuestryPlatform.getNonce(from)).toNumber();
      return {
        paymentMode,
        paymentToken,
        paymentCategory: protocolPaymentCategory,
        pjManager: cPJManager.address,
        from,
        to: ethers.constants.AddressZero,
        amount,
        nonce,
      };
    }

    async function executeNativePaymentProtocolCategory(
      cPJManager: PJManager,
      amount: number
    ) {
      const args = await createExecutePaymentProtocolCategoryArgs(
        nativeMode,
        ethers.constants.AddressZero,
        signers[0].address,
        cPJManager,
        amount
      );
      const typedData = await setupPaymentTypedData(args);
      await cQuestryPlatform
        .connect(signers[0])
        .executePayment(args, typedData, { value: amount });
    }

    async function executeERC20PaymentProtocolCategory(
      cPJManager: PJManager,
      amount: number,
      cERC20: ERC20
    ) {
      const args = await createExecutePaymentProtocolCategoryArgs(
        erc20Mode,
        cERC20.address,
        signers[0].address,
        cPJManager,
        amount
      );
      const typedData = await setupPaymentTypedData(args);
      await cQuestryPlatform
        .connect(signers[0])
        .executePayment(args, typedData);
    }

    async function allocateAndVerify(
      cPJManager: PJManager,
      cBoard: Board,
      cERC20: ERC20,
      paymentMode: string,
      expectedByAmounts: ExpectedByAmounts
    ) {
      const initialBalances: { [key: string]: number } = {};
      for (const account of expectedByAmounts.accounts) {
        initialBalances[account.address] = (
          await cERC20.balanceOf(account.address)
        ).toNumber();
      }
      const tx =
        paymentMode === nativeMode
          ? await allocateNative(cPJManager, cBoard)
          : await allocateERC20(cPJManager, cBoard, cERC20);

      if (paymentMode === nativeMode) {
        await expect(tx).to.changeEtherBalances(
          expectedByAmounts.accounts,
          expectedByAmounts.byAmounts
        );
      } else {
        for (let i = 0; i < expectedByAmounts.accounts.length; i++) {
          const account = expectedByAmounts.accounts[i];
          const byAmount = expectedByAmounts.byAmounts[i];
          expect(await cERC20.balanceOf(account.address)).equals(
            initialBalances[account.address] + byAmount
          );
        }
      }
    }

    it("[S] should update terms after allocate()", async function () {
      const { cPJManager, cBoard } = await deployPJManager(4000);
      await setupIncrementTermSigner();
      await addContribution(cBoard, cContributionPool, boardingMembers[0], 1);
      await executeNativePaymentProtocolCategory(cPJManager, 100);

      // Check precondition
      expect(await cContributionPool.getTerm()).equals(0);
      expect(await cPJManager.getNonce()).equals(0);

      // Execute
      await allocateNative(cPJManager, cBoard);

      // Verify
      expect(await cContributionPool.getTerm()).equals(1);
      expect(await cPJManager.getNonce()).equals(1);
    });

    it("[S] NATIVE: should allocate tokens in a typical scenario", async function () {
      const { cPJManager, cBoard, cERC20 } = await deployPJManager(4000);
      await setupIncrementTermSigner();
      await addContribution(cBoard, cContributionPool, boardingMembers[0], 1);
      await addContribution(cBoard, cContributionPool, boardingMembers[1], 2);
      await executeNativePaymentProtocolCategory(cPJManager, 100);

      await allocateAndVerify(cPJManager, cBoard, cERC20, nativeMode, {
        accounts: [
          boardingMembers[0],
          boardingMembers[1],
          businessOwner,
          daoTreasuryPool,
        ],
        byAmounts: [
          12, // 38 * 1 / 3
          25, // 38 * 2 / 3
          1, // 38 - (12 + 25)
          0,
        ],
      });
    });

    it("[S] NATIVE: should allocate nothing to anyone when boardingMembersProportion is 0.", async function () {
      const { cPJManager, cBoard, cERC20 } = await deployPJManager(0);
      await setupIncrementTermSigner();
      await addContribution(cBoard, cContributionPool, boardingMembers[0], 1);
      await addContribution(cBoard, cContributionPool, boardingMembers[1], 2);
      await executeNativePaymentProtocolCategory(cPJManager, 100);

      await allocateAndVerify(cPJManager, cBoard, cERC20, nativeMode, {
        accounts: [
          boardingMembers[0],
          boardingMembers[1],
          businessOwner,
          daoTreasuryPool,
        ],
        byAmounts: [0, 0, 0, 0],
      });
    });

    it("[S] NATIVE: should allocate all to boardingMembers when boardingMembersProportion is 10000", async function () {
      const { cPJManager, cBoard, cERC20 } = await deployPJManager(10000);
      await setupIncrementTermSigner();
      await addContribution(cBoard, cContributionPool, boardingMembers[0], 1);
      await addContribution(cBoard, cContributionPool, boardingMembers[1], 2);
      await executeNativePaymentProtocolCategory(cPJManager, 100);

      await allocateAndVerify(cPJManager, cBoard, cERC20, nativeMode, {
        accounts: [
          boardingMembers[0],
          boardingMembers[1],
          businessOwner,
          daoTreasuryPool,
        ],
        byAmounts: [
          32, // 97 * 1 / 3
          64, // 97 * 2 / 3
          0, // No allocation to businessOwner when boardingMembersProportion is 10000
          1, // 97 - (32 + 64)
        ],
      });
    });

    it("[S] ERC20: should allocate tokens in a typical scenario", async function () {
      const { cPJManager, cBoard, cERC20 } = await deployPJManager(4000);
      await setupIncrementTermSigner();
      await addContribution(cBoard, cContributionPool, boardingMembers[0], 1);
      await addContribution(cBoard, cContributionPool, boardingMembers[1], 2);
      await executeERC20PaymentProtocolCategory(cPJManager, 100, cERC20);

      await allocateAndVerify(cPJManager, cBoard, cERC20, erc20Mode, {
        accounts: [
          boardingMembers[0],
          boardingMembers[1],
          businessOwner,
          daoTreasuryPool,
        ],
        byAmounts: [
          12, // 38 * 1 / 3
          25, // 38 * 2 / 3
          1, // 38 - (12 + 25)
          0,
        ],
      });
    });

    it("[S] ERC20: should allocate nothing to anyone when boardingMembersProportion is 0.", async function () {
      const { cPJManager, cBoard, cERC20 } = await deployPJManager(0);
      await setupIncrementTermSigner();
      await addContribution(cBoard, cContributionPool, boardingMembers[0], 1);
      await addContribution(cBoard, cContributionPool, boardingMembers[1], 2);
      await executeERC20PaymentProtocolCategory(cPJManager, 100, cERC20);

      await allocateAndVerify(cPJManager, cBoard, cERC20, erc20Mode, {
        accounts: [
          boardingMembers[0],
          boardingMembers[1],
          businessOwner,
          daoTreasuryPool,
        ],
        byAmounts: [0, 0, 0, 0],
      });
    });

    it("[S] ERC20: should allocate all to boardingMembers when boardingMembersProportion is 10000", async function () {
      const { cPJManager, cBoard, cERC20 } = await deployPJManager(10000);
      await setupIncrementTermSigner();
      await addContribution(cBoard, cContributionPool, boardingMembers[0], 1);
      await addContribution(cBoard, cContributionPool, boardingMembers[1], 2);
      await executeERC20PaymentProtocolCategory(cPJManager, 100, cERC20);

      await allocateAndVerify(cPJManager, cBoard, cERC20, erc20Mode, {
        accounts: [
          boardingMembers[0],
          boardingMembers[1],
          businessOwner,
          daoTreasuryPool,
        ],
        byAmounts: [
          32, // 97 * 1 / 3
          64, // 97 * 2 / 3
          0, // No allocation to businessOwner when boardingMembersProportion is 10000
          1, // 97 - (32 + 64)
        ],
      });
    });

    it("[R] ERC20: should not allocate if lack of incrementTerm signers", async function () {
      const { cPJManager, cBoard, cERC20 } = await deployPJManager(4000);
      await executeERC20PaymentProtocolCategory(cPJManager, 100, cERC20);

      await cContributionPool
        .connect(poolAdmin)
        .addIncrementTermSigner(signers[0].address);
      await expect(allocateERC20(cPJManager, cBoard, cERC20)).revertedWith(
        "ContributionPool: insufficient whitelisted signers"
      );

      await cContributionPool.connect(poolAdmin).setThreshold(2);
      await cContributionPool
        .connect(poolAdmin)
        .addIncrementTermSigner(admin.address);
      await expect(allocateERC20(cPJManager, cBoard, cERC20)).revertedWith(
        "ContributionPool: insufficient whitelisted signers"
      );
    });
  });
});
