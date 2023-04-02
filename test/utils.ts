import { ethers } from "hardhat";

export async function getEIP712DomainSeparator(
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

export async function getMetaTx(
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

export async function getMetaTxAndSignForGas(
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
