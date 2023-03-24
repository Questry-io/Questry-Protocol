/* eslint-disable node/no-missing-import */
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function getEIP712DomainSeparator(
  name: string,
  version: string,
  chainId: number,
  verifyingContract: string
) {
  return {
    name,
    version,
    chainId,
    verifyingContract,
  };
}

async function getMetaTx(
  name: string,
  chainId: number,
  verifyingContract: string,
  from: string,
  to: string,
  nonce: string,
  data: string,
  value: string = "0",
  gas: string = "30000000"
) {
  const domainSeparator = await getEIP712DomainSeparator(
    name,
    "0.0.1",
    chainId,
    verifyingContract
  );

  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "data", type: "bytes" },
      ],
    },
    domain: domainSeparator,
    primaryType: "ForwardRequest",
    message: {
      from,
      to,
      value,
      gas,
      nonce,
      data,
    },
  };
}

async function getMetaTxAndSignForGas(
  name: string,
  chainId: number,
  verifyingContract: string,
  from: string,
  to: string,
  nonce: string,
  data: string,
  value: string,
  gas: string
) {
  const metaTxForGas = await getMetaTx(
    name,
    chainId,
    verifyingContract,
    from,
    to,
    nonce,
    data,
    value,
    gas
  );
  const signForGas = await ethers.provider.send("eth_signTypedData_v4", [
    from,
    JSON.stringify(metaTxForGas),
  ]);
  return { metaTxForGas, signForGas };
}

