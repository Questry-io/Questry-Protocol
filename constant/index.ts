const GATEWAY_V1 = {
  address: {
    mumbai: {
      Proxy: {
        QuestryPlatform: "0xE297106446DFD523d3f326FE5A817D848D4d67f0",
        QuestryForwarder: "0x915b303eAB97a4E4f213373C3987d6a180B3754D",
        TokenControlProxy: "0x011cFC5ea9F084f74088fF1Bf76730ac38a2c886",
        ContributionCalculator: "0x67E31847341BDb6347B85639CC7eA8AAF471c15B",
      },
      Implementation: {
        QuestryPlatform: "0x6be9D0B180D8E30fce4b647C9442B9AC3fcF498F",
        QuestryForwarder: "0xc35501edcdbe370C537EeE5837add1a39a2C0f52",
        TokenControlProxy: "0x397d622E7026BA44DcaB21206333A9792128ea85",
        ContributionCalculator: "0xE2FEcDC33C7434b84f7B813f1Df8E75ba941C3De",
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
      ContributionPoolFactory: "0x96f0A16CF8ae65AEaE4f9aE50F1FA8b9Eb5e2e35",
      PJManagerFactory: "0x5b5166e36A4d369383Bbe7aA78b9249d3Cedd256",
      BoardFactory: "0x425c4B18e5C360112B19a21e9858FFd63279E705",
    },
  },
};

module.exports = {
  GATEWAY_V1,
  FACTORY_V1,
};
