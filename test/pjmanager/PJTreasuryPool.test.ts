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
  MockKanamePlatform,
  MockKanamePlatform__factory,
  PJManagerMock__factory,
  PJTreasuryPool,
  PJTreasuryPool__factory,
  RandomERC20,
  RandomERC20__factory,
  SBT,
  SBT__factory,
} from "../../typechain";
import { TestUtils } from "../testUtils";

describe("PJTreasuryPool", function () {
  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let stateManager: SignerWithAddress;
  let whitelistController: SignerWithAddress;
  let depositer: SignerWithAddress;
  let sbtMinter: SignerWithAddress;
  let contributionUpdater: SignerWithAddress;
  let businessOwners: SignerWithAddress[];
  let boardingMembers: SignerWithAddress[];
  let daoTreasuryPool: SignerWithAddress;
  let user: SignerWithAddress;
  let cMockKanamePlatform: MockKanamePlatform;
  let cCalculator: ContributionCalculator;
  let cContributionPool: ContributionPool;

  const dummyAddress = "0x90fA7809574b4f8206ec1a47aDc37eCEE57443cb";
  const dummyContract = "0x00E9C198af8F6a8692d83d1702e691A03F2cdc63";

  const nativeMode = utils.keccak256(utils.toUtf8Bytes("NATIVE")).slice(0, 10);
  const erc20Mode = utils.keccak256(utils.toUtf8Bytes("ERC20")).slice(0, 10);

  const managementRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PJ_MANAGEMENT_ROLE")
  );
  const depositRoleHash = utils.keccak256(utils.toUtf8Bytes("PJ_DEPOSIT_ROLE"));
  const allocateRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PJ_ALLOCATE_ROLE")
  );
  const whitelistRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PJ_WHITELIST_ROLE")
  );

  function missingRoleError(address: string, roleHash: string) {
    return `AccessControl: account ${address.toLowerCase()} is missing role ${roleHash}`;
  }

  type AllocationShare = {
    recipient: string;
    share: number;
  };

  function withShares(
    recipients: SignerWithAddress[],
    shares: number[]
  ): AllocationShare[] {
    return recipients.map((r, i) => {
      return { recipient: r.address, share: shares[i] };
    });
  }

  async function deployTreasuryPool(
    _boardingMembersProportion: number,
    _businessOwners: AllocationShare[]
  ) {
    const cTreasuryPool = await new PJTreasuryPool__factory(deployer).deploy(
      cMockKanamePlatform.address,
      cCalculator.address,
      admin.address,
      _boardingMembersProportion,
      _businessOwners
    );
    await cTreasuryPool.deployed();

    // assign roles
    await cTreasuryPool
      .connect(admin)
      .grantRole(managementRoleHash, stateManager.address);
    await cTreasuryPool
      .connect(admin)
      .grantRole(depositRoleHash, depositer.address);
    await cTreasuryPool
      .connect(admin)
      .grantRole(whitelistRoleHash, whitelistController.address);

    // deploy mock PJManager
    const cMockPJManager = await new PJManagerMock__factory(deployer).deploy();
    await cMockPJManager.deployed();

    // deploy SBT associated with the project.
    const cSBT = await new SBT__factory(deployer).deploy(
      "board",
      "BRD",
      "https://example.com",
      cMockPJManager.address,
      sbtMinter.address,
      dummyContract
    );
    await cSBT.deployed();

    // deploy mock ERC20
    const cERC20 = await new RandomERC20__factory(deployer).deploy();
    await cERC20.mint([depositer.address, admin.address]);
    await cERC20.connect(depositer).approve(cTreasuryPool.address, 100);
    await cERC20.connect(admin).approve(cTreasuryPool.address, 100);

    return {
      cTreasuryPool,
      cMockPJManager,
      cSBT,
      cERC20,
    };
  }

  async function deployDummyPool() {
    return await deployTreasuryPool(0, withShares(businessOwners, [1, 1]));
  }

  beforeEach(async function () {
    let rest: SignerWithAddress[];
    [
      deployer,
      admin,
      stateManager,
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

    cMockKanamePlatform = await new MockKanamePlatform__factory(
      deployer
    ).deploy(daoTreasuryPool.address);
    await cMockKanamePlatform.deployed();

    cCalculator = await new ContributionCalculator__factory(deployer).deploy();
    await cCalculator.deployed();

    cContributionPool = await new ContributionPool__factory(deployer).deploy(
      0,
      dummyAddress,
      contributionUpdater.address
    );
    await cContributionPool.deployed();
  });

  describe("constructor", function () {
    it("[S] should deploy if boardingMembersProportion is 0", async function () {
      await deployTreasuryPool(0, withShares(businessOwners, [1, 1]));
    });

    it("[S] should deploy if boardingMembersProportion is 4000", async function () {
      await deployTreasuryPool(4000, withShares(businessOwners, [1, 1]));
    });

    it("[S] should deploy if boardingMembersProportion is 10000", async function () {
      await deployTreasuryPool(10000, withShares(businessOwners, [0, 0]));
    });

    it("[R] should not deploy if boardingMembersProportion is over 10000", async function () {
      await expect(
        deployTreasuryPool(10001, withShares(businessOwners, [1, 1]))
      ).revertedWith("PJTreasuryPool: proportion is out of range");
    });

    it("[R] should not deploy if boardingMembersProportion is 10000 but businessOwnersShare exists", async function () {
      await expect(
        deployTreasuryPool(10000, withShares(businessOwners, [1, 1]))
      ).revertedWith(
        "PJTreasuryPool: proportion should be less than 10000 or businessOwners share should not exist"
      );
    });

    it("[R] should not deploy if boardingMembersProportion is less than 10000 (is 4000) but businessOwnersShare doesn't exist", async function () {
      await expect(
        deployTreasuryPool(4000, withShares(businessOwners, [0, 0]))
      ).revertedWith(
        "PJTreasuryPool: businessOwners share should exist unless proportion is 10000"
      );
    });

    it("[R] should not deploy if boardingMembersProportion is less than 10000 (is 0) but businessOwnersShare doesn't exist", async function () {
      await expect(
        deployTreasuryPool(0, withShares(businessOwners, [0, 0]))
      ).revertedWith(
        "PJTreasuryPool: businessOwners share should exist unless proportion is 10000"
      );
    });
  });

  describe("addBusinessOwner", function () {
    let cTreasuryPool: PJTreasuryPool;

    beforeEach(async function () {
      ({ cTreasuryPool } = await deployTreasuryPool(
        4000,
        withShares(businessOwners, [1, 2])
      ));
    });

    it("[S] should addBusinessOwner by stateManager", async function () {
      const arg = { recipient: dummyAddress, share: 3 };
      const tx = await cTreasuryPool
        .connect(stateManager)
        .addBusinessOwner(arg);
      expect(tx)
        .to.emit(cTreasuryPool, "AddBusinessOwner")
        .withArgs(arg.recipient, arg.share);
      expect((await cTreasuryPool.businessOwners(2)).recipient).equals(
        arg.recipient
      );
      expect((await cTreasuryPool.businessOwners(2)).share).equals(arg.share);
    });

    it("[S] should addBusinessOwner by admin", async function () {
      const arg = { recipient: dummyAddress, share: 3 };
      await cTreasuryPool.connect(admin).addBusinessOwner(arg);
      expect((await cTreasuryPool.businessOwners(2)).recipient).equals(
        arg.recipient
      );
      expect((await cTreasuryPool.businessOwners(2)).share).equals(arg.share);
    });

    it("[R] should not addBusinessOwner by others", async function () {
      const arg = { recipient: dummyAddress, share: 3 };
      await expect(
        cTreasuryPool.connect(user).addBusinessOwner(arg)
      ).revertedWith(missingRoleError(user.address, managementRoleHash));
    });

    it("[R] should not add existing owner", async function () {
      const arg = { recipient: businessOwners[0].address, share: 3 };
      await expect(
        cTreasuryPool.connect(stateManager).addBusinessOwner(arg)
      ).revertedWith("PJTreasuryPool: businessOwner already exists");
    });

    it("[R] should not addBusinessOwner if allocation validation fails", async function () {
      ({ cTreasuryPool } = await deployTreasuryPool(
        10000,
        withShares(businessOwners, [0, 0])
      ));
      const arg = { recipient: dummyAddress, share: 3 };
      await expect(
        cTreasuryPool.connect(stateManager).addBusinessOwner(arg)
      ).revertedWith(
        "PJTreasuryPool: proportion should be less than 10000 or businessOwners share should not exist"
      );
    });
  });

  describe("removeBusinessOwner", function () {
    let cTreasuryPool: PJTreasuryPool;

    beforeEach(async function () {
      ({ cTreasuryPool } = await deployTreasuryPool(
        4000,
        withShares(businessOwners, [1, 2])
      ));
    });

    it("[S] should removeBusinessOwner by stateManager", async function () {
      const tx = await cTreasuryPool
        .connect(stateManager)
        .removeBusinessOwner(businessOwners[0].address);
      expect(tx)
        .to.emit(cTreasuryPool, "RemoveBusinessOwner")
        .withArgs(businessOwners[0].address);
      expect((await cTreasuryPool.businessOwners(0)).recipient).equals(
        businessOwners[1].address
      );
      expect((await cTreasuryPool.businessOwners(0)).share).equals(2);
    });

    it("[S] should removeBusinessOwner by admin", async function () {
      ({ cTreasuryPool } = await deployTreasuryPool(
        4000,
        withShares(businessOwners, [1, 2])
      ));
      await cTreasuryPool
        .connect(admin)
        .removeBusinessOwner(businessOwners[0].address);
      expect((await cTreasuryPool.businessOwners(0)).recipient).equals(
        businessOwners[1].address
      );
      expect((await cTreasuryPool.businessOwners(0)).share).equals(2);
    });

    it("[R] should not removeBusinessOwner by others", async function () {
      await expect(
        cTreasuryPool
          .connect(user)
          .removeBusinessOwner(businessOwners[0].address)
      ).revertedWith(missingRoleError(user.address, managementRoleHash));
    });

    it("[R] should not remove non-existing owner", async function () {
      await expect(
        cTreasuryPool.connect(stateManager).removeBusinessOwner(dummyAddress)
      ).revertedWith("PJTreasuryPool: businessOwner doesn't exist");
    });

    it("[R] should not removeBusinessOwner if allocation validation fails", async function () {
      await cTreasuryPool
        .connect(stateManager)
        .removeBusinessOwner(businessOwners[0].address);
      await expect(
        cTreasuryPool
          .connect(stateManager)
          .removeBusinessOwner(businessOwners[1].address)
      ).revertedWith(
        "PJTreasuryPool: businessOwners share should exist unless proportion is 10000"
      );
    });
  });

  describe("updateBusinessOwner", function () {
    let cTreasuryPool: PJTreasuryPool;

    beforeEach(async function () {
      ({ cTreasuryPool } = await deployTreasuryPool(
        4000,
        withShares(businessOwners, [1, 2])
      ));
    });

    it("[S] should updateBusinessOwner by stateManager", async function () {
      const arg = { recipient: businessOwners[0].address, share: 123 };
      await cTreasuryPool.connect(stateManager).updateBusinessOwner(arg);
      expect((await cTreasuryPool.businessOwners(0)).recipient).equals(
        arg.recipient
      );
      expect((await cTreasuryPool.businessOwners(0)).share).equals(arg.share);
    });

    it("[S] should updateBusinessOwner by admin", async function () {
      const arg = { recipient: businessOwners[0].address, share: 123 };
      await cTreasuryPool.connect(admin).updateBusinessOwner(arg);
      expect((await cTreasuryPool.businessOwners(0)).recipient).equals(
        arg.recipient
      );
      expect((await cTreasuryPool.businessOwners(0)).share).equals(arg.share);
    });

    it("[R] should not updateBusinessOwner by others", async function () {
      const arg = { recipient: businessOwners[0].address, share: 123 };
      await expect(
        cTreasuryPool.connect(user).updateBusinessOwner(arg)
      ).revertedWith(missingRoleError(user.address, managementRoleHash));
    });

    it("[R] should not update non-existing owner", async function () {
      const arg = { recipient: dummyAddress, share: 123 };
      await expect(
        cTreasuryPool.connect(stateManager).updateBusinessOwner(arg)
      ).revertedWith("PJTreasuryPool: businessOwner doesn't exist");
    });

    it("[R] should not updateBusinessOwner if allocation validation fails", async function () {
      let arg = { recipient: businessOwners[0].address, share: 0 };
      await cTreasuryPool.connect(stateManager).updateBusinessOwner(arg);

      arg = { recipient: businessOwners[1].address, share: 0 };
      await expect(
        cTreasuryPool.connect(stateManager).updateBusinessOwner(arg)
      ).revertedWith(
        "PJTreasuryPool: businessOwners share should exist unless proportion is 10000"
      );
    });
  });

  describe("allowERC20", function () {
    let cTreasuryPool: PJTreasuryPool;
    let cERC20: RandomERC20;

    beforeEach(async function () {
      ({ cTreasuryPool, cERC20 } = await deployDummyPool());
    });

    it("[S] should allow by whitelistController", async function () {
      await cTreasuryPool
        .connect(whitelistController)
        .allowERC20(cERC20.address);
      expect(await cTreasuryPool.getTokenWhitelists()).deep.equals([
        cERC20.address,
      ]);

      await cTreasuryPool
        .connect(whitelistController)
        .allowERC20(dummyContract);
      expect(await cTreasuryPool.getTokenWhitelists()).deep.equals([
        cERC20.address,
        dummyContract,
      ]);
    });

    it("[S] should allow by admin", async function () {
      await cTreasuryPool.connect(admin).allowERC20(cERC20.address);
      expect(await cTreasuryPool.getTokenWhitelists()).deep.equals([
        cERC20.address,
      ]);
    });

    it("[R] should not allow by others", async function () {
      await expect(
        cTreasuryPool.connect(user).allowERC20(cERC20.address)
      ).revertedWith(missingRoleError(user.address, whitelistRoleHash));
    });

    it("[R] should not allow if token is already whitelisted", async function () {
      await cTreasuryPool
        .connect(whitelistController)
        .allowERC20(cERC20.address);
      await expect(
        cTreasuryPool.connect(whitelistController).allowERC20(cERC20.address)
      ).revertedWith("PJTreasuryPool: already whitelisted");
    });
  });

  describe("disallowERC20", function () {
    let cTreasuryPool: PJTreasuryPool;
    let cERC20: RandomERC20;

    beforeEach(async function () {
      ({ cTreasuryPool, cERC20 } = await deployDummyPool());
    });

    it("[S] should disallow by whitelistController", async function () {
      await cTreasuryPool
        .connect(whitelistController)
        .allowERC20(cERC20.address);
      await cTreasuryPool
        .connect(whitelistController)
        .disallowERC20(cERC20.address);
      expect(await cTreasuryPool.getTokenWhitelists()).deep.equals([]);
    });

    it("[S] should disallow by admin", async function () {
      await cTreasuryPool
        .connect(whitelistController)
        .allowERC20(cERC20.address);
      await cTreasuryPool.connect(admin).disallowERC20(cERC20.address);
      expect(await cTreasuryPool.getTokenWhitelists()).deep.equals([]);
    });

    it("[S] should disallow even if not allowed the most recently", async function () {
      await cTreasuryPool
        .connect(whitelistController)
        .allowERC20(cERC20.address);
      await cTreasuryPool
        .connect(whitelistController)
        .allowERC20(dummyContract);
      expect(await cTreasuryPool.getTokenWhitelists()).deep.equals([
        cERC20.address,
        dummyContract,
      ]);
      await cTreasuryPool
        .connect(whitelistController)
        .disallowERC20(cERC20.address);
      expect(await cTreasuryPool.getTokenWhitelists()).deep.equals([
        dummyContract,
      ]);
    });

    it("[R] should not disallow if the whitelist is empty", async function () {
      await expect(
        cTreasuryPool.connect(whitelistController).disallowERC20(cERC20.address)
      ).revertedWith("PJTreasuryPool: not whitelisted");
    });

    it("[R] should not disallow by others", async function () {
      await cTreasuryPool
        .connect(whitelistController)
        .allowERC20(cERC20.address);
      await expect(
        cTreasuryPool.connect(user).disallowERC20(cERC20.address)
      ).revertedWith(missingRoleError(user.address, whitelistRoleHash));
    });
  });

  describe("deposit", function () {
    let cTreasuryPool: PJTreasuryPool;

    beforeEach(async function () {
      ({ cTreasuryPool } = await deployDummyPool());
    });

    it("[R] should not deposit native tokens directly", async function () {
      await expect(
        depositer.sendTransaction({
          to: cTreasuryPool.address,
          value: 2,
        })
      ).revertedWith(
        "function selector was not recognized and there's no fallback nor receive function"
      );
    });

    it("[S] should deposit native tokens by depositer", async function () {
      const tx = await cTreasuryPool.connect(depositer).deposit({ value: 2 });
      expect(await ethers.provider.getBalance(cTreasuryPool.address)).equals(2);
      expect(tx)
        .to.emit(cTreasuryPool, "Deposit")
        .withArgs(depositer.address, 2);
    });

    it("[S] should deposit native tokens by admin", async function () {
      await cTreasuryPool.connect(admin).deposit({ value: 2 });
      expect(await ethers.provider.getBalance(cTreasuryPool.address)).equals(2);
    });

    it("[R] should not deposit native tokens by others", async function () {
      await expect(
        cTreasuryPool.connect(user).deposit({ value: 2 })
      ).revertedWith(missingRoleError(user.address, depositRoleHash));
    });
  });

  describe("depositERC20", function () {
    let cTreasuryPool: PJTreasuryPool;
    let cERC20: RandomERC20;

    beforeEach(async function () {
      ({ cTreasuryPool, cERC20 } = await deployDummyPool());
    });

    it("[S] should depositERC20 by depositer", async function () {
      await cTreasuryPool
        .connect(whitelistController)
        .allowERC20(cERC20.address);
      const tx = await cTreasuryPool
        .connect(depositer)
        .depositERC20(cERC20.address, 2);
      expect(await cERC20.balanceOf(cTreasuryPool.address)).equals(2);
      expect(tx)
        .to.emit(cTreasuryPool, "DepositERC20")
        .withArgs(cERC20.address, depositer.address, 2);
    });

    it("[S] should depositERC20 by admin", async function () {
      await cTreasuryPool
        .connect(whitelistController)
        .allowERC20(cERC20.address);
      await cTreasuryPool.connect(admin).depositERC20(cERC20.address, 2);
      expect(await cERC20.balanceOf(cTreasuryPool.address)).equals(2);
    });

    it("[R] should not depositERC20 by others", async function () {
      await cTreasuryPool
        .connect(whitelistController)
        .allowERC20(cERC20.address);
      await expect(
        cTreasuryPool.connect(user).depositERC20(cERC20.address, 2)
      ).revertedWith(missingRoleError(user.address, depositRoleHash));
    });
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

    async function allocateNative(cTreasuryPool: PJTreasuryPool, cSBT: SBT) {
      return await cMockKanamePlatform.allocate({
        pjManager: cTreasuryPool.address,
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
      cTreasuryPool: PJTreasuryPool,
      cERC20: ERC20,
      cSBT: SBT
    ) {
      return await cMockKanamePlatform.allocate({
        pjManager: cTreasuryPool.address,
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

    it("[S] ETH: should allocate tokens in a typical scenario", async function () {
      const { cTreasuryPool, cSBT } = await deployTreasuryPool(
        4000,
        withShares(businessOwners, [1, 2])
      );
      await addContribution(cSBT, cContributionPool, boardingMembers[0], 1);
      await addContribution(cSBT, cContributionPool, boardingMembers[1], 2);
      await cTreasuryPool.connect(depositer).deposit({ value: 100 });

      const tx = await allocateNative(cTreasuryPool, cSBT);

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
      const { cTreasuryPool, cSBT } = await deployTreasuryPool(
        0,
        withShares(businessOwners, [1, 2])
      );
      await addContribution(cSBT, cContributionPool, boardingMembers[0], 1);
      await addContribution(cSBT, cContributionPool, boardingMembers[1], 2);
      await cTreasuryPool.connect(depositer).deposit({ value: 100 });

      const tx = await allocateNative(cTreasuryPool, cSBT);

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
      const { cTreasuryPool, cSBT } = await deployTreasuryPool(
        10000,
        withShares(businessOwners, [0, 0])
      );
      await addContribution(cSBT, cContributionPool, boardingMembers[0], 1);
      await addContribution(cSBT, cContributionPool, boardingMembers[1], 2);
      await cTreasuryPool.connect(depositer).deposit({ value: 100 });

      const tx = await allocateNative(cTreasuryPool, cSBT);

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
      const { cTreasuryPool, cSBT } = await deployTreasuryPool(
        4000,
        withShares(businessOwners, [1, 2])
      );
      await cTreasuryPool.connect(depositer).deposit({ value: 100 });

      const tx = await allocateNative(cTreasuryPool, cSBT);

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
      const { cTreasuryPool, cERC20, cSBT } = await deployTreasuryPool(
        4000,
        withShares(businessOwners, [1, 2])
      );
      await addContribution(cSBT, cContributionPool, boardingMembers[0], 1);
      await addContribution(cSBT, cContributionPool, boardingMembers[1], 2);
      await cTreasuryPool
        .connect(whitelistController)
        .allowERC20(cERC20.address);
      await cTreasuryPool.connect(depositer).depositERC20(cERC20.address, 100);

      await allocateERC20(cTreasuryPool, cERC20, cSBT);

      expect(await cERC20.balanceOf(boardingMembers[0].address)).equals(12);
      expect(await cERC20.balanceOf(boardingMembers[1].address)).equals(25);
      expect(await cERC20.balanceOf(businessOwners[0].address)).equals(20);
      expect(await cERC20.balanceOf(businessOwners[1].address)).equals(40);
      expect(await cERC20.balanceOf(daoTreasuryPool.address)).equals(3);
    });

    it("[S] ERC20: should allocate all tokens to businessOwners when boardingMembersProportion is 0", async function () {
      const { cTreasuryPool, cERC20, cSBT } = await deployTreasuryPool(
        0,
        withShares(businessOwners, [1, 2])
      );
      await addContribution(cSBT, cContributionPool, boardingMembers[0], 1);
      await addContribution(cSBT, cContributionPool, boardingMembers[1], 2);
      await cTreasuryPool
        .connect(whitelistController)
        .allowERC20(cERC20.address);
      await cTreasuryPool.connect(depositer).depositERC20(cERC20.address, 100);

      await allocateERC20(cTreasuryPool, cERC20, cSBT);

      expect(await cERC20.balanceOf(boardingMembers[0].address)).equals(0);
      expect(await cERC20.balanceOf(boardingMembers[1].address)).equals(0);
      expect(await cERC20.balanceOf(businessOwners[0].address)).equals(32);
      expect(await cERC20.balanceOf(businessOwners[1].address)).equals(64);
      expect(await cERC20.balanceOf(daoTreasuryPool.address)).equals(4);
    });

    it("[S] ERC20: should allocate all to boardingMembers when boardingMembersProportion is 10000", async function () {
      const { cTreasuryPool, cERC20, cSBT } = await deployTreasuryPool(
        10000,
        withShares(businessOwners, [0, 0])
      );
      await addContribution(cSBT, cContributionPool, boardingMembers[0], 1);
      await addContribution(cSBT, cContributionPool, boardingMembers[1], 2);
      await cTreasuryPool
        .connect(whitelistController)
        .allowERC20(cERC20.address);
      await cTreasuryPool.connect(depositer).depositERC20(cERC20.address, 100);

      await allocateERC20(cTreasuryPool, cERC20, cSBT);

      expect(await cERC20.balanceOf(boardingMembers[0].address)).equals(32);
      expect(await cERC20.balanceOf(boardingMembers[1].address)).equals(64);
      expect(await cERC20.balanceOf(businessOwners[0].address)).equals(0);
      expect(await cERC20.balanceOf(businessOwners[1].address)).equals(0);
      expect(await cERC20.balanceOf(daoTreasuryPool.address)).equals(4);
    });

    it("[S] ERC20: should allocate all to businessOwners when no boardingMember exists", async function () {
      const { cTreasuryPool, cERC20, cSBT } = await deployTreasuryPool(
        4000,
        withShares(businessOwners, [1, 2])
      );
      await cTreasuryPool
        .connect(whitelistController)
        .allowERC20(cERC20.address);
      await cTreasuryPool.connect(depositer).depositERC20(cERC20.address, 100);

      await allocateERC20(cTreasuryPool, cERC20, cSBT);

      expect(await cERC20.balanceOf(boardingMembers[0].address)).equals(0);
      expect(await cERC20.balanceOf(boardingMembers[1].address)).equals(0);
      expect(await cERC20.balanceOf(businessOwners[0].address)).equals(32);
      expect(await cERC20.balanceOf(businessOwners[1].address)).equals(64);
      expect(await cERC20.balanceOf(daoTreasuryPool.address)).equals(4);
    });
  });
});
