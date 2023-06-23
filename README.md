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
├── README.md
├── contracts
│   ├── factory
│   │   ├── BoardFactory.sol
│   │   ├── ContributionPoolFactory.sol
│   │   └── PJManagerFactory.sol
│   ├── interface
│   │   ├── factory
│   │   │   └── IPJManagerFactory.sol
│   │   ├── pjmanager
│   │   │   ├── IContributionPool.sol
│   │   │   └── IPJManager.sol
│   │   ├── platform
│   │   │   ├── IContributionCalculator.sol
│   │   │   └── IQuestryPlatform.sol
│   │   ├── token
│   │   │   └── IBoard.sol
│   │   └── token-control-proxy
│   │       └── ITokenControlProxy.sol
│   ├── library
│   │   ├── LibPJManager.sol
│   │   └── LibQuestryPlatform.sol
│   ├── mock
│   │   ├── MockCallerContract.sol
│   │   ├── MockContributionCalculatorV2.sol
│   │   ├── MockQuestryPlatformV2.sol
│   │   ├── NFTPartnerA.sol
│   │   ├── NFTPartnerB.sol
│   │   ├── NFTRandom.sol
│   │   ├── RandomERC1155.sol
│   │   └── RandomERC20.sol
│   ├── pjmanager
│   │   ├── ContributionPool.sol
│   │   ├── PJManager.sol
│   │   ├── PJTreasuryPool.sol
│   │   └── SignatureVerifier.sol
│   ├── platform
│   │   ├── ContributionCalculator.sol
│   │   ├── PlatformPayments.sol
│   │   ├── QuestryForwarder.sol
│   │   └── QuestryPlatform.sol
│   ├── token
│   │   ├── questry-ERC20
│   │   │   └── ERC20.sol
│   │   └── soulbound
│   │       └── Board.sol
│   └── token-control-proxy
│       └── TokenControlProxy.sol
├── hardhat.config.ts
├── image
│   └── Contract-development-covernance.png
├── package.json
├── scripts
│   ├── deploy
│   │   ├── factory
│   │   │   ├── boardFactory.ts
│   │   │   ├── contributionPoolFactory.ts
│   │   │   └── pjmanagerFactory.ts
│   │   ├── platform
│   │   │   ├── contributionCalculator.ts
│   │   │   ├── forwarder.ts
│   │   │   └── questry-platform.ts
│   │   └── token
│   │       ├── board.ts
│   │       ├── erc20.ts
│   │       └── tokenControlProxy.ts
│   ├── deploy.ts
│   └── verify
│       └── verify.ts
├── test
│   ├── factory
│   │   ├── BoardFactory.test.ts
│   │   ├── ContributionPoolFactory.test.ts
│   │   └── PJManagerFactory.test.ts
│   ├── pjmanager
│   │   ├── ContributionPool.test.ts
│   │   └── PJManager.test.ts
│   ├── platform
│   │   ├── ContributionCalculator.test.ts
│   │   ├── Forwarder.test.ts
│   │   └── QuestryPlatform.test.ts
│   ├── testUtils.ts
│   ├── token
│   │   ├── Board.test.ts
│   │   └── ERC20.test.ts
│   ├── tokenControlProxy
│   │   └── tokenControl.test.ts
│   └── utils.ts
├── tsconfig.json
└── yarn.lock
</pre>

- Description of each contracts directory
   + `contracts/Factory`   List of contracts for factory generation of Questry-Protocol
   + `contracts/interface` Contract list of Interface of each contract of KANAME-protocol
   + `contracts/library`   Library contract list for each contract of Questry-protocol
   + `contracts/mock`      Mock contract for test verification of Questry-protocol 
   + `contracts/pjmanager` Project logic and state management contract of Questry-protocol 
   + `contracts/token`     Token-related contract directory of Questry-protocol
   + `contracts/token-controll-proxy` Contract for proxy transfer of various Tokens of Questry-protocol

- Description of each derectry of Questry Protocol
   + `test`    Test code writing directory of Questry-Protocol
   + `scripts` Contract operation script of Questry-protocol

- Description of each file of Questry Protocol
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
