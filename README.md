# KANAME-Protocol-V1.0

## this is only once　for local machine
- `nvm` をインストールする(nodeバージョン管理用) [Link](https://github.com/nvm-sh/nvm)
- `nvm use` でプロジェクトで設定したnodeバージョンを利用する
- `npm install --global yarn` で`yarn`を利用する

## Run after project clone
- `yarn` で依存modulesをインストールする

## derectry Structure
derectry構成のtreeをこちらに記述する
<pre>
.
├── README.md
├── contracts
│   ├── Factory
│   │   ├── PJ-Manager-Factory.sol
│   │   ├── Qestry-ERC721-factry.sol
│   │   └── Soulbound-Factory.sol
│   ├── interface
│   │   ├── pjmanager
│   │   │   ├── IContributionLogic.sol
│   │   │   ├── IPJ-Manager.sol
│   │   │   ├── IPJ-tresully-pool.sol
│   │   │   └── ISignVerifi.sol
│   │   ├── platform
│   │   │   ├── IContributionLogicSammalizer.sol
│   │   │   └── Ikaname-platform.sol
│   │   ├── token
│   │   │   ├── INFT.sol
│   │   │   └── ISoulbound.sol
│   │   └── tokenControl
│   │       └── ItokenControl.sol
│   ├── library
│   │   └── platformDomain.sol
│   ├── mock
│   │   ├── NFTPartnerA.sol
│   │   ├── NFTPartnerB.sol
│   │   ├── NFTRandom.sol
│   │   ├── RandomERC1155.sol
│   │   └── RandomERC20.sol
│   ├── pjmanager
│   │   ├── ContributionLogic.sol
│   │   ├── PJ-Manager.sol
│   │   ├── PJ-tresully-pool.sol
│   │   └── SignVerifi.sol
│   ├── platform
│   │   ├── ContributionLogicSammalizer.sol
│   │   └── kaname-platform.sol
│   ├── token
│   │   ├── questry-ERC721
│   │   │   └──  NFT.sol
│   │   └── soulboaund
│   │       └── Soulbound.sol
│   └── token-control-proxy
│       └── tokenControl.sol
├── hardhat.config.ts
├── package.json
├── scripts
│   └── verify
│       ├── deploy.ts
│       └── verify.ts
├── test
│   ├── Factory
│   │   ├── NFT-factory.test.ts
│   │   ├── PJ-Manager-Factory.test.ts
│   │   └── board-factory.test.ts
│   └── token
│       ├── NFT.test.ts
│       └── soulbound.test.ts
├── tsconfig.json
└── yarn.lock
</pre>

- Description of each contracts directory
   + `contracts/Factory`   List of contracts for factory generation of KANAME-Protocol
   + `contracts/interface` Contract list of Interface of each contract of KANAME-protocol
   + `contracts/library`   Library contract list for each contract of KANAME-protocol
   + `contracts/mock`      Mock contract for test verification of KANAME-protocol 
   + `contracts/pjmanager` Project logic and state management contract of KANAME-protocol 
   + `contracts/token`     Token-related contract directory of KANAME-protocol
   + `contracts/token-controll-proxy` Contract for proxy transfer of various Tokens of KANAME-protocol

- Description of each derectry of KANAME Protocol
   + `test`    Test code writing directory of KANAME-Protocol
   + `scripts` Contract operation script of KANAME-protocol

- Description of each file of KANAME Protocol
   + `hardhat.config.ts`  hardhat config file
   + `package.json`       Management files for dependent modules and CLI commands    



## Command List
|Command|Explanation|
|-|-|
|`yarn run clean`|`deploy` Delete related files|
|`yarn run lint`|Check if lint rules are followed|
|`yarn run lint:fix`|automatic lint fix|
|`yarn run coverage`|Check the range where test code is not written|
|`yarn run test`|run the test|
|`yarn run gas-report`|gas bill calculator|
|`yarn run prepare`|`deploy` previous preparation|
|`yarn run deploy`|:boom:|

## 一般的
- [Contract・Struct・Event・関数・変数・などの命名規則](https://github.com/0xcert/solidity-style-guide)

## 開発環境設定ファイル
- .env
- .env.example
After downloading, it is necessary to change to ".env.txt" -> ".env"

## Checklist for testing
-  Account Stakeholder Perspective Testing
-  Evaluating Signature Message Reusability
-  Transaction attack case management

# deploy & Upgrade Rule

![スマートコントラクトデプロイのルール](https://github.com/QuestryInc/KANAME-Protocol-V1.0/blob/fix-readme-dev/image/Contract-development-covernance.png "")
