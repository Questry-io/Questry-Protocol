const GATEWAY_V1 = {
  address: {
    mumbai: {
      Proxy: {
        QuestryPlatform: "0xcfdfb7f832e01871c8B96cc72AC291f98f23CbA9",
        QuestryForwarder: "0x3a540d182ad5e75d010a02a6d9d83380714e1127",
        TokenControlProxy: "0x5D3aC78aA55F92f28651D428dE402471d3C72c1a",
        ContributionCalculator: "0x37399AF300cf28bC9a1D6CE3bC7aF31342bFe51b",
      },
      Implementation: {
        QuestryPlatform: "0xd406d128bf892a9af9396d1284278dcef5a47a21",
        QuestryForwarder: "0xc35501edcdbe370C537EeE5837add1a39a2C0f52",
        TokenControlProxy: "0xe47b53C048CfF2140D9Fa4ec15f70c38FB890C60",
        ContributionCalculator: "0x6021F0e8d5372CbBa297b5F0003dAe6cB2Db1Bc7",
      },
    },
  },
  EIP712_DOMAIN: "QUESTRY_PLATFORM",
  EIP712_VERSION: "1.0",
  FORWARD_REQUEST_TYPE: {
    ForwardRequest: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "gas", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
  },
};

const FACTORY_V1 = {
  address: {
    mumbai: {
      ContributionPoolFactory: "0x88B12c51F1b81c477000F8b8aBf1FcAdDf56c355",
      PJManagerFactory: "0x5d773F22e83553035A4B7Cb89Af563C16c2226F8",
      BoardFactory: "0x8c2354eB1E98aD210f6EDA57217935f6604a08D9",
    },
  },
};

module.exports = {
  GATEWAY_V1,
  FACTORY_V1,
};
