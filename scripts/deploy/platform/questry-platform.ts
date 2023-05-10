// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import * as hre from "hardhat";

async function main() {
  await hre.run("compile");
  const ethers = hre.ethers;
  const upgrades = hre.upgrades;
  const QuestryPlatform = await ethers.getContractFactory("QuestryPlatform");
  const contributionCalculatorAddress = "";
  const daoTreasuryPoolAddress = "";
  if (contributionCalculatorAddress == "" || daoTreasuryPoolAddress == "") {
    throw new Error(
      "Please set contributionCalculatorAddress and daoTreasuryPoolAddress in the script before running it"
    );
  }

  console.log("Deploying QuestryPlatform...");
  const questryPlatform = await upgrades.deployProxy(
    QuestryPlatform,
    [contributionCalculatorAddress, daoTreasuryPoolAddress],
    { initializer: "initialize" }
  );
  console.log("QuestryPlatform deployed to:", questryPlatform.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
