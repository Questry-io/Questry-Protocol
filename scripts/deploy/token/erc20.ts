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
  const forwarderAddress = "";
  const adminAddress = "";
  const issuerAddress = "";
  if (forwarderAddress === "" || adminAddress === "" || issuerAddress === "") {
    throw new Error("Please set forwarderAddress, adminAddress and issuerAddress");
  }
  const QuestryErc20 = await hre.ethers.getContractFactory("QuestryERC20");
  const questryErc20 = await QuestryErc20.deploy(forwarderAddress, adminAddress, issuerAddress);
  await questryErc20.deployed();

  console.log("QuestryErc20 deployed to:", questryErc20.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

