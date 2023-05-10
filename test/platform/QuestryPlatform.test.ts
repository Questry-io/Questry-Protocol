/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */
import { ethers, upgrades } from "hardhat";
import { Contract, utils } from "ethers";
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
  RandomERC20,
  TokenControlProxy,
  MockPaymentResolver,
  MockPaymentResolver__factory,
} from "../../typechain";
import { TestUtils, AllocationShare, ExecutePaymentArgs } from "../testUtils";

describe("QuestryPlatform", function () {
  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let poolAdmin: SignerWithAddress;
  let whitelistController: SignerWithAddress;
  let depositer: SignerWithAddress;
  let boardMinter: SignerWithAddress;
  let contributionUpdater: SignerWithAddress;
  let businessOwners: SignerWithAddress[];
  let boardingMembers: SignerWithAddress[];
  let signers: SignerWithAddress[];
  let daoTreasuryPool: SignerWithAddress;
  let cTokenControlProxy: TokenControlProxy;
  let cQuestryPlatform: QuestryPlatform;
  let cCalculator: ContributionCalculator;
  let cContributionPool: ContributionPool;

  const nativeMode = utils.keccak256(utils.toUtf8Bytes("NATIVE")).slice(0, 10);
  const erc20Mode = utils.keccak256(utils.toUtf8Bytes("ERC20")).slice(0, 10);

  const commonPaymentCategory = utils
    .keccak256(utils.toUtf8Bytes("COMMON_PAYMENT_CATEGORY"))
    .slice(0, 10);
  const investmentPaymentCategory = utils
    .keccak256(utils.toUtf8Bytes("INVESTMENT_PAYMENT_CATEGORY"))
    .slice(0, 10);
  const protocolPaymentCategory = utils
    .keccak256(utils.toUtf8Bytes("PROTOCOL_PAYMENT_CATEGORY"))
    .slice(0, 10);

  const depositRoleHash = utils.keccak256(utils.toUtf8Bytes("PJ_DEPOSIT_ROLE"));
  const whitelistRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PJ_WHITELIST_ROLE")
  );

  function withShares(
    recipients: SignerWithAddress[],
    shares: number[]
  ): AllocationShare[] {
    return recipients.map((r, i) => {
      return { recipient: r.address, share: shares[i] };
    });
  }

  async function deployPJManager(
    _boardingMembersProportion: number,
    _businessOwners: AllocationShare[]
  ) {
    const cPJManager = await new PJManager__factory(deployer).deploy(
      cQuestryPlatform.address,
      admin.address,
      _boardingMembersProportion,
      _businessOwners
    );
    await cPJManager.deployed();

    // assign roles
    await cPJManager
      .connect(admin)
      .grantRole(depositRoleHash, depositer.address);
    await cPJManager
      .connect(admin)
      .grantRole(whitelistRoleHash, whitelistController.address);

    // deploy Board associated with the project.
    const cBoard = await new Board__factory(deployer).deploy(
      "board",
      "BRD",
      "https://example.com",
      cPJManager.address,
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

  beforeEach(async function () {
    let rest: SignerWithAddress[];
    [
      deployer,
      admin,
      poolAdmin,
      whitelistController,
      depositer,
      boardMinter,
      contributionUpdater,
      daoTreasuryPool,
      ...rest
    ] = await ethers.getSigners();
    businessOwners = rest.slice(0, 2);
    boardingMembers = rest.slice(2, 4);
    signers = rest.slice(4);

    cCalculator = await new ContributionCalculator__factory(deployer).deploy();
    await cCalculator.deployed();

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
      { kind: "uups" }
    )) as QuestryPlatform;
    await cQuestryPlatform.deployed();

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
      .grantIncrementTermRole(TestUtils.dummySigner);
  });

  describe("allocate", function () {
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
      const args: any = {
        pjManager: cPJManager.address,
        paymentMode: nativeMode,
        paymentToken: ethers.constants.AddressZero,
        board: cBoard.address,
        calculateArgs: TestUtils.createArgsWithLinear({
          pools: [cContributionPool.address],
          coefs: [1],
        }),
        updateNeededPools: [cContributionPool.address],
        contributePoolOwner: [TestUtils.dummySigner],
        pjnonce: Number(await cPJManager.getNonce()).toString(),
      };

      //EIP712 create domain separator
      const domain = {
        name: "QUESTRY_PLATFORM",
        version: "1.0",
        chainId: await admin.getChainId(),
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
          { name: "contributePoolOwner", type: "address[]" },
          { name: "pjnonce", type: "uint256" },
        ],
        CalculateDispatchArgs: [
          { name: "algorithm", type: "bytes4" },
          { name: "args", type: "bytes" },
        ],
      };

      const signature = await admin._signTypedData(domain, types2, args);
      return await cQuestryPlatform.allocate(args, [signature]);
    }

    async function allocateERC20(
      cPJManager: PJManager,
      cERC20: ERC20,
      cBoard: Board
    ) {
      const args: any = {
        pjManager: cPJManager.address,
        paymentMode: erc20Mode,
        paymentToken: cERC20.address,
        board: cBoard.address,
        calculateArgs: TestUtils.createArgsWithLinear({
          pools: [cContributionPool.address],
          coefs: [1],
        }),
        updateNeededPools: [cContributionPool.address],
        contributePoolOwner: [TestUtils.dummySigner],
        pjnonce: Number(await cPJManager.getNonce()).toString(),
      };

      //EIP712 create domain separator
      const domain = {
        name: "QUESTRY_PLATFORM",
        version: "1.0",
        chainId: await admin.getChainId(),
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
          { name: "contributePoolOwner", type: "address[]" },
          { name: "pjnonce", type: "uint256" },
        ],
        CalculateDispatchArgs: [
          { name: "algorithm", type: "bytes4" },
          { name: "args", type: "bytes" },
        ],
      };

      const signature = await admin._signTypedData(domain, types2, args);
      return await cQuestryPlatform.allocate(args, [signature]);
    }

    it("[S] should update terms after allocate()", async function () {
      const { cPJManager, cBoard } = await deployPJManager(
        4000,
        withShares(businessOwners, [1, 2])
      );
      await addContribution(cBoard, cContributionPool, boardingMembers[0], 1);
      await cPJManager.connect(depositer).deposit({ value: 100 });
      expect(await cContributionPool.getTerm()).equals(0);
      expect(await cPJManager.getNonce()).equals(0);
      await allocateNative(cPJManager, cBoard);
      expect(await cContributionPool.getTerm()).equals(1);
      expect(await cPJManager.getNonce()).equals(1);
    });

    it("[S] ETH: should allocate tokens in a typical scenario", async function () {
      const { cPJManager, cBoard } = await deployPJManager(
        4000,
        withShares(businessOwners, [1, 2])
      );
      await addContribution(cBoard, cContributionPool, boardingMembers[0], 1);
      await addContribution(cBoard, cContributionPool, boardingMembers[1], 2);
      await cPJManager.connect(depositer).deposit({ value: 100 });

      const tx = await allocateNative(cPJManager, cBoard);

      await expect(tx).to.changeEtherBalances(
        [
          boardingMembers[0],
          boardingMembers[1],
          businessOwners[0],
          businessOwners[1],
          daoTreasuryPool,
        ],
        [
          12, // 38 * 1 / 3
          25, // 38 * 2 / 3
          20, // 60 * 1 / 3
          40, // 60 * 2 / 3
          3,
        ]
      );
    });

    it("[S] ETH: should allocate all to businessOwners when boardingMembersProportion is 0", async function () {
      const { cPJManager, cBoard } = await deployPJManager(
        0,
        withShares(businessOwners, [1, 2])
      );
      await addContribution(cBoard, cContributionPool, boardingMembers[0], 1);
      await addContribution(cBoard, cContributionPool, boardingMembers[1], 2);
      await cPJManager.connect(depositer).deposit({ value: 100 });

      const tx = await allocateNative(cPJManager, cBoard);

      await expect(tx).to.changeEtherBalances(
        [
          boardingMembers[0],
          boardingMembers[1],
          businessOwners[0],
          businessOwners[1],
          daoTreasuryPool,
        ],
        [
          0,
          0,
          32, // 97 * 1 / 3
          64, // 97 * 2 / 3
          4, // 3 + (97 - (32 + 64))
        ]
      );
    });

    it("[S] ETH: should allocate all to boardingMembers when boardingMembersProportion is 10000", async function () {
      const { cPJManager, cBoard } = await deployPJManager(
        10000,
        withShares(businessOwners, [0, 0])
      );
      await addContribution(cBoard, cContributionPool, boardingMembers[0], 1);
      await addContribution(cBoard, cContributionPool, boardingMembers[1], 2);
      await cPJManager.connect(depositer).deposit({ value: 100 });

      const tx = await allocateNative(cPJManager, cBoard);

      await expect(tx).to.changeEtherBalances(
        [
          boardingMembers[0],
          boardingMembers[1],
          businessOwners[0],
          businessOwners[1],
          daoTreasuryPool,
        ],
        [
          32, // 97 * 1 / 3
          64, // 97 * 2 / 3
          0,
          0,
          4, // 3 + (97 - (32 + 64))
        ]
      );
    });

    it("[S] ETH: should allocate all to businessOwners when no boardingMember exists", async function () {
      const { cPJManager, cBoard } = await deployPJManager(
        4000,
        withShares(businessOwners, [1, 2])
      );
      await cPJManager.connect(depositer).deposit({ value: 100 });

      const tx = await allocateNative(cPJManager, cBoard);

      await expect(tx).to.changeEtherBalances(
        [
          boardingMembers[0],
          boardingMembers[1],
          businessOwners[0],
          businessOwners[1],
          daoTreasuryPool,
        ],
        [
          0,
          0,
          32, // 97 * 1 / 3
          64, // 97 * 2 / 3
          4, // 3 + (97 - (32 + 64))
        ]
      );
    });

    it("[S] ERC20: should allocate tokens in a typical scenario", async function () {
      const { cPJManager, cERC20, cBoard } = await deployPJManager(
        4000,
        withShares(businessOwners, [1, 2])
      );
      await addContribution(cBoard, cContributionPool, boardingMembers[0], 1);
      await addContribution(cBoard, cContributionPool, boardingMembers[1], 2);
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cPJManager.connect(depositer).depositERC20(cERC20.address, 100);

      await allocateERC20(cPJManager, cERC20, cBoard);

      expect(await cERC20.balanceOf(boardingMembers[0].address)).equals(12);
      expect(await cERC20.balanceOf(boardingMembers[1].address)).equals(25);
      expect(await cERC20.balanceOf(businessOwners[0].address)).equals(20);
      expect(await cERC20.balanceOf(businessOwners[1].address)).equals(40);
      expect(await cERC20.balanceOf(daoTreasuryPool.address)).equals(3);
    });

    it("[S] ERC20: should allocate all tokens to businessOwners when boardingMembersProportion is 0", async function () {
      const { cPJManager, cERC20, cBoard } = await deployPJManager(
        0,
        withShares(businessOwners, [1, 2])
      );
      await addContribution(cBoard, cContributionPool, boardingMembers[0], 1);
      await addContribution(cBoard, cContributionPool, boardingMembers[1], 2);
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cPJManager.connect(depositer).depositERC20(cERC20.address, 100);

      await allocateERC20(cPJManager, cERC20, cBoard);

      expect(await cERC20.balanceOf(boardingMembers[0].address)).equals(0);
      expect(await cERC20.balanceOf(boardingMembers[1].address)).equals(0);
      expect(await cERC20.balanceOf(businessOwners[0].address)).equals(32);
      expect(await cERC20.balanceOf(businessOwners[1].address)).equals(64);
      expect(await cERC20.balanceOf(daoTreasuryPool.address)).equals(4);
    });

    it("[S] ERC20: should allocate all to boardingMembers when boardingMembersProportion is 10000", async function () {
      const { cPJManager, cERC20, cBoard } = await deployPJManager(
        10000,
        withShares(businessOwners, [0, 0])
      );
      await addContribution(cBoard, cContributionPool, boardingMembers[0], 1);
      await addContribution(cBoard, cContributionPool, boardingMembers[1], 2);
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cPJManager.connect(depositer).depositERC20(cERC20.address, 100);

      await allocateERC20(cPJManager, cERC20, cBoard);

      expect(await cERC20.balanceOf(boardingMembers[0].address)).equals(32);
      expect(await cERC20.balanceOf(boardingMembers[1].address)).equals(64);
      expect(await cERC20.balanceOf(businessOwners[0].address)).equals(0);
      expect(await cERC20.balanceOf(businessOwners[1].address)).equals(0);
      expect(await cERC20.balanceOf(daoTreasuryPool.address)).equals(4);
    });

    it("[S] ERC20: should allocate all to businessOwners when no boardingMember exists", async function () {
      const { cPJManager, cERC20, cBoard } = await deployPJManager(
        4000,
        withShares(businessOwners, [1, 2])
      );
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cPJManager.connect(depositer).depositERC20(cERC20.address, 100);

      await allocateERC20(cPJManager, cERC20, cBoard);

      expect(await cERC20.balanceOf(boardingMembers[0].address)).equals(0);
      expect(await cERC20.balanceOf(boardingMembers[1].address)).equals(0);
      expect(await cERC20.balanceOf(businessOwners[0].address)).equals(32);
      expect(await cERC20.balanceOf(businessOwners[1].address)).equals(64);
      expect(await cERC20.balanceOf(daoTreasuryPool.address)).equals(4);
    });
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
  });

  describe("executePayment", function () {
    let cPaymentResolver: MockPaymentResolver;
    let cERC20: RandomERC20;
    let initialBalance: number;

    beforeEach(async function () {
      cPaymentResolver = await new MockPaymentResolver__factory(
        deployer
      ).deploy();
      cERC20 = await new RandomERC20__factory(deployer).deploy();
      await cERC20.mint([signers[0].address]);
      await cTokenControlProxy
        .connect(admin)
        .grantExecutorRoleToQuestryPlatform(cQuestryPlatform.address);
      initialBalance = (await cERC20.balanceOf(signers[0].address)).toNumber();
    });

    describe("_checkParameters", function () {
      describe("when paymentMode is NATIVE", function () {
        it("[R] should revert if mismatch between _msgSender() and _args.from", async function () {
          const args: ExecutePaymentArgs = {
            paymentMode: nativeMode,
            paymentToken: ethers.constants.AddressZero,
            paymentCategory: commonPaymentCategory,
            from: signers[0].address,
            to: signers[1].address,
            amount: 100,
            resolver: cPaymentResolver.address,
            nonce: 0,
          };
          const typedData = await createTypedData(args);

          await expect(
            cQuestryPlatform
              .connect(signers[2])
              .executePayment(args, typedData, {
                value: args.amount,
              })
          ).to.be.revertedWith(
            "PlatformPayments: mismatch between _msgSender() and _args.from"
          );
        });

        it("[R] should revert if mismatch between msg.value and _args.amount", async function () {
          const args: ExecutePaymentArgs = {
            paymentMode: nativeMode,
            paymentToken: ethers.constants.AddressZero,
            paymentCategory: commonPaymentCategory,
            from: signers[0].address,
            to: signers[1].address,
            amount: 100,
            resolver: cPaymentResolver.address,
            nonce: 0,
          };
          const typedData = await createTypedData(args);

          await expect(
            cQuestryPlatform
              .connect(signers[0])
              .executePayment(args, typedData, {
                value: +args.amount + 1,
              })
          ).to.be.revertedWith(
            "PlatformPayments: mismatch between msg.value and _args.amount"
          );
        });

        it("[R] should revert if paymentToken exists", async function () {
          const args: ExecutePaymentArgs = {
            paymentMode: nativeMode,
            paymentToken: cERC20.address,
            paymentCategory: commonPaymentCategory,
            from: signers[0].address,
            to: signers[1].address,
            amount: 100,
            resolver: cPaymentResolver.address,
            nonce: 0,
          };
          const typedData = await createTypedData(args);

          await expect(
            cQuestryPlatform
              .connect(signers[0])
              .executePayment(args, typedData, {
                value: args.amount,
              })
          ).to.be.revertedWith(
            "PlatformPayments: paymentToken exists though paymentMode is NATIVE"
          );
        });
      });

      describe("when paymentMode is ERC20", function () {
        it("[R] should revert if mismatch between _msgSender() and _args.from", async function () {
          const args: ExecutePaymentArgs = {
            paymentMode: erc20Mode,
            paymentToken: cERC20.address,
            paymentCategory: commonPaymentCategory,
            from: signers[0].address,
            to: signers[1].address,
            amount: 100,
            resolver: cPaymentResolver.address,
            nonce: 0,
          };
          const typedData = await createTypedData(args);

          await expect(
            cQuestryPlatform.connect(signers[2]).executePayment(args, typedData)
          ).to.be.revertedWith(
            "PlatformPayments: mismatch between _msgSender() and _args.from"
          );
        });

        it("[R] should revert if msg.value != 0", async function () {
          const args: ExecutePaymentArgs = {
            paymentMode: erc20Mode,
            paymentToken: cERC20.address,
            paymentCategory: commonPaymentCategory,
            from: signers[0].address,
            to: signers[1].address,
            amount: 100,
            resolver: cPaymentResolver.address,
            nonce: 0,
          };
          const typedData = await createTypedData(args);

          await expect(
            cQuestryPlatform
              .connect(signers[0])
              .executePayment(args, typedData, { value: 1 })
          ).to.be.revertedWith(
            "PlatformPayments: msg.value != 0 though paymentMode is ERC20"
          );
        });

        it("[R] should revert if paymentToken doesn't exist", async function () {
          const args: ExecutePaymentArgs = {
            paymentMode: erc20Mode,
            paymentToken: ethers.constants.AddressZero,
            paymentCategory: commonPaymentCategory,
            from: signers[0].address,
            to: signers[1].address,
            amount: 100,
            resolver: cPaymentResolver.address,
            nonce: 0,
          };
          const typedData = await createTypedData(args);

          await expect(
            cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
          ).to.be.revertedWith(
            "PlatformPayments: paymentToken doesn't exist though paymentMode is ERC20"
          );
        });

        it("[R] should revert if paymentToken doesn't approve tokenControlProxy", async function () {
          cERC20.connect(signers[0]).approve(cTokenControlProxy.address, 1);
          const args: ExecutePaymentArgs = {
            paymentMode: erc20Mode,
            paymentToken: cERC20.address,
            paymentCategory: commonPaymentCategory,
            from: signers[0].address,
            to: signers[1].address,
            amount: 2,
            resolver: cPaymentResolver.address,
            nonce: 0,
          };
          let typedData = await createTypedData(args);

          await expect(
            cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
          ).to.be.revertedWith("PlatformPayments: insufficient allowance");

          args.amount = 1;
          typedData = await createTypedData(args);

          await cQuestryPlatform
            .connect(signers[0])
            .executePayment(args, typedData);
        });
      });

      describe("when paymentMode is unknown", function () {
        it("[R] should revert", async function () {
          const args: ExecutePaymentArgs = {
            paymentMode: utils
              .keccak256(utils.toUtf8Bytes("UNKNOWN"))
              .slice(0, 10),
            paymentToken: ethers.constants.AddressZero,
            paymentCategory: commonPaymentCategory,
            from: signers[0].address,
            to: signers[1].address,
            amount: 100,
            resolver: cPaymentResolver.address,
            nonce: 0,
          };
          const typedData = await createTypedData(args);

          await expect(
            cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
          ).to.be.revertedWith("PlatformPayments: unknown paymentMode");
        });
      });

      it("[R] should revert if no resolver with invest payment", async function () {
        const amount = 100;

        await cERC20
          .connect(signers[0])
          .approve(cTokenControlProxy.address, amount);
        const args: ExecutePaymentArgs = {
          paymentMode: erc20Mode,
          paymentToken: cERC20.address,
          paymentCategory: investmentPaymentCategory,
          from: signers[0].address,
          to: signers[1].address,
          amount,
          resolver: ethers.constants.AddressZero,
          nonce: 0,
        };
        const typedData = await createTypedData(args);

        await expect(
          cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
        ).to.be.revertedWith("PlatformPayments: no resolver");
      });

      it("[R] should revert if no resolver with protocol payment", async function () {
        const amount = 100;

        await cERC20
          .connect(signers[0])
          .approve(cTokenControlProxy.address, amount);
        const args: ExecutePaymentArgs = {
          paymentMode: erc20Mode,
          paymentToken: cERC20.address,
          paymentCategory: protocolPaymentCategory,
          from: signers[0].address,
          to: signers[1].address,
          amount,
          resolver: ethers.constants.AddressZero,
          nonce: 0,
        };
        const typedData = await createTypedData(args);

        await expect(
          cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
        ).to.be.revertedWith("PlatformPayments: no resolver");
      });

      it("[R] should revert if to is zero address", async function () {
        const amount = 100;

        await cERC20
          .connect(signers[0])
          .approve(cTokenControlProxy.address, amount);
        const args: ExecutePaymentArgs = {
          paymentMode: erc20Mode,
          paymentToken: cERC20.address,
          paymentCategory: commonPaymentCategory,
          from: signers[0].address,
          to: ethers.constants.AddressZero,
          amount,
          resolver: cPaymentResolver.address,
          nonce: 0,
        };
        const typedData = await createTypedData(args);

        await expect(
          cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
        ).to.be.revertedWith("PlatformPayments: to is zero address");
      });

      it("[R] should revert if amount is zero", async function () {
        const args: ExecutePaymentArgs = {
          paymentMode: erc20Mode,
          paymentToken: cERC20.address,
          paymentCategory: commonPaymentCategory,
          from: signers[0].address,
          to: signers[1].address,
          amount: 0,
          resolver: cPaymentResolver.address,
          nonce: 0,
        };
        const typedData = await createTypedData(args);

        await expect(
          cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
        ).to.be.revertedWith("PlatformPayments: amount is zero");
      });

      it("[R] should revert if nonce is invalid", async function () {
        await cERC20
          .connect(signers[0])
          .approve(cTokenControlProxy.address, 1000000);
        const createArgs = (nonce: number): ExecutePaymentArgs => {
          return {
            paymentMode: erc20Mode,
            paymentToken: cERC20.address,
            paymentCategory: commonPaymentCategory,
            from: signers[0].address,
            to: signers[1].address,
            amount: 1,
            resolver: cPaymentResolver.address,
            nonce,
          };
        };

        let args = createArgs(1);
        let typedData = await createTypedData(args);
        await expect(
          cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
        ).to.be.revertedWith("PlatformPayments: invalid nonce");

        args = createArgs(0);
        typedData = await createTypedData(args);
        await cQuestryPlatform
          .connect(signers[0])
          .executePayment(args, typedData);

        args = createArgs(1);
        typedData = await createTypedData(args);
        await cQuestryPlatform
          .connect(signers[0])
          .executePayment(args, typedData);

        args = createArgs(2);
        typedData = await createTypedData(args);
        await expect(
          cQuestryPlatform
            .connect(signers[0])
            .executePayment({ ...args, nonce: 3 }, typedData)
        ).to.be.revertedWith("PlatformPayments: invalid nonce");
      });

      it("[R] should revert if nonce is invalid (replay attack)", async function () {
        await cERC20
          .connect(signers[0])
          .approve(cTokenControlProxy.address, 1000000);
        const args: ExecutePaymentArgs = {
          paymentMode: erc20Mode,
          paymentToken: cERC20.address,
          paymentCategory: commonPaymentCategory,
          from: signers[0].address,
          to: signers[1].address,
          amount: 1,
          resolver: cPaymentResolver.address,
          nonce: 0,
        };
        const typedData = await createTypedData(args);

        await cQuestryPlatform
          .connect(signers[0])
          .executePayment(args, typedData);
        await expect(
          cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
        ).revertedWith("PlatformPayments: invalid nonce");
      });
    });

    async function createTypedData(args: ExecutePaymentArgs) {
      const domain = {
        name: "QUESTRY_PLATFORM",
        version: "1.0",
        chainId: await signers[0].getChainId(),
        verifyingContract: cQuestryPlatform.address,
      };
      const types = {
        ExecutePaymentArgs: [
          { name: "paymentMode", type: "bytes4" },
          { name: "paymentToken", type: "address" },
          { name: "paymentCategory", type: "bytes4" },
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "nonce", type: "uint256" },
        ],
      };
      return signers[0]._signTypedData(domain, types, args);
    }

    async function executeNativePaymentAndVerify(
      args: ExecutePaymentArgs,
      typedData: any,
      feeRate: number,
      fromSigner: SignerWithAddress,
      toSigner: SignerWithAddress
    ) {
      const deduction = Math.floor((+args.amount * feeRate) / 10000);
      const tx = await cQuestryPlatform
        .connect(fromSigner)
        .executePayment(args, typedData, {
          value: args.amount,
        });
      await expect(tx).to.changeEtherBalances(
        [fromSigner, toSigner, daoTreasuryPool],
        [-args.amount, +args.amount - deduction, deduction]
      );
    }

    async function executeERC20PaymentAndVerify(
      args: ExecutePaymentArgs,
      typedData: any,
      feeRate: number,
      fromSigner: SignerWithAddress
    ) {
      const deduction = Math.floor((+args.amount * feeRate) / 10000);
      await cQuestryPlatform
        .connect(fromSigner)
        .executePayment(args, typedData);
      expect(await cERC20.balanceOf(args.from)).equals(
        initialBalance - +args.amount
      );
      expect(await cERC20.balanceOf(args.to)).equals(+args.amount - deduction);
      expect(await cERC20.balanceOf(daoTreasuryPool.address)).equals(deduction);
    }

    type FeeRateSetter =
      | "setCommonFeeRate"
      | "setInvestmentFeeRate"
      | "setProtocolFeeRate";
    type PaymentCategoryTestcase = {
      categoryName: string;
      paymentCategory: string;
      defaultFeeRate?: number;
      feeRateSetter?: FeeRateSetter;
    };

    [
      {
        categoryName: "common payment",
        paymentCategory: commonPaymentCategory,
        defaultFeeRate: 300,
        feeRateSetter: "setCommonFeeRate" as FeeRateSetter,
      },
      {
        categoryName: "investment payment",
        paymentCategory: investmentPaymentCategory,
        defaultFeeRate: 300,
        feeRateSetter: "setInvestmentFeeRate" as FeeRateSetter,
      },
      {
        categoryName: "protocol payment",
        paymentCategory: protocolPaymentCategory,
        defaultFeeRate: 300,
        feeRateSetter: "setProtocolFeeRate" as FeeRateSetter,
      },
    ].forEach((testcase: PaymentCategoryTestcase) => {
      it(`[S] NATIVE: should executePayment with ${testcase.categoryName} (default fee)`, async function () {
        const amount = 100;

        const args: ExecutePaymentArgs = {
          paymentMode: nativeMode,
          paymentToken: ethers.constants.AddressZero,
          paymentCategory: testcase.paymentCategory,
          from: signers[0].address,
          to: signers[1].address,
          amount,
          resolver: cPaymentResolver.address,
          nonce: 0,
        };
        const typedData = await createTypedData(args);

        await executeNativePaymentAndVerify(
          args,
          typedData,
          testcase.defaultFeeRate!,
          signers[0],
          signers[1]
        );
      });

      it(`[S] NATIVE: should executePayment with ${testcase.categoryName} (fee changed)`, async function () {
        const amount = 100;
        const feeRate = 100;

        const args: ExecutePaymentArgs = {
          paymentMode: nativeMode,
          paymentToken: ethers.constants.AddressZero,
          paymentCategory: testcase.paymentCategory,
          from: signers[0].address,
          to: signers[1].address,
          amount,
          resolver: cPaymentResolver.address,
          nonce: 0,
        };
        const typedData = await createTypedData(args);

        await cQuestryPlatform[testcase.feeRateSetter!](feeRate);

        await executeNativePaymentAndVerify(
          args,
          typedData,
          feeRate,
          signers[0],
          signers[1]
        );
      });

      it(`[S] ERC20: should executePayment with ${testcase.categoryName} (default fee)`, async function () {
        const amount = 100;

        await cERC20
          .connect(signers[0])
          .approve(cTokenControlProxy.address, amount);
        const args: ExecutePaymentArgs = {
          paymentMode: erc20Mode,
          paymentToken: cERC20.address,
          paymentCategory: testcase.paymentCategory,
          from: signers[0].address,
          to: signers[1].address,
          amount,
          resolver: cPaymentResolver.address,
          nonce: 0,
        };
        const typedData = await createTypedData(args);

        await executeERC20PaymentAndVerify(
          args,
          typedData,
          testcase.defaultFeeRate!,
          signers[0]
        );
      });

      it(`[S] ERC20: should executePayment with ${testcase.categoryName} (fee changed)`, async function () {
        const amount = 100;
        const feeRate = 100;

        await cERC20
          .connect(signers[0])
          .approve(cTokenControlProxy.address, amount);
        const args: ExecutePaymentArgs = {
          paymentMode: erc20Mode,
          paymentToken: cERC20.address,
          paymentCategory: testcase.paymentCategory,
          from: signers[0].address,
          to: signers[1].address,
          amount,
          resolver: cPaymentResolver.address,
          nonce: 0,
        };
        const typedData = await createTypedData(args);

        await cQuestryPlatform[testcase.feeRateSetter!](feeRate);

        await executeERC20PaymentAndVerify(
          args,
          typedData,
          feeRate,
          signers[0]
        );
      });
    });

    describe("resolver", function () {
      [
        {
          categoryName: "common payment",
          paymentCategory: commonPaymentCategory,
        },
        {
          categoryName: "investment payment",
          paymentCategory: investmentPaymentCategory,
        },
        {
          categoryName: "protocol payment",
          paymentCategory: protocolPaymentCategory,
        },
      ].forEach((testcase: PaymentCategoryTestcase) => {
        it(`[S] should resolveAfterPayment with ${testcase.categoryName}`, async function () {
          const amount = 100;

          await cERC20
            .connect(signers[0])
            .approve(cTokenControlProxy.address, amount);
          const args: ExecutePaymentArgs = {
            paymentMode: erc20Mode,
            paymentToken: cERC20.address,
            paymentCategory: testcase.paymentCategory,
            from: signers[0].address,
            to: signers[1].address,
            amount,
            resolver: cPaymentResolver.address,
            nonce: 0,
          };
          const typedData = await createTypedData(args);

          await cQuestryPlatform
            .connect(signers[0])
            .executePayment(args, typedData);

          expect(
            await cPaymentResolver.isResolved(
              utils.keccak256(
                utils.defaultAbiCoder.encode(
                  [
                    "(bytes4 paymentMode,address paymentToken,bytes4 paymentCategory,address from,address to,uint256 amount,address resolver,uint256 nonce)",
                  ],
                  [args]
                )
              )
            )
          ).to.be.true;
        });
      });

      it("[S] should be ok if no resolver with common payment", async function () {
        const amount = 100;

        await cERC20
          .connect(signers[0])
          .approve(cTokenControlProxy.address, amount);
        const args: ExecutePaymentArgs = {
          paymentMode: erc20Mode,
          paymentToken: cERC20.address,
          paymentCategory: commonPaymentCategory,
          from: signers[0].address,
          to: signers[1].address,
          amount,
          resolver: ethers.constants.AddressZero,
          nonce: 0,
        };
        const typedData = await createTypedData(args);

        await cQuestryPlatform
          .connect(signers[0])
          .executePayment(args, typedData);
      });
    });
  });
});
