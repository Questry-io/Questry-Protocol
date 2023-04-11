// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import * as hre from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  await hre.run("compile");

  // We get the contract to deploy
  const adminAddress = "";
  if (adminAddress === "") {
    throw new Error("Please set adminAddress");
  }

  const SBTFactory = await hre.ethers.getContractFactory("SBTFactory");
  const sbtFactory = await SBTFactory.deploy(adminAddress);
  await sbtFactory.deployed();

  console.log("SBTFactory deployed to:", sbtFactory.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// SBIToken deployed to: 0xF83A820626f6e2495E3fA322C8bcA86796ad29E0
