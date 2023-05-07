/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import * as chai from "chai";
import { BigNumber, utils } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  ContributionCalculator,
  ContributionCalculator__factory,
  ContributionPool,
  ContributionPool__factory,
  RandomERC20,
  RandomERC20__factory,
  SBT,
  SBT__factory,
  PJManager__factory,
  MockCallerContract__factory,
  MockCallerContract,
  PJManager,
} from "../../typechain";
import { AllocationShare, TestUtils } from "../testUtils";
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
  let sbtMinter: SignerWithAddress;
  let businessOwners: SignerWithAddress[];
  let user: SignerWithAddress;
  let cMockQuestryPlatform: MockCallerContract;
  let cCalculator: ContributionCalculator;
  let cContributionPool: ContributionPool;


  const dummyAddress = "0x90fA7809574b4f8206ec1a47aDc37eCEE57443cb";

  const maxBasisPoint = 10000;

  const nativeMode = utils.keccak256(utils.toUtf8Bytes("NATIVE")).slice(0, 10);
  const erc20Mode = utils.keccak256(utils.toUtf8Bytes("ERC20")).slice(0, 10);

  const withdrawRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PJ_WITHDRAW_ROLE")
  );

  const managementRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PJ_MANAGEMENT_ROLE")
  );

  const depositRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PJ_DEPOSIT_ROLE")
  );

  const whitelistRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PJ_WHITELIST_ROLE")
  );

  function missingRoleError(address: string, roleHash: string) {
    return `AccessControl: account ${address.toLowerCase()} is missing role ${roleHash}`;
  }

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
      cMockQuestryPlatform.address,
      admin.address,
      _boardingMembersProportion,
      _businessOwners
    );
    await cPJManager.deployed();

    // assign roles
    await cPJManager
      .connect(admin)
      .grantRole(managementRoleHash, stateManager.address);
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
      ethers.constants.AddressZero
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

  async function deployDummyPJManager() {
    return await deployPJManager(0, withShares(businessOwners, [1, 1]));
  }

  beforeEach(async function () {
    let rest: SignerWithAddress[];
    [
      deployer,
      admin,
      signer,
      signer2,
      signer3,
      stateManager,
      whitelistController,
      depositer,
      sbtMinter,
      user,
      ...rest
    ] = await ethers.getSigners();
    businessOwners = rest.slice(0, 2);

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
      await deployPJManager(0, withShares(businessOwners, [1, 1]));
    });

    it("[S] should deploy if boardingMembersProportion is 4000", async function () {
      await deployPJManager(4000, withShares(businessOwners, [1, 1]));
    });

    it("[S] should deploy if boardingMembersProportion is MAX_BASIS_POINT", async function () {
      await deployPJManager(maxBasisPoint, withShares(businessOwners, [0, 0]));
    });

    it("[R] should not deploy if boardingMembersProportion is over MAX_BASIS_POINT", async function () {
      await expect(
        deployPJManager(maxBasisPoint + 1, withShares(businessOwners, [1, 1]))
      ).revertedWith("LibPJManager: proportion is out of range");
    });

    it("[R] should not deploy if boardingMembersProportion is MAX_BASIS_POINT but businessOwnersShare exists", async function () {
      await expect(
        deployPJManager(maxBasisPoint, withShares(businessOwners, [1, 1]))
      ).revertedWith(
        "PJManager: proportion should be less than MAX_BASIS_POINT or businessOwners share should not exist"
      );
    });

    it("[R] should not deploy if boardingMembersProportion is less than MAX_BASIS_POINT (is 4000) but businessOwnersShare doesn't exist", async function () {
      await expect(
        deployPJManager(4000, withShares(businessOwners, [0, 0]))
      ).revertedWith(
        "LibPJManager: businessOwners share should exist unless proportion is MAX_BASIS_POINT"
      );
    });

    it("[R] should not deploy if boardingMembersProportion is less than MAX_BASIS_POINT (is 0) but businessOwnersShare doesn't exist", async function () {
      await expect(
        deployPJManager(0, withShares(businessOwners, [0, 0]))
      ).revertedWith(
        "LibPJManager: businessOwners share should exist unless proportion is MAX_BASIS_POINT"
      );
    });
  });

 /* describe("addBusinessOwner", function () {
    let cPJManager: PJManager;

    beforeEach(async function () {
      ({ cPJManager } = await deployPJManager(
        4000,
        withShares(businessOwners, [1, 2])
      ));
    });

    it("[S] should addBusinessOwner by stateManager", async function () {
      const arg = { recipient: dummyAddress, share: 3 };
      const tx = await cPJManager.connect(stateManager).addBusinessOwner(arg);
      expect(tx)
        .to.emit(cPJManager, "AddBusinessOwner")
        .withArgs(arg.recipient, arg.share);
      const got = await cPJManager.getBusinessOwners();
      expect(got.length).equals(3);
      expect(got[0].recipient).equals(businessOwners[0].address);
      expect(got[0].share).equals(1);
      expect(got[1].recipient).equals(businessOwners[1].address);
      expect(got[1].share).equals(2);
      expect(got[2].recipient).equals(arg.recipient);
      expect(got[2].share).equals(arg.share);
    });

    it("[S] should addBusinessOwner by admin", async function () {
      const arg = { recipient: dummyAddress, share: 3 };
      await cPJManager.connect(admin).addBusinessOwner(arg);
      const got = await cPJManager.getBusinessOwners();
      expect(got.length).equals(3);
      expect(got[2].recipient).equals(arg.recipient);
      expect(got[2].share).equals(arg.share);
    });

    it("[R] should not addBusinessOwner by others", async function () {
      const arg = { recipient: dummyAddress, share: 3 };
      await expect(cPJManager.connect(user).addBusinessOwner(arg)).revertedWith(
        missingRoleError(user.address, managementRoleHash)
      );
    });

    it("[R] should not add existing owner", async function () {
      const arg = { recipient: businessOwners[0].address, share: 3 };
      await expect(
        cPJManager.connect(stateManager).addBusinessOwner(arg)
      ).revertedWith("PJManager: businessOwner already exists");
    });

    it("[R] should not addBusinessOwner if allocation validation fails", async function () {
      ({ cPJManager } = await deployPJManager(
        maxBasisPoint,
        withShares(businessOwners, [0, 0])
      ));
      const arg = { recipient: dummyAddress, share: 3 };
      await expect(
        cPJManager.connect(stateManager).addBusinessOwner(arg)
      ).revertedWith(
        "PJManager: proportion should be less than MAX_BASIS_POINT or businessOwners share should not exist"
      );
    });
  });

  describe("removeBusinessOwner", function () {
    let cPJManager: PJManager;

    beforeEach(async function () {
      ({ cPJManager } = await deployPJManager(
        4000,
        withShares(businessOwners, [1, 2])
      ));
    });

    it("[S] should removeBusinessOwner by stateManager", async function () {
      const tx = await cPJManager
        .connect(stateManager)
        .removeBusinessOwner(businessOwners[0].address);
      expect(tx)
        .to.emit(cPJManager, "RemoveBusinessOwner")
        .withArgs(businessOwners[0].address);
      const got = await cPJManager.getBusinessOwners();
      expect(got.length).equals(1);
      expect(got[0].recipient).equals(businessOwners[1].address);
      expect(got[0].share).equals(BigNumber.from(2));
    });

    it("[S] should removeBusinessOwner by admin", async function () {
      ({ cPJManager } = await deployPJManager(
        4000,
        withShares(businessOwners, [1, 2])
      ));
      await cPJManager
        .connect(admin)
        .removeBusinessOwner(businessOwners[0].address);
      const got = await cPJManager.getBusinessOwners();
      expect(got.length).equals(1);
      expect(got[0].recipient).equals(businessOwners[1].address);
      expect(got[0].share).equals(BigNumber.from(2));
    });

    it("[R] should not removeBusinessOwner by others", async function () {
      await expect(
        cPJManager.connect(user).removeBusinessOwner(businessOwners[0].address)
      ).revertedWith(missingRoleError(user.address, managementRoleHash));
    });

    it("[R] should not remove non-existing owner", async function () {
      await expect(
        cPJManager.connect(stateManager).removeBusinessOwner(dummyAddress)
      ).revertedWith("PJManager: businessOwner doesn't exist");
    });

    it("[R] should not removeBusinessOwner if allocation validation fails", async function () {
      await cPJManager
        .connect(stateManager)
        .removeBusinessOwner(businessOwners[0].address);
      await expect(
        cPJManager
          .connect(stateManager)
          .removeBusinessOwner(businessOwners[1].address)
      ).revertedWith(
        "LibPJManager: businessOwners share should exist unless proportion is MAX_BASIS_POINT"
      );
    });
  });

  describe("updateBusinessOwner", function () {
    let cPJManager: PJManager;

    beforeEach(async function () {
      ({ cPJManager } = await deployPJManager(
        4000,
        withShares(businessOwners, [1, 2])
      ));
    });

    it("[S] should updateBusinessOwner by stateManager", async function () {
      const arg = { recipient: businessOwners[0].address, share: 123 };
      await cPJManager.connect(stateManager).updateBusinessOwner(arg);
      const got = await cPJManager.getBusinessOwners();
      expect(got.length).equals(2);
      expect(got[0].recipient).equals(businessOwners[0].address);
      expect(got[0].share).equals(arg.share);
      expect(got[1].recipient).equals(businessOwners[1].address);
      expect(got[1].share).equals(2);
    });

    it("[S] should updateBusinessOwner by admin", async function () {
      const arg = { recipient: businessOwners[0].address, share: 123 };
      await cPJManager.connect(admin).updateBusinessOwner(arg);
      const got = await cPJManager.getBusinessOwners();
      expect(got.length).equals(2);
      expect(got[0].recipient).equals(businessOwners[0].address);
      expect(got[0].share).equals(arg.share);
      expect(got[1].recipient).equals(businessOwners[1].address);
      expect(got[1].share).equals(2);
    });

    it("[R] should not updateBusinessOwner by others", async function () {
      const arg = { recipient: businessOwners[0].address, share: 123 };
      await expect(
        cPJManager.connect(user).updateBusinessOwner(arg)
      ).revertedWith(missingRoleError(user.address, managementRoleHash));
    });

    it("[R] should not update non-existing owner", async function () {
      const arg = { recipient: dummyAddress, share: 123 };
      await expect(
        cPJManager.connect(stateManager).updateBusinessOwner(arg)
      ).revertedWith("PJManager: businessOwner doesn't exist");
    });

    it("[R] should not updateBusinessOwner if allocation validation fails", async function () {
      let arg = { recipient: businessOwners[0].address, share: 0 };
      await cPJManager.connect(stateManager).updateBusinessOwner(arg);

      arg = { recipient: businessOwners[1].address, share: 0 };
      await expect(
        cPJManager.connect(stateManager).updateBusinessOwner(arg)
      ).revertedWith(
        "LibPJManager: businessOwners share should exist unless proportion is MAX_BASIS_POINT"
      );
    });
  });*/

  describe("verifysignature (unit test)", function () {
    let cPJManager: PJManager;
    let cERC20:  RandomERC20;
    let cDummyERC20: RandomERC20;
    let cSBT: SBT;
    let cContributionPool: ContributionPool;
    let cContributionPool2: ContributionPool;

    beforeEach(async function () {
      ({  cPJManager, 
          cERC20 , 
          cSBT
        } = await deployPJManager(
        4000,
        withShares(businessOwners, [1, 2])
      ));

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
      
      const SharesWithLinearArgs = {
        pools: [cContributionPool.address,cContributionPool2.address],
        coefs: [2, 3]
      }
      
      const args: any = { 
        pjManager: cPJManager.address,
        paymentMode: erc20Mode,
        paymentToken: cERC20.address,
        board: cSBT.address,
        calculateArgs: TestUtils.createArgsWithLinear(SharesWithLinearArgs),
        updateNeededPools: [cContributionPool.address,cContributionPool2.address],
        ContributePoolOwner: [signer.address,signer.address],
        pjnonce: (Number(await cPJManager.GetNonce())).toString()
      };

      //EIP712 create domain separator
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
          { name: "ContributePoolOwner", type: "address[]" },
          { name: "pjnonce", type: "uint256" }
        ],
        CalculateDispatchArgs:[
          { name: "algorithm", type: "bytes4" },
          { name: "args", type: "bytes" }
        ]
      };

      const message = await signer._signTypedData(domain, types2, args);
      console.log(message)
      const recoveraddress = ethers.utils.verifyTypedData(domain,types2,args,message)
      console.log(signer.address)
      console.log(recoveraddress)

      expect(
        await cPJManager.verifySignature(args ,[message])
      ).to.be.equal(true)


    });
  });
  /**
   * ご参考

function verifySignaturesForAllocation(args: AllocateArgs, signature: string): string {
  const provider = new ethers.providers.JsonRpcProvider();
  const domain = {
    name: "QUESTRY_PLATFORM",
    version: "1.0",
    chainId: provider.getNetwork().then((network) => network.chainId),
    verifyingContract: args.pjManager,

  };

  
  const recoveredAddress = ethers.utils.verifyTypedData(domain, { AllocateArgs, CalculateDispatchArgs }, args, signature);

  return recoveredAddress;
}
   */
  /**＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊＊/

/*  describe("allowERC20", function () {
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
      ).revertedWith(missingRoleError(user.address, whitelistRoleHash));
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
      ).revertedWith(missingRoleError(user.address, whitelistRoleHash));
    });
  });

  describe("deposit", function () {
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

    it("[S] should deposit native tokens by depositer", async function () {
      const tx = await cPJManager.connect(depositer).deposit({ value: 2 });
      expect(await ethers.provider.getBalance(cPJManager.address)).equals(2);
      expect(tx).to.emit(cPJManager, "Deposit").withArgs(depositer.address, 2);
    });

    it("[S] should deposit native tokens by admin", async function () {
      await cPJManager.connect(admin).deposit({ value: 2 });
      expect(await ethers.provider.getBalance(cPJManager.address)).equals(2);
    });

    it("[R] should not deposit native tokens by others", async function () {
      await expect(cPJManager.connect(user).deposit({ value: 2 })).revertedWith(
        missingRoleError(user.address, depositRoleHash)
      );
    });
  });

  describe("depositERC20", function () {
    let cPJManager: PJManager;
    let cERC20: RandomERC20;

    beforeEach(async function () {
      ({ cPJManager, cERC20 } = await deployDummyPJManager());
    });

    it("[S] should depositERC20 by depositer", async function () {
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      const tx = await cPJManager
        .connect(depositer)
        .depositERC20(cERC20.address, 2);
      expect(await cERC20.balanceOf(cPJManager.address)).equals(2);
      expect(tx)
        .to.emit(cPJManager, "DepositERC20")
        .withArgs(cERC20.address, depositer.address, 2);
    });

    it("[S] should depositERC20 by admin", async function () {
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cPJManager.connect(admin).depositERC20(cERC20.address, 2);
      expect(await cERC20.balanceOf(cPJManager.address)).equals(2);
    });

    it("[R] should not depositERC20 by others", async function () {
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await expect(
        cPJManager.connect(user).depositERC20(cERC20.address, 2)
      ).revertedWith(missingRoleError(user.address, depositRoleHash));
    });
  });

  describe("withdrawForAllocation", function () {
    let cPJManager: PJManager;
    let cERC20: RandomERC20;

    beforeEach(async function () {
      ({ cPJManager, cERC20 } = await deployDummyPJManager());
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cPJManager.connect(depositer).deposit({ value: 2 });
      await cPJManager.connect(depositer).depositERC20(cERC20.address, 2);
    });

    it("[S] should withdraw native token by QuestryPlatform", async function () {
      const tx = await TestUtils.call(
        cMockQuestryPlatform,
        cPJManager,
        "withdrawForAllocation(bytes4 paymentMode,address paymentToken,address receiver,uint256 amount)",
        [nativeMode, ethers.constants.AddressZero, user.address, 1]
      );
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
      expect(await cERC20.balanceOf(user.address)).equals(1);
    });

    it("[R] should not withdraw native token by others", async function () {
      await expect(
        cPJManager
          .connect(user)
          .withdrawForAllocation(
            nativeMode,
            ethers.constants.AddressZero,
            user.address,
            1
          )
      ).revertedWith(missingRoleError(user.address, withdrawRoleHash));
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
  });*/
});
