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
  const ethers = hre.ethers;
  const upgrades = hre.upgrades;
  const TokenControlProxy = await ethers.getContractFactory(
    "TokenControlProxy"
  );
  const adminAddress = "";
  const forwarderAddress = "";
  if (adminAddress == "" || forwarderAddress == "") {
    throw new Error(
      "Please set adminAddress and forwarderAddress in the script before running it"
    );
  }

  console.log("Deploying TokenControlProxy...");
  const tokenControlProxy = await upgrades.deployProxy(
    TokenControlProxy,
    [adminAddress],
    {
      initializer: "__TokenControlProxy_init",
      constructorArgs: [forwarderAddress],
    }
  );
  console.log("TokenControlProxy deployed to:", tokenControlProxy.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
