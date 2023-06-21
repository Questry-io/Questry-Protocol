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
    polygon: {
      Proxy: {
        QuestryPlatform: "0xf16D56f9F4c1Ab982DA461A1186Bc605B68eF02F",
        QuestryForwarder: "0xCD7A0A026217d54289CC2bDF46e22483B695c35f",
        TokenControlProxy: "0xAcFBbc9F15dd1D80902993fc1c64714895680612",
        ContributionCalculator: "0x8c72ce61f81BAB33710F301e5aB9bE0dAc397b47",
      },
      Implementation: {
        QuestryPlatform: "0x327A1457e87d3d43Dab09aeebe21dac62AF1912C",
        QuestryForwarder: "0x7876CCfBabcDCab86f5FdFAc3b08E8da55E5F79B",
        TokenControlProxy: "0x6eaCB5d0F1a48DA12D42E564780995F767cb383d",
        ContributionCalculator: "0xca01361F4Ff89366d01786051060816dD393dc9D",
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
    polygon: {
      ContributionPoolFactory: "0x1f6b07749EDfc39BB32793Af7AFf08aF441D1c83",
      PJManagerFactory: "0x6C88429d2082Cd5B8510627E72685C635291Ff93",
      BoardFactory: "0x0dAd17339D2Db72579522cFA42cC193d3F428e55",
    },
  },
};

module.exports = {
  GATEWAY_V1,
  FACTORY_V1,
};
