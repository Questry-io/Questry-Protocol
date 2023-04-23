/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
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
  SBT,
  SBT__factory,
  QuestryPlatform,
  PJManager__factory,
  QuestryPlatform__factory,
  PJManager,
} from "../../typechain";
import { TestUtils, AllocationShare } from "../testUtils";

describe("QuestryPlatform", function () {
  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let whitelistController: SignerWithAddress;
  let depositer: SignerWithAddress;
  let sbtMinter: SignerWithAddress;
  let contributionUpdater: SignerWithAddress;
  let businessOwners: SignerWithAddress[];
  let boardingMembers: SignerWithAddress[];
  let daoTreasuryPool: SignerWithAddress;
  let user: SignerWithAddress;
  let cQuestryPlatform: QuestryPlatform;
  let cCalculator: ContributionCalculator;
  let cContributionPool: ContributionPool;

  const dummyAddress = "0x90fA7809574b4f8206ec1a47aDc37eCEE57443cb";
  const dummyContract = "0x00E9C198af8F6a8692d83d1702e691A03F2cdc63";

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

    // deploy SBT associated with the project.
    const cSBT = await new SBT__factory(deployer).deploy(
      "board",
      "BRD",
      "https://example.com",
      cPJManager.address,
      sbtMinter.address,
      dummyContract
    );
    await cSBT.deployed();

    // deploy mock ERC20
    const cERC20 = await new RandomERC20__factory(deployer).deploy();
    await cERC20.mint([depositer.address, admin.address]);
    await cERC20.connect(depositer).approve(cPJManager.address, 100);
    await cERC20.connect(admin).approve(cPJManager.address, 100);

    return {
      cPJManager,
      cSBT,
      cERC20,
    };
  }

  beforeEach(async function () {
    let rest: SignerWithAddress[];
    [
      deployer,
      admin,
      whitelistController,
      depositer,
      sbtMinter,
      contributionUpdater,
      user,
      daoTreasuryPool,
      ...rest
    ] = await ethers.getSigners();
    businessOwners = rest.slice(0, 2);
    boardingMembers = rest.slice(2, 4);

    cCalculator = await new ContributionCalculator__factory(deployer).deploy();
    await cCalculator.deployed();

    cQuestryPlatform = await new QuestryPlatform__factory(deployer).deploy(
      cCalculator.address,
      daoTreasuryPool.address
    );
    await cQuestryPlatform.deployed();

    cContributionPool = await new ContributionPool__factory(deployer).deploy(
      0,
      dummyAddress,
      contributionUpdater.address
    );
    await cContributionPool.deployed();
  });

  describe("allocate", function () {
    async function addContribution(
      cSBT: SBT,
      cContributionPool: ContributionPool,
      member: SignerWithAddress,
      contribution: number
    ) {
      await cSBT.connect(sbtMinter).mint(member.address);
      await cContributionPool
        .connect(contributionUpdater)
        .addContribution(member.address, contribution);
    }

    async function allocateNative(cPJManager: PJManager, cSBT: SBT) {
      return await cQuestryPlatform.allocate({
        pjManager: cPJManager.address,
        paymentMode: nativeMode,
        paymentToken: ethers.constants.AddressZero,
        board: cSBT.address,
        calculateArgs: TestUtils.createArgsWithLinear({
          pools: [cContributionPool.address],
          coefs: [1],
        }),
        signature: await TestUtils.createDummySignature(),
      });
    }

    async function allocateERC20(
      cPJManager: PJManager,
      cERC20: ERC20,
      cSBT: SBT
    ) {
      return await cQuestryPlatform.allocate({
        pjManager: cPJManager.address,
        paymentMode: erc20Mode,
        paymentToken: cERC20.address,
        board: cSBT.address,
        calculateArgs: TestUtils.createArgsWithLinear({
          pools: [cContributionPool.address],
          coefs: [1],
        }),
        signature: await TestUtils.createDummySignature(),
      });
    }

    // TODO: Implement SignatureVerifier.verifySignature()
    it.skip("[R] should not allocate if signature verification failed", async function () {
      const { cPJManager, cSBT } = await deployPJManager(
        4000,
        withShares(businessOwners, [1, 2])
      );
      await addContribution(cSBT, cContributionPool, boardingMembers[0], 1);
      await addContribution(cSBT, cContributionPool, boardingMembers[1], 2);
      await cPJManager.connect(depositer).deposit({ value: 100 });

      const txPromise = cQuestryPlatform.connect(user).allocate({
        pjManager: cPJManager.address,
        paymentMode: nativeMode,
        paymentToken: ethers.constants.AddressZero,
        board: cSBT.address,
        calculateArgs: TestUtils.createArgsWithLinear({
          pools: [cContributionPool.address],
          coefs: [1],
        }),
        signature: await TestUtils.createDummySignature(),
      });
      await expect(txPromise).revertedWith(
        "QuestryPlatform: signature verification failed"
      );
    });

    it("[S] ETH: should allocate tokens in a typical scenario", async function () {
      const { cPJManager, cSBT } = await deployPJManager(
        4000,
        withShares(businessOwners, [1, 2])
      );
      await addContribution(cSBT, cContributionPool, boardingMembers[0], 1);
      await addContribution(cSBT, cContributionPool, boardingMembers[1], 2);
      await cPJManager.connect(depositer).deposit({ value: 100 });

      const tx = await allocateNative(cPJManager, cSBT);

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
      const { cPJManager, cSBT } = await deployPJManager(
        0,
        withShares(businessOwners, [1, 2])
      );
      await addContribution(cSBT, cContributionPool, boardingMembers[0], 1);
      await addContribution(cSBT, cContributionPool, boardingMembers[1], 2);
      await cPJManager.connect(depositer).deposit({ value: 100 });

      const tx = await allocateNative(cPJManager, cSBT);

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
      const { cPJManager, cSBT } = await deployPJManager(
        10000,
        withShares(businessOwners, [0, 0])
      );
      await addContribution(cSBT, cContributionPool, boardingMembers[0], 1);
      await addContribution(cSBT, cContributionPool, boardingMembers[1], 2);
      await cPJManager.connect(depositer).deposit({ value: 100 });

      const tx = await allocateNative(cPJManager, cSBT);

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
      const { cPJManager, cSBT } = await deployPJManager(
        4000,
        withShares(businessOwners, [1, 2])
      );
      await cPJManager.connect(depositer).deposit({ value: 100 });

      const tx = await allocateNative(cPJManager, cSBT);

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
      const { cPJManager, cERC20, cSBT } = await deployPJManager(
        4000,
        withShares(businessOwners, [1, 2])
      );
      await addContribution(cSBT, cContributionPool, boardingMembers[0], 1);
      await addContribution(cSBT, cContributionPool, boardingMembers[1], 2);
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cPJManager.connect(depositer).depositERC20(cERC20.address, 100);

      await allocateERC20(cPJManager, cERC20, cSBT);

      expect(await cERC20.balanceOf(boardingMembers[0].address)).equals(12);
      expect(await cERC20.balanceOf(boardingMembers[1].address)).equals(25);
      expect(await cERC20.balanceOf(businessOwners[0].address)).equals(20);
      expect(await cERC20.balanceOf(businessOwners[1].address)).equals(40);
      expect(await cERC20.balanceOf(daoTreasuryPool.address)).equals(3);
    });

    it("[S] ERC20: should allocate all tokens to businessOwners when boardingMembersProportion is 0", async function () {
      const { cPJManager, cERC20, cSBT } = await deployPJManager(
        0,
        withShares(businessOwners, [1, 2])
      );
      await addContribution(cSBT, cContributionPool, boardingMembers[0], 1);
      await addContribution(cSBT, cContributionPool, boardingMembers[1], 2);
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cPJManager.connect(depositer).depositERC20(cERC20.address, 100);

      await allocateERC20(cPJManager, cERC20, cSBT);

      expect(await cERC20.balanceOf(boardingMembers[0].address)).equals(0);
      expect(await cERC20.balanceOf(boardingMembers[1].address)).equals(0);
      expect(await cERC20.balanceOf(businessOwners[0].address)).equals(32);
      expect(await cERC20.balanceOf(businessOwners[1].address)).equals(64);
      expect(await cERC20.balanceOf(daoTreasuryPool.address)).equals(4);
    });

    it("[S] ERC20: should allocate all to boardingMembers when boardingMembersProportion is 10000", async function () {
      const { cPJManager, cERC20, cSBT } = await deployPJManager(
        10000,
        withShares(businessOwners, [0, 0])
      );
      await addContribution(cSBT, cContributionPool, boardingMembers[0], 1);
      await addContribution(cSBT, cContributionPool, boardingMembers[1], 2);
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cPJManager.connect(depositer).depositERC20(cERC20.address, 100);

      await allocateERC20(cPJManager, cERC20, cSBT);

      expect(await cERC20.balanceOf(boardingMembers[0].address)).equals(32);
      expect(await cERC20.balanceOf(boardingMembers[1].address)).equals(64);
      expect(await cERC20.balanceOf(businessOwners[0].address)).equals(0);
      expect(await cERC20.balanceOf(businessOwners[1].address)).equals(0);
      expect(await cERC20.balanceOf(daoTreasuryPool.address)).equals(4);
    });

    it("[S] ERC20: should allocate all to businessOwners when no boardingMember exists", async function () {
      const { cPJManager, cERC20, cSBT } = await deployPJManager(
        4000,
        withShares(businessOwners, [1, 2])
      );
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cPJManager.connect(depositer).depositERC20(cERC20.address, 100);

      await allocateERC20(cPJManager, cERC20, cSBT);

      expect(await cERC20.balanceOf(boardingMembers[0].address)).equals(0);
      expect(await cERC20.balanceOf(boardingMembers[1].address)).equals(0);
      expect(await cERC20.balanceOf(businessOwners[0].address)).equals(32);
      expect(await cERC20.balanceOf(businessOwners[1].address)).equals(64);
      expect(await cERC20.balanceOf(daoTreasuryPool.address)).equals(4);
    });
  });
});
