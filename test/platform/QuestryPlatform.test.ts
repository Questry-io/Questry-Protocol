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
} from "../../typechain";
import { TestUtils, AllocationShare } from "../testUtils";

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
  let daoTreasuryPool: SignerWithAddress;
  let user: SignerWithAddress;
  let cQuestryPlatform: QuestryPlatform;
  let cCalculator: ContributionCalculator;
  let cContributionPool: ContributionPool;

  const nativeMode = utils.keccak256(utils.toUtf8Bytes("NATIVE")).slice(0, 10);
  const erc20Mode = utils.keccak256(utils.toUtf8Bytes("ERC20")).slice(0, 10);

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
      user,
      daoTreasuryPool,
      ...rest
    ] = await ethers.getSigners();
    businessOwners = rest.slice(0, 2);
    boardingMembers = rest.slice(2, 4);

    cCalculator = await new ContributionCalculator__factory(deployer).deploy();
    await cCalculator.deployed();

    const cfQuestryPlatform = await ethers.getContractFactory(
      "QuestryPlatform"
    );
    cQuestryPlatform = (await upgrades.deployProxy(
      cfQuestryPlatform,
      [cCalculator.address, daoTreasuryPool.address],
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
        pjnonce: (Number(await cPJManager.getNonce())).toString()
      }

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
          { name: "pjnonce", type: "uint256" }
        ],
        CalculateDispatchArgs:[
          { name: "algorithm", type: "bytes4" },
          { name: "args", type: "bytes" }
        ]
      };
      
      const signature = await admin._signTypedData(domain, types2, args);
      return await cQuestryPlatform.allocate(args, [signature]);
    }


    async function allocateERC20(
      cPJManager: PJManager,
      cERC20: ERC20,
      cBoard: Board
    ) {

      const args:any = {
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
        pjnonce: (Number(await cPJManager.getNonce())).toString()
      }

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
          { name: "pjnonce", type: "uint256" }
        ],
        CalculateDispatchArgs:[
          { name: "algorithm", type: "bytes4" },
          { name: "args", type: "bytes" }
        ]
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
});
