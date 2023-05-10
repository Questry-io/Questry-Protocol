// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {EIP712Upgradeable, ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPaymentResolver} from "../interface/platform/IPaymentResolver.sol";
import {ITokenControlProxy} from "../interface/token-control-proxy/ITokenControlProxy.sol";
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";

abstract contract PlatformPayments is
  Initializable,
  OwnableUpgradeable,
  EIP712Upgradeable
{
  using ECDSAUpgradeable for bytes32;

  event CommonFeeRateChanged(uint32 _rate);
  event InvestmentFeeRateChanged(uint32 _rate);
  event ProtocolFeeRateChanged(uint32 _rate);

  ITokenControlProxy public tokenControlProxy;
  LibQuestryPlatform.FeeRates public feeRates;

  /// @dev account => nonce. for replay attack protection.
  mapping(address => uint256) public nonces;

  function __PlatformPayments_init(ITokenControlProxy _tokenControlProxy)
    internal
    onlyInitializing
  {
    __Ownable_init();
    __EIP712_init("QUESTRY_PLATFORM", "1.0");

    tokenControlProxy = _tokenControlProxy;
    _setDefaultFeeRates();
  }

  /**
   * @dev Transfers `_amount` of `_token` to `_to`.
   */
  function executePayment(
    LibQuestryPlatform.ExecutePaymentArgs calldata _args,
    bytes calldata _signature
  ) external payable {
    _checkParameters(_args);
    require(
      _verifySignature(_args, _signature),
      "PlatformPayments: invalid signature"
    );

    _incrementNonce(_args.from);

    uint32 feeRate;
    if (_args.paymentCategory == LibQuestryPlatform.COMMON_PAYMENT_CATEGORY) {
      feeRate = feeRates.common;
    } else if (
      _args.paymentCategory == LibQuestryPlatform.INVESTMENT_PAYMENT_CATEGORY
    ) {
      feeRate = feeRates.investment;
    } else if (
      _args.paymentCategory == LibQuestryPlatform.PROTOCOL_PAYMENT_CATEGORY
    ) {
      feeRate = feeRates.protocol;
    } else {
      revert("PlatformPayments: unknown payment category");
    }

    uint256 deduction = (_args.amount * feeRate) / _feeDenominator();

    // Pay fees to the DAO Treasury pool
    _transfer(
      _args.paymentMode,
      _args.paymentToken,
      _args.from,
      getDAOTreasuryPool(),
      deduction
    );

    // Transfer the remaining amount to the recipient
    _transfer(
      _args.paymentMode,
      _args.paymentToken,
      _args.from,
      _args.to,
      _args.amount - deduction
    );

    if (_args.resolver != IPaymentResolver(address(0))) {
      // Call the resolver contract to finalize the investment, purchase NFTs, etc.
      // It will revert if the resolver determines that `_args` is invalid.
      _args.resolver.resolveAfterPayment(_args);
    }
  }

  /**
   * @dev Sets the common fee `_rate`.
   */
  function setCommonFeeRate(uint32 _rate) external onlyOwner {
    require(
      _rate <= _feeDenominator(),
      "PlatformPayments: common fee rate must be less than or equal to _feeDenominator()"
    );
    feeRates.common = _rate;
    emit CommonFeeRateChanged(_rate);
  }

  /**
   * @dev Sets the investment fee `_rate`.
   */
  function setInvestmentFeeRate(uint32 _rate) external onlyOwner {
    require(
      _rate <= _feeDenominator(),
      "PlatformPayments: investment fee rate must be less than or equal to _feeDenominator()"
    );
    feeRates.investment = _rate;
    emit InvestmentFeeRateChanged(_rate);
  }

  /**
   * @dev Sets the protocol fee `_rate`.
   */
  function setProtocolFeeRate(uint32 _rate) external onlyOwner {
    require(
      _rate <= _feeDenominator(),
      "PlatformPayments: protocol fee rate must be less than or equal to _feeDenominator()"
    );
    feeRates.protocol = _rate;
    emit ProtocolFeeRateChanged(_rate);
  }

  /**
   * @dev Returns the fee common rate.
   */
  function getCommonFeeRate() external view returns (uint32) {
    return feeRates.common;
  }

  /**
   * @dev Returns the fee investment rate.
   */
  function getInvestmentFeeRate() external view returns (uint32) {
    return feeRates.investment;
  }

  /**
   * @dev Returns the fee protocol rate.
   */
  function getProtocolFeeRate() external view returns (uint32) {
    return feeRates.protocol;
  }

  /**
   * @dev Returns the DAO Treasury pool address.
   */
  function getDAOTreasuryPool() public view virtual returns (address);

  // --------------------------------------------------
  // Internal functions
  // --------------------------------------------------

  /**
   * @dev Returns protocol fees deducted from `totalBalance`.
   * TODO: This function is used from QuestryPlatform but not from here. Where should this function be?
   */
  function _protocolFee(uint256 _totalBalance) internal view returns (uint256) {
    return (_totalBalance * feeRates.protocol) / _feeDenominator();
  }

  /**
   * @dev The denominator with which to interpret the fee set.
   */
  function _feeDenominator() internal pure virtual returns (uint96) {
    return 10000;
  }

  // --------------------------------------------------
  // Private functions
  // --------------------------------------------------

  /**
   * @dev Transfers ERC20 or native tokens.
   */
  function _transfer(
    bytes4 _paymentMode,
    IERC20 _paymentToken,
    address _from,
    address _to,
    uint256 _amount
  ) private {
    if (_paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE) {
      // Sending ETH
      AddressUpgradeable.sendValue(payable(_to), _amount);
    } else if (_paymentMode == LibQuestryPlatform.ERC20_PAYMENT_MODE) {
      // Sending ERC20
      tokenControlProxy.erc20safeTransferFrom(
        _paymentToken,
        _from,
        _to,
        _amount
      );
    } else {
      revert("PlatformPayments: unknown paymentMode");
    }
  }

  /**
   * @dev Sets the default fee rates.
   */
  function _setDefaultFeeRates() private {
    feeRates.common = 300;
    feeRates.investment = 300;
    feeRates.protocol = 300;
  }

  /**
   * @dev Increments the nonce of `_account`.
   */
  function _incrementNonce(address _account) private {
    nonces[_account]++;
  }

  /**
   * @dev Returns the nonce of `_account`.
   */
  function _getNonce(address _account) private view returns (uint256) {
    return nonces[_account];
  }

  /**
   * @dev Checks parameters for executePayment.
   */
  function _checkParameters(
    LibQuestryPlatform.ExecutePaymentArgs calldata _args
  ) private view {
    require(
      _msgSender() == _args.from,
      "PlatformPayments: mismatch between _msgSender() and _args.from"
    );

    if (_args.paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE) {
      require(
        msg.value == _args.amount,
        "PlatformPayments: mismatch between msg.value and _args.amount"
      );
      require(
        _args.paymentToken == IERC20(address(0)),
        "PlatformPayments: paymentToken exists though paymentMode is NATIVE"
      );
    } else if (_args.paymentMode == LibQuestryPlatform.ERC20_PAYMENT_MODE) {
      require(
        msg.value == 0,
        "PlatformPayments: msg.value != 0 though paymentMode is ERC20"
      );
      require(
        _args.paymentToken != IERC20(address(0)),
        "PlatformPayments: paymentToken doesn't exist though paymentMode is ERC20"
      );
    } else {
      revert("PlatformPayments: unknown paymentMode");
    }

    if (_args.paymentCategory == LibQuestryPlatform.COMMON_PAYMENT_CATEGORY) {
      // Do nothing. _args.resolver is optional.
    } else if (
      _args.paymentCategory == LibQuestryPlatform.INVESTMENT_PAYMENT_CATEGORY ||
      _args.paymentCategory == LibQuestryPlatform.PROTOCOL_PAYMENT_CATEGORY
    ) {
      require(
        _args.resolver != IPaymentResolver(address(0)),
        "PlatformPayments: no resolver"
      );
    } else {
      revert("PlatformPayments: unknown paymentCategory");
    }

    require(_args.to != address(0), "PlatformPayments: to is zero address");
    require(_args.amount > 0, "PlatformPayments: amount is zero");
    require(
      _args.nonce == _getNonce(_args.from),
      "PlatformPayments: invalid nonce"
    );
  }

  /**
   * @dev Verifies the signature of executePayment `_args`.
   */
  function _verifySignature(
    LibQuestryPlatform.ExecutePaymentArgs calldata _args,
    bytes calldata _signature
  ) private view returns (bool) {
    address recoveredAddress = _domainSeparatorV4()
      .toTypedDataHash(LibQuestryPlatform._hashExecutePaymentArgs(_args))
      .recover(_signature);
    return _args.from == recoveredAddress;
  }

  /**
   * @dev This empty reserved space is put in place to allow future versions to add new
   * variables without shifting down storage in the inheritance chain.
   * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
   */
  uint256[50] private __gap;
}
