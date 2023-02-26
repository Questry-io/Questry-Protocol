// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * This Domain library is based on a smart contract platform of a certain marketplace, 
 * and will be modified like kaname protocol in the future.
 * reference : https://polygonscan.com/address/0xb9a83eb825bbef7336e852c73a27e41f05503d65#code#F22#L1
 */

/**
 * @dev Model data related with Order
 */
library OrderDomain {
  // ORIGIN_KIND
  bytes4 private constant NANAKUSA_ORIGIN_KIND = bytes4(keccak256("NANAKUSA"));
  bytes4 private constant PARTNER_ORIGIN_KIND = bytes4(keccak256("PARTNER"));

  // PAYMENT_MODE
  bytes4 public constant NATIVE_PAYMENT_MODE = bytes4(keccak256("NATIVE"));
  bytes4 public constant ERC20_PAYMENT_MODE = bytes4(keccak256("ERC20"));
  bytes4 private constant CREDIT_CARD_PAYMENT_MODE =
    bytes4(keccak256("CREDIT_CARD"));
  bytes4 private constant OTHER_BLOCKCHAIN_PAYMENT_MODE =
    bytes4(keccak256("OTHER_BLOCKCHAIN"));

  struct Asset {
    bytes4 originKind;
    address token;
    uint256 tokenId;
    uint16 partnerFeeRate; // only set when originKind = PARTNER_ORIGIN_KIND
    uint8 isSecondarySale;
  }

  struct Payment {
    bytes4 paymentMode; // Like NATIVE_PAYMENT_MODE || ERC20_PAYMENT_MODE || ...
    address paymentToken; // Token contract address
    uint256 price;
  }

  struct SaleOrder {
    Asset[] assetList; // Array will represent bundle
    address currentOwner;
    address paymentReceiver; // Onchain payment receiver, can be same as currentOwner
    Payment[] acceptedPaymentMode;
    uint16 pfSaleFeeRate;
    uint256 start; // Always non zero
    uint256 end; // Can be zero when there is no end time
    uint256 nounce;
  }

  struct BuyOrder {
    uint256 saleNounce;
    address payable buyer;
    address payable payer; // If no payer means buyer is the payer
    Payment paymentDetails;
  }

  /**
   * @dev Checks if it's a Secondary Sale
   *
   * @param _secondarySale uint8
   */
  function _isSecondarySale(uint8 _secondarySale) internal pure returns (bool) {
    return (_secondarySale == 1);
  }

  /**
   * @dev Checks if it's a valid origin kind
   *
   * @param _originKind bytes4
   */
  function _isValidOriginKind(bytes4 _originKind) internal pure returns (bool) {
    return (_originKind == NANAKUSA_ORIGIN_KIND ||
      _originKind == PARTNER_ORIGIN_KIND);
  }

  /**
   * @dev Checks if it's a valid payment mode
   *
   * @param _paymentMode bytes4
   */
  function _isValidPaymentMode(bytes4 _paymentMode)
    internal
    pure
    returns (bool)
  {
    return (_paymentMode == NATIVE_PAYMENT_MODE ||
      _paymentMode == ERC20_PAYMENT_MODE ||
      _paymentMode == CREDIT_CARD_PAYMENT_MODE ||
      _paymentMode == OTHER_BLOCKCHAIN_PAYMENT_MODE);
  }

  /**
   * @dev Checks if payment mode is onchain
   *
   * @param _paymentMode bytes4
   */
  function _isOnchainPaymentMode(bytes4 _paymentMode)
    internal
    pure
    returns (bool)
  {
    return (_paymentMode == NATIVE_PAYMENT_MODE ||
      _paymentMode == ERC20_PAYMENT_MODE);
  }

  /**
   * @dev Checks if origin kind is partner
   *
   * @param _originKind bytes4
   */
  function _isPartnerOrigin(bytes4 _originKind) internal pure returns (bool) {
    return (_originKind == PARTNER_ORIGIN_KIND);
  }

  /**
   * @dev Find the total sale price by matching payment mode of SaleOrder and BuyOrder
   *
   * @param _saleOrder SaleOrder
   * @param _buyOrder BuyOrder
   */
  function _findTotalSalePrice(
    SaleOrder calldata _saleOrder,
    BuyOrder calldata _buyOrder
  ) internal pure returns (uint256) {
    // Find total sale price
    for (uint256 idx = 0; idx < _saleOrder.acceptedPaymentMode.length; idx++) {
      if (
        _saleOrder.acceptedPaymentMode[idx].paymentMode ==
        _buyOrder.paymentDetails.paymentMode
      ) {
        return _saleOrder.acceptedPaymentMode[idx].price;
      }
    }

    return 0;
  }

  /**
   * @dev Stateless Check validity of arguments when called exchange
   *
   * @param _saleOrder OrderDomain.SaleOrder
   * @param _buyOrder OrderDomain.BuyOrder
   */
  function _checkParameterForExchange(
    OrderDomain.SaleOrder calldata _saleOrder,
    OrderDomain.BuyOrder calldata _buyOrder
  ) internal view {
    // OrderDomain.SaleOrder
    // EM: SaleOrder invalid assetList
    require(_saleOrder.assetList.length > 0, "E:CPFE:SIAL");
    // OrderDomain.Asset
    uint256 idx = 0;
    for (idx = 0; idx < _saleOrder.assetList.length; idx++) {
      // EM: SaleOrder asset invalid originKind
      require(
        _isValidOriginKind(_saleOrder.assetList[idx].originKind),
        "E:CPFE:SAIO"
      );
      // EM: SaleOrder asset invalid token
      require(_saleOrder.assetList[idx].token != address(0), "E:CPFE:SAIT");
      // EM: SaleOrder asset invalid tokenId
      require(_saleOrder.assetList[idx].tokenId != 0, "E:CPFE:SAITI");
    }
    // EM: SaleOrder invalid currentOwner
    require(_saleOrder.currentOwner != address(0), "E:CPFE:SICO");
    // EM: SaleOrder invalid paymentReceiver
    require(_saleOrder.paymentReceiver != address(0), "E:CPFE:SIPR");

    // EM: SaleOrder invalid start
    require(
      _saleOrder.start > 0 && _saleOrder.start <= block.timestamp,
      "E:CPFE:SIS"
    );
    // EM: SaleOrder invalid end
    require(
      _saleOrder.end == 0 || _saleOrder.end > block.timestamp,
      "E:CPFE:SIE"
    );
    // EM: SaleOrder invalid nounce
    require(_saleOrder.nounce != 0, "E:CPFE:SIN");

    // OrderDomain.BuyOrder
    // EM: BuyOrder invalid saleNounce
    require(_buyOrder.saleNounce != 0, "E:CPFE:BIS");
    // EM: SaleOrder and BuyOrder nounce does't match
    require(_saleOrder.nounce == _buyOrder.saleNounce, "E:CPFE:SBN");
    // EM: BuyOrder invalid buyer
    require(_buyOrder.buyer != address(0), "E:CPFE:BIB");
    // EM: BuyOrder invalid payer
    require(_buyOrder.payer != address(0), "E:CPFE:BIP");
    // EM: BuyOrder invalid paymentMode
    require(
      _isValidPaymentMode(_buyOrder.paymentDetails.paymentMode),
      "E:CPFE:BIPM"
    );
    // EM: BuyOrder invalid price
    require(_buyOrder.paymentDetails.price != 0, "E:CPFE:BOIP");

    // Mixed cases
    // EM: currentOwner and buyer can't be same
    require(_saleOrder.currentOwner != _buyOrder.buyer, "E:CPFE:CAABS");

    // Check for matching payment mode for Sale and Buy
    bool matchFound = false;
    for (idx = 0; idx < _saleOrder.acceptedPaymentMode.length; idx++) {
      // EM: SaleOrder acceptedPaymentMode invalid paymentMode
      require(
        _isValidPaymentMode(_saleOrder.acceptedPaymentMode[idx].paymentMode),
        "E:CPFE:SAPMPM"
      );
      // EM: SaleOrder acceptedPaymentMode invalid price
      require(_saleOrder.acceptedPaymentMode[idx].price != 0, "E:CPFE:SAPMIP");

      if (
        _saleOrder.acceptedPaymentMode[idx].paymentMode ==
        _buyOrder.paymentDetails.paymentMode
      ) {
        matchFound = true;
        break;
      }
    }
    // EM: payment mode did't match
    require(matchFound, "E:CPFE:PMNM");
  }

  // ---- EIP712 ----
  bytes32 private constant ASSET_TYPEHASH =
    keccak256(
      "Asset(bytes4 originKind,address token,uint256 tokenId,uint16 partnerFeeRate,uint8 isSecondarySale)"
    );

  bytes32 private constant PAYMENT_TYPEHASH =
    keccak256("Payment(bytes4 paymentMode,address paymentToken,uint256 price)");

  bytes32 private constant SALE_ORDER_TYPEHASH =
    keccak256(
      "SaleOrder(Asset[] assetList,address currentOwner,address paymentReceiver,Payment[] acceptedPaymentMode,uint16 pfSaleFeeRate,uint256 start,uint256 end,uint256 nounce)Asset(bytes4 originKind,address token,uint256 tokenId,uint16 partnerFeeRate,uint8 isSecondarySale)Payment(bytes4 paymentMode,address paymentToken,uint256 price)"
    );

  bytes32 private constant BUY_ORDER_TYPEHASH =
    keccak256(
      "BuyOrder(uint256 saleNounce,address buyer,address payer,Payment paymentDetails)Payment(bytes4 paymentMode,address paymentToken,uint256 price)"
    );

  /**
   * @dev Prepares keccak256 hash for Asset
   *
   * @param _asset OrderDomain.Asset
   */
  function _hashAsset(Asset calldata _asset) internal pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          ASSET_TYPEHASH,
          _asset.originKind,
          _asset.token,
          _asset.tokenId,
          _asset.partnerFeeRate,
          _asset.isSecondarySale
        )
      );
  }

  /**
   * @dev Prepares keccak256 hash for Asset list
   *
   * @param _assetList OrderDomain.Asset[]
   */
  function _hashAsset(Asset[] calldata _assetList)
    internal
    pure
    returns (bytes32)
  {
    bytes32[] memory keccakData = new bytes32[](_assetList.length);

    for (uint256 idx = 0; idx < _assetList.length; idx++) {
      keccakData[idx] = _hashAsset(_assetList[idx]);
    }

    return keccak256(abi.encodePacked(keccakData));
  }

  /**
   * @dev Prepares keccak256 hash for Payment
   *
   * @param _payment OrderDomain.Payment
   */
  function _hashPayment(Payment calldata _payment)
    internal
    pure
    returns (bytes32)
  {
    return
      keccak256(
        abi.encode(
          PAYMENT_TYPEHASH,
          _payment.paymentMode,
          _payment.paymentToken,
          _payment.price
        )
      );
  }

  /**
   * @dev Prepares keccak256 hash for Payment list
   *
   * @param _paymentList OrderDomain.Payment[]
   */
  function _hashPayment(Payment[] calldata _paymentList)
    internal
    pure
    returns (bytes32)
  {
    bytes32[] memory keccakData = new bytes32[](_paymentList.length);

    for (uint256 idx = 0; idx < _paymentList.length; idx++) {
      keccakData[idx] = _hashPayment(_paymentList[idx]);
    }

    return keccak256(abi.encodePacked(keccakData));
  }

  /**
   * @dev Prepares keccak256 hash for SaleOrder
   *
   * @param _saleOrder OrderDomain.SaleOrder
   */
  function _hashSaleOrder(SaleOrder calldata _saleOrder)
    internal
    pure
    returns (bytes32)
  {
    return
      keccak256(
        abi.encode(
          SALE_ORDER_TYPEHASH,
          _hashAsset(_saleOrder.assetList),
          _saleOrder.currentOwner,
          _saleOrder.paymentReceiver,
          _hashPayment(_saleOrder.acceptedPaymentMode),
          _saleOrder.pfSaleFeeRate,
          _saleOrder.start,
          _saleOrder.end,
          _saleOrder.nounce
        )
      );
  }

  /**
   * @dev Prepares keccak256 hash for BuyOrder
   *
   * @param _buyOrder OrderDomain.BuyOrder
   */
  function _hashBuyOrder(BuyOrder calldata _buyOrder)
    internal
    pure
    returns (bytes32)
  {
    return
      keccak256(
        abi.encode(
          BUY_ORDER_TYPEHASH,
          _buyOrder.saleNounce,
          _buyOrder.buyer,
          _buyOrder.payer,
          _hashPayment(_buyOrder.paymentDetails)
        )
      );
  }
}
