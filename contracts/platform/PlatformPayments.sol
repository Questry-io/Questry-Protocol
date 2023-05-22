// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ContextUpgradeable, ERC2771ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {EIP712Upgradeable, ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// interface import
//import {IPaymentResolver} from "contracts/interface/platform/IPaymentResolver.sol";
import {ITokenControlProxy} from "contracts/interface/token-control-proxy/ITokenControlProxy.sol";
import {IPJManager} from "contracts/interface/pjmanager/IPJManager.sol";

// libary import
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";

import {IPJManager} from "../interface/pjmanager/IPJManager.sol";

abstract contract PlatformPayments is
  Initializable,
  AccessControlUpgradeable,
  EIP712Upgradeable,
  ERC2771ContextUpgradeable
{
  using ECDSAUpgradeable for bytes32;

  event CommonFeeRateChanged(uint32 _rate);
  event InvestmentFeeRateChanged(uint32 _rate);
  event ProtocolFeeRateChanged(uint32 _rate);

  ITokenControlProxy public tokenControlProxy;
  LibQuestryPlatform.FeeRates public feeRates;

  /// @dev account => nonce. for replay attack protection.
  mapping(address => uint256) public nonces;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address _trustedForwarder)
    ERC2771ContextUpgradeable(_trustedForwarder)
  {
    _disableInitializers();
  }

  function __PlatformPayments_init(ITokenControlProxy _tokenControlProxy)
    internal
    onlyInitializing
  {
    __AccessControl_init();
    __EIP712_init("QUESTRY_PLATFORM", "1.0");

    tokenControlProxy = _tokenControlProxy;
    _setDefaultFeeRates();

    _setRoleAdmin(
      LibQuestryPlatform.PLATFORM_EXECUTOR_ROLE,
      LibQuestryPlatform.PLATFORM_ADMIN_ROLE
    );
    _setupRole(LibQuestryPlatform.PLATFORM_ADMIN_ROLE, _msgSender());
    _setupRole(LibQuestryPlatform.PLATFORM_EXECUTOR_ROLE, _msgSender());
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

    // Pay fees to the DAO Treasury pool
    uint256 deduction = (_args.amount * feeRate) / _feeDenominator();

    if (deduction > 0) {
      _transfer(
        _args.paymentMode,
        _args.paymentToken,
        _args.pjManager,
        _args.from,
        getDAOTreasuryPool(),
        deduction
      );
    }

    // Transfer the remaining amount to the recipient

    uint256 remains = _args.amount - deduction;

    if (_args.paymentCategory == LibQuestryPlatform.COMMON_PAYMENT_CATEGORY) {
      // Transfer the amount to the general account.
      // Do not send to PJManager using this paymentCategory as it will not be allocated.
      _transfer(
        _args.paymentMode,
        _args.paymentToken,
        _args.pjManager,
        _args.from,
        _args.to,
        remains
      );
    } else if (
      _args.paymentCategory == LibQuestryPlatform.INVESTMENT_PAYMENT_CATEGORY ||
      _args.paymentCategory == LibQuestryPlatform.PROTOCOL_PAYMENT_CATEGORY
    ) {
      // Deposit the amount to PJManager. It will be allocated.
      require(
        AddressUpgradeable.isContract(_args.to),
        "PlatformPayments: 'to' is not contract"
      );
      IPJManager(_args.to).deposit{value: remains}(
        _args.paymentMode,
        _args.paymentToken,
        _args.from,
        remains
      );
    } else {
      revert("PlatformPayments: unknown paymentCategory");
    }
  }

  /**
   * @dev Sets the common fee `_rate`.
   */
  function setCommonFeeRate(uint32 _rate)
    external
    onlyRole(LibQuestryPlatform.PLATFORM_EXECUTOR_ROLE)
  {
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
  function setInvestmentFeeRate(uint32 _rate)
    external
    onlyRole(LibQuestryPlatform.PLATFORM_EXECUTOR_ROLE)
  {
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
  function setProtocolFeeRate(uint32 _rate)
    external
    onlyRole(LibQuestryPlatform.PLATFORM_EXECUTOR_ROLE)
  {
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
   * @dev Returns the nonce of `_account`.
   */
  function getNonce(address _account) public view returns (uint256) {
    return nonces[_account];
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
   * @dev See {ERC2771ContextUpgradeable._msgSender()}
   */
  function _msgSender()
    internal
    view
    override(ContextUpgradeable, ERC2771ContextUpgradeable)
    returns (address)
  {
    return ERC2771ContextUpgradeable._msgSender();
  }

  /**
   * @dev See {ERC2771ContextUpgradeable._msgData()}
   */
  function _msgData()
    internal
    view
    override(ContextUpgradeable, ERC2771ContextUpgradeable)
    returns (bytes calldata)
  {
    return ERC2771ContextUpgradeable._msgData();
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
    address _pjManager,
    address _from,
    address _to,
    uint256 _amount
  ) private {
    if (_paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE) {
      // Sending ETH
      AddressUpgradeable.sendValue(payable(_to), _amount);
    } else if (_paymentMode == LibQuestryPlatform.ERC20_PAYMENT_MODE) {
      require(
        IPJManager(_pjManager).isWhitelisted(_paymentToken),
        "PlatformPayments: token not whitelisted"
      );
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
   * @dev Checks parameters for executePayment.
   */
  function _checkParameters(
    LibQuestryPlatform.ExecutePaymentArgs calldata _args
  ) private view {
    if (_args.paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE) {
      require(
        _msgSender() == _args.from,
        "PlatformPayments: mismatch between _msgSender() and _args.from"
      );
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
      require(
        _args.paymentToken.allowance(_args.from, address(tokenControlProxy)) >=
          _args.amount,
        "PlatformPayments: insufficient allowance"
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
      /*
      require(
        _args.resolver != IPaymentResolver(address(0)),
        "PlatformPayments: no resolver"
      );
      */
    } else {
      revert("PlatformPayments: unknown paymentCategory");
    }

    require(_args.to != address(0), "PlatformPayments: to is zero address");
    require(_args.amount > 0, "PlatformPayments: amount is zero");
    require(
      _args.nonce == getNonce(_args.from),
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