describe("QuestryERC20", function () {
  let admin: SignerWithAddress;
  let issuer: SignerWithAddress;
  let user: SignerWithAddress;
  let contract: Contract;
  let forwarderContract: Contract;

  beforeEach(async function () {
    [admin, issuer, user] = await ethers.getSigners();

    const MinimalForwarder = await ethers.getContractFactory(
      "MinimalForwarder"
    );
    forwarderContract = await MinimalForwarder.deploy();
    await forwarderContract.deployed();

    const QuestryERC20 = await ethers.getContractFactory("QuestryERC20");
    contract = await QuestryERC20.deploy(
      forwarderContract.address,
      admin.address,
      issuer.address
    );
    await contract.deployed();

    this.name = "MinimalForwarder";
    this.chainId = (await ethers.provider.getNetwork()).chainId;
    this.value = "0";
    this.gas = (await ethers.provider.getBlock("latest")).gasLimit.toString();
  });

  it("should have correct initial values", async function () {
    expect(await contract.name()).to.equal("QST");
    expect(await contract.symbol()).to.equal("QuestryERC20");
    expect(await contract.decimals()).to.equal(18);
    expect(await contract.totalSupply()).to.equal(0);
    expect(
      await contract.hasRole(contract.DEFAULT_ADMIN_ROLE(), admin.address)
    ).to.equal(true);
    expect(
      await contract.hasRole(contract.ISSUER_ROLE(), issuer.address)
    ).to.equal(true);
  });

  it("should process the meta-transaction correctly", async function () {
    // Prepare meta-transaction
    const data = contract.interface.encodeFunctionData("selfMint", [1000]);
    const from = user.address;
    const nonce: string = (await forwarderContract.getNonce(from)).toString();
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
      await forwarderContract.estimateGas.execute(
        metaTxForGas.message,
        signForGas
      )
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
    await forwarderContract.execute(metaTx.message, signature);
    // // Check if the meta-transaction was processed successfully
    expect(await forwarderContract.getNonce(from)).to.equal(nonce + 1);
  });

  it("should process approve via meta tx", async function () {
    await contract.connect(issuer).selfMint(1000);
    await contract.connect(admin).withdraw(user.address, 500);
    // Prepare meta-transaction
    const from = user.address;
    const nonce: string = (await forwarderContract.getNonce(from)).toString();
    const to = contract.address;
    const data = contract.interface.encodeFunctionData("approve", [
      issuer.address,
      250,
    ]);
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
      await forwarderContract.estimateGas.execute(
        metaTxForGas.message,
        signForGas
      )
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
    await forwarderContract.execute(metaTx.message, signature);
    expect(await contract.allowance(from, issuer.address)).to.equal(250);
  });

  it("should process transfer via meta tx", async function () {
    await contract.connect(issuer).selfMint(1000);
    await contract.connect(admin).withdraw(user.address, 500);
    // Prepare meta-transaction
    contract.connect(user).approve(issuer.address, 250);
    const from = user.address;
    const nonce: string = (await forwarderContract.getNonce(from)).toString();
    const to = contract.address;
    const data = contract.interface.encodeFunctionData("transfer", [
      issuer.address,
      250,
    ]);
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
      await forwarderContract.estimateGas.execute(
        metaTxForGas.message,
        signForGas
      )
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
      from,
      JSON.stringify(metaTx),
    ]);
    // // Check if the meta-transaction was processed successfully
    await forwarderContract
      .connect(user)
      .execute(metaTx.message, signature);
    expect(await contract.balanceOf(issuer.address)).to.equal(250);
  });

  it("should process transferFrom via meta tx", async function () {
    await contract.connect(issuer).selfMint(1000);
    await contract.connect(admin).withdraw(user.address, 500);
    // Prepare meta-transaction
    contract.connect(user).approve(issuer.address, 250);
    const from = issuer.address;
    const nonce: string = (await forwarderContract.getNonce(from)).toString();
    const to = contract.address;
    const data = contract.interface.encodeFunctionData("transferFrom", [
      user.address,
      from,
      250,
    ]);
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
      await forwarderContract.estimateGas.execute(
        metaTxForGas.message,
        signForGas
      )
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
      from,
      JSON.stringify(metaTx),
    ]);
    // // Check if the meta-transaction was processed successfully
    await forwarderContract
      .connect(issuer)
      .execute(metaTx.message, signature);
    expect(await contract.balanceOf(from)).to.equal(250);
  });

  it("should revert when the signature is invalid", async function () {
    const data = contract.interface.encodeFunctionData("selfMint", [1000]);
    const nonce = (await forwarderContract.getNonce(issuer.address)).toString();
    const from = user.address;
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
      await forwarderContract.estimateGas.execute(
        metaTxForGas.message,
        signForGas
      )
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
        .connect(issuer)
        .execute({ ...metaTx.message, nonce: 10 }, signature)
    ).to.be.revertedWith("MinimalForwarder: signature does not match request");
  });

  it("should allow self mint by issuer", async function () {
    await contract.connect(issuer).selfMint(1000);
    expect(await contract.balanceOf(contract.address)).to.equal(1000);
  });

  it("should not allow self mint by non-issuer", async function () {
    await expect(contract.connect(admin).selfMint(1000)).to.be.revertedWith(
      `AccessControl: account ${admin.address.toLowerCase()} is missing role ${await contract.ISSUER_ROLE()}`
    );
  });

  it("should not allow self mint if mintable count is 0", async function () {
    // can mint 3 times until the expiryTime
    for (let i = 0; i < 3; i++) {
      await contract.connect(issuer).selfMint(1000);
    }
    await expect(contract.connect(issuer).selfMint(1000)).to.be.revertedWith(
      "you cannot issue token anymore"
    );
  });

  it("should allow migration when expired", async function () {
    // Fast-forward to expiry time.
    await contract.connect(issuer).selfMint(1000);
    await contract.connect(admin).withdraw(user.address, 500);

    // increase time
    await ethers.provider.send("evm_increaseTime", [180 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    // Perform migration
    await contract.connect(admin).migrate(user.address, 500);
    expect(await contract.balanceOf(user.address)).to.equal(500);
  });

  it("should not allow migration when not expired", async function () {
    await contract.connect(issuer).selfMint(1000);
    await expect(
      contract.connect(admin).migrate(user.address, 500)
    ).to.be.revertedWith("Token migration not allowed yet.");
  });

  it("should not allow migration by non-admin", async function () {
    await contract.connect(issuer).selfMint(1000);
    await expect(
      contract.connect(user).migrate(user.address, 500)
    ).to.be.revertedWith(
      `AccessControl: account ${user.address.toLowerCase()} is missing role ${await contract.DEFAULT_ADMIN_ROLE()}`
    );
  });

  it("should allow admin to pause and unpause", async function () {
    expect(await contract.paused()).to.equal(false);
    await contract.connect(admin).pause();
    expect(await contract.paused()).to.equal(true);
    await contract.connect(admin).unpause();
    expect(await contract.paused()).to.equal(false);
  });

  it("should not allow non-admin to pause and unpause", async function () {
    await expect(contract.connect(user).pause()).to.be.revertedWith(
      `AccessControl: account ${user.address.toLowerCase()} is missing role ${await contract.DEFAULT_ADMIN_ROLE()}`
    );
    await expect(contract.connect(user).unpause()).to.be.revertedWith(
      `AccessControl: account ${user.address.toLowerCase()} is missing role ${await contract.DEFAULT_ADMIN_ROLE()}`
    );
  });

  it("should not allow token transfer when paused", async function () {
    await contract.connect(admin).pause();
    await expect(contract.connect(issuer).selfMint(1000)).to.be.revertedWith(
      "Pausable: paused"
    );
  });

  it("should allow token transfer when not paused", async function () {
    await contract.connect(admin).pause();
    await contract.connect(admin).unpause();
    await contract.connect(issuer).selfMint(1000);
    await contract.connect(admin).withdraw(user.address, 500);
    expect(await contract.balanceOf(user.address)).to.equal(500);
  });
});
