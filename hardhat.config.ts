import * as dotenv from "dotenv";
import chai from "chai";

import { HardhatUserConfig, task, subtask } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from "hardhat/builtin-tasks/task-names";
import { solidity } from "ethereum-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import * as fs from "fs";
import * as path from "path";

import "./scripts/verify/verify.ts";

dotenv.config();
chai.use(solidity);

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("build-abi", "Build abi for frontend", async (_, hre) => {
  function getArtifactJSONPaths(
    artifactsBaseDir: string,
    currentDir: string
  ): [string, string, string][] {
    const fullBaseDir = path.join(artifactsBaseDir, currentDir);
    const files = fs.readdirSync(fullBaseDir, { withFileTypes: true });

    // Search *.sol/ subdirectories
    const solDirectories = files.filter(
      (file) => file.isDirectory() && file.name.endsWith(".sol")
    );

    const result: [string, string, string][] = [];

    solDirectories.forEach((solDirectory) => {
      const solDirname = solDirectory.name;
      const dirPath = path.join(fullBaseDir, solDirname);
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      const abiFiles = files
        .filter(
          (file) =>
            file.isFile() &&
            file.name.endsWith(".json") &&
            !file.name.endsWith(".dbg.json")
        )
        .map((file) => file.name);

      if (abiFiles.length > 1) {
        throw new Error(
          `Multiple ABI JSON files in ${dirPath}: ${abiFiles.join(", ")}`
        );
      }
      if (abiFiles.length > 0) {
        result.push([currentDir, solDirname, abiFiles[0]]);
      }
    });

    // Search non *.sol/ subdirectories
    const nonSolDirectories = files.filter(
      (file) =>
        file.isDirectory() &&
        !file.name.endsWith(".sol") &&
        file.name !== "mock"
    );

    nonSolDirectories.forEach((nonSolDirectory) => {
      const nextDir = path.join(currentDir, nonSolDirectory.name);
      const subResults = getArtifactJSONPaths(artifactsBaseDir, nextDir);
      result.push(...subResults);
    });

    return result;
  }

  const writeFileWithDirectorySync = (filePath: string, data: string) => {
    const dirname = path.dirname(filePath);
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }
    fs.writeFileSync(filePath, data);
  };

  const artifactsBaseDir = "./artifacts/contracts/";
  const abiBaseDir = "./build/generated-abi/";

  try {
    const jsonPaths = getArtifactJSONPaths(artifactsBaseDir, "");
    jsonPaths.forEach(([currentDir, solDirname, jsonFile]) => {
      const jsonPath = path.join(
        artifactsBaseDir,
        currentDir,
        solDirname,
        jsonFile
      );
      const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      const abiJSON = JSON.stringify(data.abi, null, 2);
      const abiFilename = path.join(abiBaseDir, currentDir, jsonFile);
      writeFileWithDirectorySync(abiFilename, abiJSON);
    });
  } catch (err) {
    console.error(err);
  }
});

subtask(
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
  async (_, { config: HardhatUserConfig }, runSuper) => {
    const paths = await runSuper();
    return paths.filter((solidityFilePath: string) => {
      const filename = solidityFilePath.split("/").slice(-1)[0];
      // compileから除外するコントラクトを指定
      return !["platformDomain.sol"].includes(filename);
    });
  }
);

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  mocha: {
    timeout: 100000000,
  },
  networks: {
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    rinkeby: {
      url: process.env.RINKEBY_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    goerli: {
      url: process.env.GOERLI_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    mumbai: {
      url: process.env.POLYGON_MUMBAI_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS
      ? process.env.REPORT_GAS.toLocaleLowerCase() === "true"
      : false,
    currency: "JPY",
    coinmarketcap: process.env.CMC_API_KEY,
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      ropsten: process.env.ETHERSCAN_API_KEY,
      rinkeby: process.env.ETHERSCAN_API_KEY,
      goerli: process.env.ETHERSCAN_API_KEY,
      // polygon
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY,
    },
  },
};

export default config;
