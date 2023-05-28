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
  const name = "";
  const symbol = "";
  const baseTokenURI = "";
  const pjmanagerContract = "";
  const contributionPool = "";
  const admin = "";
  const Trustedforwarder = "";

  if (
    name == "" ||
    symbol == "" ||
    baseTokenURI == "" ||
    pjmanagerContract == "" ||
    contributionPool == "" ||
    admin == "" ||
    Trustedforwarder == ""
  ) {
    throw new Error(
      "Please set all of name, symbol, baseTokenURI, pjmanagerContract, admin, Trustedforwarder"
    );
  }

  const Board = await hre.ethers.getContractFactory("Board");

  const board = await Board.deploy(
    name,
    symbol,
    baseTokenURI,
    pjmanagerContract,
    contributionPool,
    admin,
    Trustedforwarder
  );
  await board.deployed();

  console.log("Board deployed to:", board.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
