/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */
import { ethers, upgrades } from "hardhat";
import { utils } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  ContributionCalculator,
  ContributionCalculator__factory,
  RandomERC20__factory,
  Board__factory,
  PJManager__factory,
  PJManager,
  QuestryPlatform,
  RandomERC20,
  TokenControlProxy,
  QuestryForwarder,
} from "../../../typechain";
import { ExecutePaymentArgs } from "../../testUtils";
import { getMetaTx, getMetaTxAndSignForGas } from "../../utils";

describe("QuestryPlatform - executePayment", function () {
  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let whitelistController: SignerWithAddress;
  let boardMinter: SignerWithAddress;
  let businessOwner: SignerWithAddress;
  let signers: SignerWithAddress[];
  let daoTreasuryPool: SignerWithAddress;
  let cTokenControlProxy: TokenControlProxy;
  let cQuestryPlatform: QuestryPlatform;
  let cQuestryForwarder: QuestryForwarder;
  let cCalculator: ContributionCalculator;

  let cERC20: RandomERC20;
  let initialBalances: { [key: string]: number };
  let cPJManager: PJManager;

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

  const whitelistRoleHash = utils.keccak256(
    utils.toUtf8Bytes("PJ_WHITELIST_ROLE")
  );

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

  async function setupPaymentTypedData(args: ExecutePaymentArgs) {
    return signers[0]._signTypedData(
      await createDomainSeparator(cQuestryPlatform),
      createExecutePaymentTypes(),
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
      whitelistController,
      boardMinter,
      daoTreasuryPool,
      businessOwner,
      ...rest
    ] = await ethers.getSigners();
    signers = rest.slice(0, 3);

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
        deployer.address,
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

    // Deploy PJManager
    cPJManager = await new PJManager__factory(deployer).deploy(
      cQuestryPlatform.address,
      admin.address,
      4000,
      businessOwner.address
    );
    await cPJManager.deployed();

    // Grant ERC20 whitelist role to whitelistController
    await cPJManager
      .connect(admin)
      .grantRole(whitelistRoleHash, whitelistController.address);

    // Deploy ERC20
    cERC20 = await new RandomERC20__factory(deployer).deploy();
    await cERC20.mint([signers[0].address]);

    initialBalances = await (async () => {
      const result: { [key: string]: number } = {};
      for (const signer of signers) {
        result[signer.address] = (
          await cERC20.balanceOf(signer.address)
        ).toNumber();
      }
      return result;
    })();
  });

  describe("_checkParameters", function () {
    describe("when paymentMode is NATIVE", function () {
      it("[R] should revert if mismatch between _msgSender() and _args.from", async function () {
        const args: ExecutePaymentArgs = {
          paymentMode: nativeMode,
          paymentToken: ethers.constants.AddressZero,
          paymentCategory: commonPaymentCategory,
          pjManager: cPJManager.address,
          from: signers[0].address,
          to: signers[1].address,
          amount: 100,
          nonce: 0,
        };
        const typedData = await setupPaymentTypedData(args);

        await expect(
          cQuestryPlatform.connect(signers[2]).executePayment(args, typedData, {
            value: args.amount,
          })
        ).to.be.revertedWith(
          "QuestryPlatform: mismatch between _msgSender() and _args.from"
        );
      });

      it("[R] should revert if mismatch between msg.value and _args.amount", async function () {
        const args: ExecutePaymentArgs = {
          paymentMode: nativeMode,
          paymentToken: ethers.constants.AddressZero,
          paymentCategory: commonPaymentCategory,
          pjManager: cPJManager.address,
          from: signers[0].address,
          to: signers[1].address,
          amount: 100,
          nonce: 0,
        };
        const typedData = await setupPaymentTypedData(args);

        await expect(
          cQuestryPlatform.connect(signers[0]).executePayment(args, typedData, {
            value: +args.amount + 1,
          })
        ).to.be.revertedWith(
          "QuestryPlatform: mismatch between msg.value and _args.amount"
        );
      });

      it("[R] should revert if paymentToken exists", async function () {
        const args: ExecutePaymentArgs = {
          paymentMode: nativeMode,
          paymentToken: cERC20.address,
          paymentCategory: commonPaymentCategory,
          pjManager: cPJManager.address,
          from: signers[0].address,
          to: signers[1].address,
          amount: 100,
          nonce: 0,
        };
        const typedData = await setupPaymentTypedData(args);

        await expect(
          cQuestryPlatform.connect(signers[0]).executePayment(args, typedData, {
            value: args.amount,
          })
        ).to.be.revertedWith(
          "QuestryPlatform: paymentToken exists though paymentMode is NATIVE"
        );
      });
    });

    describe("when paymentMode is ERC20", function () {
      it("[R] should revert if msg.value != 0", async function () {
        const args: ExecutePaymentArgs = {
          paymentMode: erc20Mode,
          paymentToken: cERC20.address,
          paymentCategory: commonPaymentCategory,
          pjManager: cPJManager.address,
          from: signers[0].address,
          to: signers[1].address,
          amount: 100,
          nonce: 0,
        };
        const typedData = await setupPaymentTypedData(args);

        await expect(
          cQuestryPlatform
            .connect(signers[0])
            .executePayment(args, typedData, { value: 1 })
        ).to.be.revertedWith(
          "QuestryPlatform: msg.value != 0 though paymentMode is ERC20"
        );
      });

      it("[R] should revert if paymentToken doesn't exist", async function () {
        const args: ExecutePaymentArgs = {
          paymentMode: erc20Mode,
          paymentToken: ethers.constants.AddressZero,
          paymentCategory: commonPaymentCategory,
          pjManager: cPJManager.address,
          from: signers[0].address,
          to: signers[1].address,
          amount: 100,
          nonce: 0,
        };
        const typedData = await setupPaymentTypedData(args);

        await expect(
          cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
        ).to.be.revertedWith(
          "QuestryPlatform: paymentToken doesn't exist though paymentMode is ERC20"
        );
      });

      it("[R] should revert if paymentToken doesn't approve tokenControlProxy", async function () {
        await cPJManager
          .connect(whitelistController)
          .allowERC20(cERC20.address);

        cERC20.connect(signers[0]).approve(cTokenControlProxy.address, 1);

        const args: ExecutePaymentArgs = {
          paymentMode: erc20Mode,
          paymentToken: cERC20.address,
          paymentCategory: commonPaymentCategory,
          pjManager: cPJManager.address,
          from: signers[0].address,
          to: signers[1].address,
          amount: 2,
          nonce: 0,
        };
        let typedData = await setupPaymentTypedData(args);

        await expect(
          cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
        ).to.be.revertedWith("QuestryPlatform: insufficient allowance");

        args.amount = 1;
        typedData = await setupPaymentTypedData(args);

        await cQuestryPlatform
          .connect(signers[0])
          .executePayment(args, typedData);
      });

      it("[R] should revert if paymentToken is not whitelisted", async function () {
        // await cPJManager.connect(whitelistController).allowERC20(cERC20.address);

        const amount = 100;

        await cERC20
          .connect(signers[0])
          .approve(cTokenControlProxy.address, amount);
        const args: ExecutePaymentArgs = {
          paymentMode: erc20Mode,
          paymentToken: cERC20.address,
          paymentCategory: commonPaymentCategory,
          pjManager: cPJManager.address,
          from: signers[0].address,
          to: signers[1].address,
          amount: 100,
          nonce: 0,
        };
        const typedData = await setupPaymentTypedData(args);

        await expect(
          cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
        ).to.be.revertedWith("QuestryPlatform: token not whitelisted");
      });
    });

    describe("when paymentMode is unknown", function () {
      it("[R] should revert", async function () {
        const args: ExecutePaymentArgs = {
          paymentMode: utils
            .keccak256(utils.toUtf8Bytes("UNKNOWN"))
            .slice(0, 10),
          pjManager: cPJManager.address,
          paymentToken: ethers.constants.AddressZero,
          paymentCategory: commonPaymentCategory,
          from: signers[0].address,
          to: signers[1].address,
          amount: 100,
          nonce: 0,
        };
        const typedData = await setupPaymentTypedData(args);

        await expect(
          cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
        ).to.be.revertedWith("QuestryPlatform: unknown paymentMode");
      });
    });

    it("[R] should revert if to is zero address if common payment", async function () {
      const amount = 100;

      await cERC20
        .connect(signers[0])
        .approve(cTokenControlProxy.address, amount);

      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);

      const args: ExecutePaymentArgs = {
        paymentMode: erc20Mode,
        paymentToken: cERC20.address,
        paymentCategory: commonPaymentCategory,
        pjManager: cPJManager.address,
        from: signers[0].address,
        to: ethers.constants.AddressZero,
        amount,
        nonce: 0,
      };
      const typedData = await setupPaymentTypedData(args);

      await expect(
        cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
      ).to.be.revertedWith(
        "QuestryPlatform: 'to' is zero address though paymentCategory is COMMON_PAYMENT_CATEGORY"
      );
    });

    it("[R] should revert if to is not zero address if invest payment", async function () {
      const amount = 100;

      await cERC20
        .connect(signers[0])
        .approve(cTokenControlProxy.address, amount);

      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);

      const args: ExecutePaymentArgs = {
        paymentMode: erc20Mode,
        paymentToken: cERC20.address,
        paymentCategory: investmentPaymentCategory,
        pjManager: cPJManager.address,
        from: signers[0].address,
        to: signers[1].address,
        amount,
        nonce: 0,
      };
      const typedData = await setupPaymentTypedData(args);

      await expect(
        cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
      ).to.be.revertedWith(
        "QuestryPlatform: 'to' is not zero address though paymentCategory is INVESTMENT_PAYMENT_CATEGORY or PROTOCOL_PAYMENT_CATEGORY"
      );
    });

    it("[R] should revert if to is not zero address if protocol payment", async function () {
      const amount = 100;

      await cERC20
        .connect(signers[0])
        .approve(cTokenControlProxy.address, amount);

      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);

      const args: ExecutePaymentArgs = {
        paymentMode: erc20Mode,
        paymentToken: cERC20.address,
        paymentCategory: investmentPaymentCategory,
        pjManager: cPJManager.address,
        from: signers[0].address,
        to: signers[1].address,
        amount,
        nonce: 0,
      };
      const typedData = await setupPaymentTypedData(args);

      await expect(
        cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
      ).to.be.revertedWith(
        "QuestryPlatform: 'to' is not zero address though paymentCategory is INVESTMENT_PAYMENT_CATEGORY or PROTOCOL_PAYMENT_CATEGORY"
      );
    });

    it("[R] should revert if amount is zero", async function () {
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      const args: ExecutePaymentArgs = {
        paymentMode: erc20Mode,
        paymentToken: cERC20.address,
        paymentCategory: commonPaymentCategory,
        pjManager: cPJManager.address,
        from: signers[0].address,
        to: signers[1].address,
        amount: 0,
        nonce: 0,
      };
      const typedData = await setupPaymentTypedData(args);

      await expect(
        cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
      ).to.be.revertedWith("QuestryPlatform: amount is zero");
    });

    it("[R] should revert if nonce is invalid", async function () {
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cERC20
        .connect(signers[0])
        .approve(cTokenControlProxy.address, 1000000);
      const createArgs = (nonce: number): ExecutePaymentArgs => {
        return {
          paymentMode: erc20Mode,
          paymentToken: cERC20.address,
          paymentCategory: commonPaymentCategory,
          pjManager: cPJManager.address,
          from: signers[0].address,
          to: signers[1].address,
          amount: 1,
          nonce,
        };
      };

      let args = createArgs(1);
      let typedData = await setupPaymentTypedData(args);
      await expect(
        cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
      ).to.be.revertedWith("QuestryPlatform: invalid nonce");

      args = createArgs(0);
      typedData = await setupPaymentTypedData(args);
      await cQuestryPlatform
        .connect(signers[0])
        .executePayment(args, typedData);

      args = createArgs(1);
      typedData = await setupPaymentTypedData(args);
      await cQuestryPlatform
        .connect(signers[0])
        .executePayment(args, typedData);

      args = createArgs(2);
      typedData = await setupPaymentTypedData(args);
      await expect(
        cQuestryPlatform
          .connect(signers[0])
          .executePayment({ ...args, nonce: 3 }, typedData)
      ).to.be.revertedWith("QuestryPlatform: invalid nonce");
    });

    it("[R] should revert if nonce is invalid (replay attack)", async function () {
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cERC20
        .connect(signers[0])
        .approve(cTokenControlProxy.address, 1000000);
      const args: ExecutePaymentArgs = {
        paymentMode: erc20Mode,
        paymentToken: cERC20.address,
        paymentCategory: commonPaymentCategory,
        pjManager: cPJManager.address,
        from: signers[0].address,
        to: signers[1].address,
        amount: 1,
        nonce: 0,
      };
      const typedData = await setupPaymentTypedData(args);

      await cQuestryPlatform
        .connect(signers[0])
        .executePayment(args, typedData);
      await expect(
        cQuestryPlatform.connect(signers[0]).executePayment(args, typedData)
      ).revertedWith("QuestryPlatform: invalid nonce");
    });
  });

  describe("executePayment", function () {
    type PaymentCategoryTestcase = {
      paymentCategory: string;
      defaultFeeRate: number;
      feeRateSetter:
        | "setCommonFeeRate"
        | "setInvestmentFeeRate"
        | "setProtocolFeeRate";
    };

    const executePaymentAndVerify = async (
      paymentMode: string,
      args: ExecutePaymentArgs,
      typedData: string,
      fromSigner: SignerWithAddress,
      expected: ExpectedByAmounts
    ) => {
      if (paymentMode === "NATIVE") {
        const tx = await cQuestryPlatform
          .connect(fromSigner)
          .executePayment(args, typedData, {
            value: args.amount,
          });
        await expect(tx).to.changeEtherBalances(
          expected.accounts,
          expected.byAmounts
        );
      } else if (paymentMode === "ERC20") {
        await cQuestryPlatform
          .connect(fromSigner)
          .executePayment(args, typedData);
        for (const [index, signer] of expected.accounts.entries()) {
          const byAmount = expected.byAmounts[index];
          expect(await cERC20.balanceOf(signer.address)).equals(
            (initialBalances[signer.address] ?? 0) + byAmount
          );
        }
      } else {
        throw new Error("Invalid payment mode");
      }
    };

    const createPaymentArgs = (
      modeLiteral: string,
      testcase: PaymentCategoryTestcase,
      to: string,
      paymentToken: string
    ): ExecutePaymentArgs => ({
      paymentMode: modeLiteral === "NATIVE" ? nativeMode : erc20Mode,
      paymentToken,
      paymentCategory: testcase.paymentCategory,
      pjManager: cPJManager.address,
      from: signers[0].address,
      to,
      amount: 100,
      nonce: 0,
    });

    const getPaymentToken = (modeLiteral: string) =>
      modeLiteral === "NATIVE" ? ethers.constants.AddressZero : cERC20.address;

    const getToAddress = (testcase: PaymentCategoryTestcase) =>
      testcase.paymentCategory === commonPaymentCategory
        ? signers[1].address
        : ethers.constants.AddressZero;

    // Payment Modes
    const paymentModes = ["NATIVE", "ERC20"];

    // Function to execute payment for both cases
    const executePaymentForCase = async (
      modeLiteral: string,
      testcase: PaymentCategoryTestcase,
      expected: ExpectedByAmounts
    ) => {
      const paymentToken = getPaymentToken(modeLiteral);
      const to = getToAddress(testcase);

      const args = createPaymentArgs(modeLiteral, testcase, to, paymentToken);
      const typedData = await setupPaymentTypedData(args);

      await executePaymentAndVerify(
        modeLiteral,
        args,
        typedData,
        signers[0],
        expected
      );
    };

    beforeEach(async () => {
      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cERC20.connect(signers[0]).approve(cTokenControlProxy.address, 100);
      await cERC20.connect(signers[0]).approve(cPJManager.address, 100);
    });

    describe("common payment", function () {
      const testcase: PaymentCategoryTestcase = {
        paymentCategory: commonPaymentCategory,
        defaultFeeRate: 300,
        feeRateSetter: "setCommonFeeRate",
      };

      paymentModes.forEach((modeLiteral) => {
        it(`[S] ${modeLiteral}: should executePayment (fee default)`, async () => {
          await executePaymentForCase(modeLiteral, testcase, {
            accounts: [signers[0], signers[1], daoTreasuryPool],
            byAmounts: [-100, 97, 3],
          });
        });

        it(`[S] ${modeLiteral}: should executePayment (fee changed)`, async () => {
          const feeRate = testcase.defaultFeeRate + 100;
          await cQuestryPlatform[testcase.feeRateSetter!](feeRate);
          await executePaymentForCase(modeLiteral, testcase, {
            accounts: [signers[0], signers[1], daoTreasuryPool],
            byAmounts: [-100, 96, 4],
          });
        });
      });
    });

    describe("investment payment", function () {
      const testcase: PaymentCategoryTestcase = {
        paymentCategory: investmentPaymentCategory,
        defaultFeeRate: 300,
        feeRateSetter: "setInvestmentFeeRate",
      };

      paymentModes.forEach((modeLiteral) => {
        it(`[S] ${modeLiteral}: should executePayment (fee default)`, async () => {
          await executePaymentForCase(modeLiteral, testcase, {
            accounts: [signers[0], businessOwner, daoTreasuryPool],
            byAmounts: [-100, 97, 3],
          });
        });

        it(`[S] ${modeLiteral}: should executePayment (fee changed)`, async () => {
          const feeRate = testcase.defaultFeeRate + 100;
          await cQuestryPlatform[testcase.feeRateSetter!](feeRate);
          await executePaymentForCase(modeLiteral, testcase, {
            accounts: [signers[0], businessOwner, daoTreasuryPool],
            byAmounts: [-100, 96, 4],
          });
        });
      });
    });

    describe("protocol payment", function () {
      const testcase: PaymentCategoryTestcase = {
        paymentCategory: protocolPaymentCategory,
        defaultFeeRate: 300,
        feeRateSetter: "setProtocolFeeRate",
      };

      paymentModes.forEach((modeLiteral) => {
        it(`[S] ${modeLiteral}: should executePayment (fee default)`, async () => {
          await executePaymentForCase(modeLiteral, testcase, {
            accounts: [
              signers[0],
              businessOwner,
              cPJManager as unknown as SignerWithAddress,
              daoTreasuryPool,
            ],
            byAmounts: [-100, 59, 38, 3],
          });
        });

        it(`[S] ${modeLiteral}: should executePayment (fee changed)`, async () => {
          const feeRate = testcase.defaultFeeRate + 100;
          await cQuestryPlatform[testcase.feeRateSetter!](feeRate);
          await executePaymentForCase(modeLiteral, testcase, {
            accounts: [
              signers[0],
              businessOwner,
              cPJManager as unknown as SignerWithAddress,
              daoTreasuryPool,
            ],
            byAmounts: [-100, 58, 38, 4],
          });
        });
      });
    });
  });

  // TODO: Add more tests for boardingMembersProportion = 0, 10000

  describe("meta-transaction", function () {
    beforeEach(async function () {
      const depositAmount = ethers.utils.parseEther("1");
      await cQuestryForwarder.connect(admin).deposit({ value: depositAmount });

      this.name = "QuestryForwarder";
      this.chainId = (await ethers.provider.getNetwork()).chainId;
      this.value = "0";
      this.gas = (await ethers.provider.getBlock("latest")).gasLimit.toString();

      await cPJManager.connect(whitelistController).allowERC20(cERC20.address);
      await cERC20.connect(signers[0]).approve(cTokenControlProxy.address, 100);
      await cERC20.connect(signers[0]).approve(cPJManager.address, 100);
    });

    it("[S] should process the meta-transaction correctly", async function () {
      const args: ExecutePaymentArgs = {
        paymentMode: erc20Mode,
        paymentToken: cERC20.address,
        paymentCategory: commonPaymentCategory,
        pjManager: cPJManager.address,
        from: signers[0].address,
        to: signers[1].address,
        amount: 100,
        nonce: 0,
      };
      const typedData = await setupPaymentTypedData(args);

      // Prepare meta-transaction
      const data = cQuestryPlatform.interface.encodeFunctionData(
        "executePayment",
        [args, typedData]
      );
      const from = args.from;
      const nonce: string = (await cQuestryForwarder.getNonce(from)).toString();
      const to = cQuestryPlatform.address;
      // get proper gas to execute meta tx
      const { metaTxForGas, signForGas } = await getMetaTxAndSignForGas(
        this.name,
        this.chainId,
        cQuestryForwarder.address,
        from,
        to,
        nonce,
        data,
        this.value,
        this.gas
      );
      const estimatedGas: string = (
        await cQuestryForwarder
          .connect(admin)
          .estimateGas.execute(metaTxForGas.message, signForGas)
      ).toString();
      // create typedData for sign meta tx
      const metaTx = await getMetaTx(
        this.name,
        this.chainId,
        cQuestryForwarder.address,
        from,
        to,
        nonce,
        data,
        this.value,
        estimatedGas
      );
      // sign meta tx
      const signature = await ethers.provider.send("eth_signTypedData_v4", [
        from,
        JSON.stringify(metaTx),
      ]);
      expect(
        await cQuestryForwarder.connect(admin).verify(metaTx.message, signature)
      ).to.equal(true);
      // Relay meta-transaction
      await cQuestryForwarder.connect(admin).execute(metaTx.message, signature);
      // Check if the meta-transaction was processed successfully
      expect(await cQuestryForwarder.getNonce(from)).to.equal(nonce + 1);

      const feeRate = 300;
      const deduction = Math.floor((+args.amount * feeRate) / 10000);
      expect(await cERC20.balanceOf(args.from)).equals(
        initialBalances[signers[0].address] - +args.amount
      );
      expect(await cERC20.balanceOf(args.to)).equals(+args.amount - deduction);
      expect(await cERC20.balanceOf(daoTreasuryPool.address)).equals(deduction);
    });
  });
});
