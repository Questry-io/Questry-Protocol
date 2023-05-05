/* eslint-disable node/no-missing-import */
import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getMetaTx, getMetaTxAndSignForGas } from "../utils";
import { PJManagerFactory, QuestryForwarder } from "../../typechain";

describe("PJManagerFactory", function () {
  let admin: SignerWithAddress;
  let issuer: SignerWithAddress;
  let executor: SignerWithAddress;
  let pjManagerAdmin: SignerWithAddress;
  let contract: PJManagerFactory;
  let forwarderContract: QuestryForwarder;

  beforeEach(async function () {
    [admin, issuer, executor, pjManagerAdmin] = await ethers.getSigners();

    const QuestryForwarder = await ethers.getContractFactory(
      "QuestryForwarder"
    );
    forwarderContract = (await upgrades.deployProxy(
      QuestryForwarder,
      [admin.address, executor.address],
      { initializer: "initialize" }
    )) as QuestryForwarder;
    await forwarderContract.deployed();

    const PJManagerFactory = await ethers.getContractFactory(
      "PJManagerFactory"
    );
    contract = await PJManagerFactory.deploy(
      ethers.constants.AddressZero,
      forwarderContract.address
    );
    await contract.deployed();

    await admin.sendTransaction({
      to: forwarderContract.address,
      value: ethers.utils.parseEther("1.0"),
    });

    this.name = "QuestryForwarder";
    this.chainId = (await ethers.provider.getNetwork()).chainId;
    this.value = "0";
    this.gas = (await ethers.provider.getBlock("latest")).gasLimit.toString();
  });

  describe("createPJManager", function () {
    it("[S] should createPJManager", async function () {
      const tx = await contract
        .connect(pjManagerAdmin)
        .createPJManager(10000, []);
      const pjManagers = await contract.getPJManagers(pjManagerAdmin.address);
      expect(pjManagers.length).to.equal(1);
      expect(pjManagers[0]).not.equal(ethers.constants.AddressZero);
      expect(await contract.getPJManagerAdmin(pjManagers[0])).to.equal(
        pjManagerAdmin.address
      );
      expect(tx)
        .to.emit(contract, "PJManagerCreated")
        .withArgs(pjManagerAdmin.address, pjManagers[0]);
    });
  });

  describe("metatx", function () {
    describe("execute", function () {
      it("[S] should process the meta-transaction correctly", async function () {
        // Prepare meta-transaction
        const data = contract.interface.encodeFunctionData("createPJManager", [
          10000,
          [],
        ]);
        const from = issuer.address;
        const nonce: string = (
          await forwarderContract.getNonce(from)
        ).toString();
        const to = contract.address;
        // get proper gas to execute meta tx
        const { metaTxForGas, signForGas } = await getMetaTxAndSignForGas(
          this.name,
          this.chainId,
          forwarderContract.address,
          from,
          to,
          nonce,
          data,
          this.value,
          this.gas
        );
        const estimatedGas: string = (
          await forwarderContract
            .connect(executor)
            .estimateGas.execute(metaTxForGas.message, signForGas)
        ).toString();
        // create typedData for sign meta tx
        const metaTx = await getMetaTx(
          this.name,
          this.chainId,
          forwarderContract.address,
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
          await forwarderContract.verify(metaTx.message, signature)
        ).to.equal(true);

        // Relay meta-transaction
        await forwarderContract
          .connect(executor)
          .execute(metaTx.message, signature);
        // Check if the meta-transaction was processed successfully
        expect(await forwarderContract.getNonce(from)).to.equal(nonce + 1);
      });

      it("[R] should revert when the signature is invalid", async function () {
        const data = contract.interface.encodeFunctionData("createPJManager", [
          10000,
          [],
        ]);
        const nonce = (
          await forwarderContract.getNonce(issuer.address)
        ).toString();
        const from = issuer.address;
        const to = contract.address;
        // get proper gas to execute meta tx
        const { metaTxForGas, signForGas } = await getMetaTxAndSignForGas(
          this.name,
          this.chainId,
          forwarderContract.address,
          from,
          to,
          nonce,
          data,
          this.value,
          this.gas
        );
        const estimatedGas: string = (
          await forwarderContract
            .connect(executor)
            .estimateGas.execute(metaTxForGas.message, signForGas)
        ).toString();
        // create typedData for sign meta tx
        const metaTx = await getMetaTx(
          this.name,
          this.chainId,
          forwarderContract.address,
          from,
          to,
          nonce,
          data,
          this.value,
          estimatedGas
        );
        const signature = await ethers.provider.send("eth_signTypedData_v4", [
          metaTx.message.from,
          JSON.stringify(metaTx),
        ]);

        // Sign meta-transaction with incorrect nonce
        // Relay meta-transaction
        await expect(
          forwarderContract
            .connect(executor)
            .execute({ ...metaTx.message, nonce: 10 }, signature)
        ).to.be.revertedWith(
          "QuestryForwarder: signature does not match request"
        );
      });
    });
  });
});
