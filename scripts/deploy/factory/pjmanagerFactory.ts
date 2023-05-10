// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import * as hre from "hardhat";

async function main() {
  await hre.run("compile");
  const questryPlatformAddress = "";
  const trustedForwarderAddress = "";
  if (questryPlatformAddress == "" || trustedForwarderAddress == "") {
    throw new Error(
      "Please set questryPlatformAddress and trustedForwarderAddress in the script before running it"
    );
  }

  const PJManagerFactory = await hre.ethers.getContractFactory(
    "PJManagerFactory"
  );

  const pjmanagerFactory = await PJManagerFactory.deploy(
    questryPlatformAddress,
    trustedForwarderAddress
  );
  await pjmanagerFactory.deployed();

  console.log("PJManagerFactory deployed to:", pjmanagerFactory.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// SBIToken deployed to: 0xF83A820626f6e2495E3fA322C8bcA86796ad29E0
