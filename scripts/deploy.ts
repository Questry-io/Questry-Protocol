// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import * as hre from "hardhat";

const ethers = hre.ethers;
const upgrades = hre.upgrades;

async function deployContributionCalculator(): Promise<string> {
  const ContributionCalculator = await ethers.getContractFactory(
    "ContributionCalculator"
  );

  console.log("Deploying ContributionCalculator...");
  const contributionCalculator = await upgrades.deployProxy(
    ContributionCalculator,
    { initializer: "initialize" }
  );
  console.log(
    "ContributionCalculator deployed to:",
    contributionCalculator.address
  );
  return contributionCalculator.address;
}

async function deployQuestryForwarder(
  adminAddress: string,
  executorAddress: string
): Promise<string> {
  const QuestryForwarder = await ethers.getContractFactory("QuestryForwarder");
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
  return questryForwarder.address;
}

async function deployQuestryPlatform(
  contributionCalculatorAddress: string,
  daoTreasuryPoolAddress: string
): Promise<string> {
  if (contributionCalculatorAddress == "" || daoTreasuryPoolAddress == "") {
    throw new Error(
      "Please set contributionCalculatorAddress and daoTreasuryPoolAddress in the script before running it"
    );
  }
  console.log("Deploying QuestryPlatform...");
  const QuestryPlatform = await ethers.getContractFactory("QuestryPlatform");
  const questryPlatform = await upgrades.deployProxy(
    QuestryPlatform,
    [contributionCalculatorAddress, daoTreasuryPoolAddress],
    { initializer: "initialize" }
  );
  console.log("QuestryPlatform deployed to:", questryPlatform.address);
  return questryPlatform.address;
}

async function deployTokenControlProxy(
  roleManagerAddress: string,
  forwarderAddress: string
): Promise<string> {
  const TokenControlProxy = await ethers.getContractFactory(
    "TokenControllProxy"
  );
  if (roleManagerAddress == "" || forwarderAddress == "") {
    throw new Error(
      "Please set roleManagerAddress and forwarderAddress in the script before running it"
    );
  }

  console.log("Deploying TokenControlProxy...");
  const tokenControlProxy = await upgrades.deployProxy(
    TokenControlProxy,
    [roleManagerAddress],
    {
      initializer: "__TokenControlProxy_init",
      constructorArgs: [forwarderAddress],
    }
  );
  console.log("TokenControlProxy deployed to:", tokenControlProxy.address);
  return tokenControlProxy.address;
}

async function deployPJManagerFactory(
  questryPlatformAddress: string,
  trustedForwarderAddress: string
): Promise<string> {
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
  return pjmanagerFactory.address;
}

async function deployBoardFactory(
  adminAddress: string,
  pjManagerAddress: string
): Promise<string> {
  if (adminAddress === "" || pjManagerAddress === "") {
    throw new Error("Please set adminAddress and pjManagerAddress");
  }
  const BoardFactory = await hre.ethers.getContractFactory("BoardFactory");
  const boardFactory = await BoardFactory.deploy(
    pjManagerAddress,
    adminAddress
  );
  await boardFactory.deployed();

  console.log("BoardFactory deployed to:", boardFactory.address);
  return boardFactory.address;
}

async function deployContributionPoolFactory(
  platformAddress: string
): Promise<string> {
  if (platformAddress == "") {
    throw new Error(
      "Please set platformAddress in the script before running it"
    );
  }

  const ContributionPoolFactory = await hre.ethers.getContractFactory(
    "ContributionPoolFactory"
  );

  const contributionPoolFactory = await ContributionPoolFactory.deploy(
    platformAddress
  );
  await contributionPoolFactory.deployed();

  console.log(
    "ContributionPoolFactory deployed to:",
    contributionPoolFactory.address
  );
  return contributionPoolFactory.address;
}

async function main() {
  // ・ContributionCalculator(Upgradeable)
  // ・QuestryforwarderContract(Upgradeable)
  // ・QuestryPlatform(Upgradeable)
  // ・tokenControlProxy(Upgradeable)
  // ・PJManagerFactory
  // ・BoardFactry
  // ・ContributionPoolfactory
  await hre.run("compile");

  const contributionCalculatorAddress = await deployContributionCalculator();

  const daoTreasuryPoolAddress = "";
  const questryPlatformAddress = await deployQuestryPlatform(
    contributionCalculatorAddress,
    daoTreasuryPoolAddress
  );
  const contributionPoolFactoryAddress = await deployContributionPoolFactory(
    questryPlatformAddress
  );

  const adminAddress = "";
  const executorAddress = "";
  const questryForwarderAddress = await deployQuestryForwarder(
    adminAddress,
    executorAddress
  );
  const pjManagerFactoryAddress = await deployPJManagerFactory(
    questryPlatformAddress,
    questryForwarderAddress
  );

  const roleManagerAddress = "";
  const tokenControlProxyAddress = await deployTokenControlProxy(
    roleManagerAddress,
    questryForwarderAddress
  );

  const pjManagerAddress = "";
  const boardFactoryAddress = await deployBoardFactory(
    adminAddress,
    pjManagerAddress
  );

  console.log(
    "ContributionCalculator address: ",
    contributionCalculatorAddress
  );
  console.log("QuestryPlatform address: ", questryPlatformAddress);
  console.log(
    "ContributionPoolFactory address: ",
    contributionPoolFactoryAddress
  );
  console.log("QuestryForwarder address: ", questryForwarderAddress);
  console.log("TokenControlProxy address: ", tokenControlProxyAddress);
  console.log("PJManagerFactory address: ", pjManagerFactoryAddress);
  console.log("BoardFactory address: ", boardFactoryAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
