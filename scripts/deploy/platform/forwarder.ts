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
  const QuestryForwarder = await ethers.getContractFactory("QuestryForwarder");
  const adminAddress = "";
  const executorAddress = "";
  if (adminAddress == "" || executorAddress == "") {
    throw new Error(
      "Please set adminAddress and executorAddress in the script before running it"
    );
  }

  console.log("Deploying QuestryForwarder...");
  const questryForwarder = await upgrades.deployProxy(
    QuestryForwarder,
    [adminAddress, executorAddress],
    { initializer: "initialize" }
  );
  console.log("QuestryForwarder deployed to:", questryForwarder.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
