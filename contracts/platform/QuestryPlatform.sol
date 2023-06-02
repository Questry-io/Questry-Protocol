// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ContextUpgradeable, ERC2771ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {EIP712Upgradeable, ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
//library import
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";
//interface import
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {IContributionCalculator} from "../interface/platform/IContributionCalculator.sol";
import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";
import {IQuestryPlatform} from "../interface/platform/IQuestryPlatform.sol";
import {IBoard} from "../interface/token/IBoard.sol";
import {ITokenControlProxy} from "../interface/token-control-proxy/ITokenControlProxy.sol";

contract QuestryPlatform is
  Initializable,
  UUPSUpgradeable,
  AccessControlUpgradeable,
  EIP712Upgradeable,
  ERC2771ContextUpgradeable
{
  using ECDSAUpgradeable for bytes32;

  // ----------------- Payments Events -----------------

  event CommonFeeRateChanged(uint32 _rate);
  event InvestmentFeeRateChanged(uint32 _rate);
  event ProtocolFeeRateChanged(uint32 _rate);

  // ----------------- Payments Fields -----------------

  ITokenControlProxy public tokenControlProxy;
  LibQuestryPlatform.FeeRates public feeRates;

  // ----------------- Allocation Fields -----------------

  IContributionCalculator public contributionCalculator;

  // Just a temp variable to be used as local function variable
  // as mapping declaration is not supported inside function
  mapping(address => uint256) private tempPayoutAmount;
  address[] private tempPayoutAddress;
  // Set verify signature history
  mapping(bytes => bool) private _isCompVerifySignature;

  // ----------------- ERC2771 Fields -----------------

  /// @dev account => nonce. for replay attack protection.
  mapping(address => uint256) public nonces;

  // ----------------- Other Fields -----------------

  address public daoTreasuryPool;

  // --------------------------------------------------
  // Constructors
  // --------------------------------------------------

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address _trustedForwarder)
    ERC2771ContextUpgradeable(_trustedForwarder)
  {
    _disableInitializers();
  }

  function initialize(
    IContributionCalculator _contributionCalculator,
    address _daoTreasuryPool,
    ITokenControlProxy _tokenControlProxy
  ) public initializer {
    __UUPSUpgradeable_init();
    __AccessControl_init();
    __EIP712_init("QUESTRY_PLATFORM", "1.0");

    // Setup payments fields
    tokenControlProxy = _tokenControlProxy;
    _setDefaultFeeRates();

    // Setup allocation fields
    contributionCalculator = _contributionCalculator;
    daoTreasuryPool = _daoTreasuryPool;

    // Setup roles for QuestryPlatform administrative executions
    _setRoleAdmin(
      LibQuestryPlatform.PLATFORM_EXECUTOR_ROLE,
      LibQuestryPlatform.PLATFORM_ADMIN_ROLE
    );
    _setupRole(LibQuestryPlatform.PLATFORM_ADMIN_ROLE, _msgSender());
    _setupRole(LibQuestryPlatform.PLATFORM_EXECUTOR_ROLE, _msgSender());
  }

  /// @inheritdoc UUPSUpgradeable
  function _authorizeUpgrade(address _newImplementation)
    internal
    override
    onlyRole(LibQuestryPlatform.PLATFORM_EXECUTOR_ROLE)
  {}

  // --------------------------------------------------
  // Payments Public Functions
  // --------------------------------------------------

  /**
   * @dev Transfers `_amount` of `_token` to `_to`.
   */
  function executePayment(
    LibQuestryPlatform.ExecutePaymentArgs calldata _args,
    bytes calldata _signature
  ) external payable {
    _checkParametersForPayments(_args);
    require(
      _verifySignature(_args, _signature),
      "QuestryPlatform: invalid signature"
    );
    _incrementNonce(_args.from);

    uint32 feeRate = _getFeeRate(_args.paymentCategory);
    uint256 deduction = (_args.amount * feeRate) / _paymentFeeDenominator();

    if (deduction > 0) {
      _transfer(
        _args.paymentMode,
        _args.paymentToken,
        _args.pjManager,
        _args.from,
        daoTreasuryPool,
        deduction
      );
    }

    uint256 remainingAmount = _args.amount - deduction;

    if (_args.paymentCategory == LibQuestryPlatform.COMMON_PAYMENT_CATEGORY) {
      // Transfer the amount to the general account.
      // Do not send to PJManager using this paymentCategory as it will not be allocated.
      _transfer(
        _args.paymentMode,
        _args.paymentToken,
        _args.pjManager,
        _args.from,
        _args.to,
        remainingAmount
      );
    } else if (
      _args.paymentCategory == LibQuestryPlatform.INVESTMENT_PAYMENT_CATEGORY
    ) {
      // Transfer the amount to the business owner.
      address businessOwner = _args.pjManager.getBusinessOwner();
      _transfer(
        _args.paymentMode,
        _args.paymentToken,
        _args.pjManager,
        _args.from,
        businessOwner,
        remainingAmount
      );
    } else if (
      _args.paymentCategory == LibQuestryPlatform.PROTOCOL_PAYMENT_CATEGORY
    ) {
      // Deposit into PJManager. It will be allocated to boarding members.
      uint256 membersAmount = (remainingAmount *
        _args.pjManager.getBoardingMembersProportion()) /
        _args.pjManager.getBoardingMemberProportionDenominator();
      _depositToPJManager(
        _args.paymentMode,
        _args.paymentToken,
        _args.pjManager,
        _args.from,
        membersAmount
      );

      // Transfer the remaining amount to the business owner.
      address businessOwner = _args.pjManager.getBusinessOwner();
      uint256 ownerAmount = remainingAmount - membersAmount;
      _transfer(
        _args.paymentMode,
        _args.paymentToken,
        _args.pjManager,
        _args.from,
        businessOwner,
        ownerAmount
      );
    } else {
      revert("QuestryPlatform: unknown paymentCategory");
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
      _rate <= _paymentFeeDenominator(),
      "QuestryPlatform: common fee rate must be less than or equal to _paymentFeeDenominator()"
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
      _rate <= _paymentFeeDenominator(),
      "QuestryPlatform: investment fee rate must be less than or equal to _paymentFeeDenominator()"
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
      _rate <= _paymentFeeDenominator(),
      "QuestryPlatform: protocol fee rate must be less than or equal to _paymentFeeDenominator()"
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

  // --------------------------------------------------
  // Allocation Public Functions
  // --------------------------------------------------

  /**
   * @dev Allocates tokens to business owners, boarding members and DAO treasury pool.
   */
  function allocate(
    LibQuestryPlatform.AllocateArgs calldata _args,
    bytes[] calldata _AllcatorSigns
  ) external {
    IPJManager pjManager = _args.pjManager;

    // Step1. Reset it before using it
    _resetPayoutTemp();

    // Step2. Parameters and signatures checks
    // Check parameters
    LibQuestryPlatform._checkParameterForAllocation(_args);
    // Signatures validation
    _setAndcheckVerifysignature(_AllcatorSigns);
    // EIP712 verify signature
    address[] memory verifiedSigners = pjManager.verifySignature(
      _args,
      _AllcatorSigns
    );

    // Step3. Simulate allocation to the boarding members.
    uint256 remains = pjManager.getTotalBalance(
      _args.paymentMode,
      _args.paymentToken
    );

    uint32 boardingMembersProportion = pjManager.getBoardingMembersProportion();
    if (boardingMembersProportion > 0) {
      require(remains > 0, "QuestryPlatform: no balance to allocate");
      if (pjManager.boardingMembersExist()) {
        uint256 actual = _simulateBoardingMembersTransfer(
          pjManager,
          _args.calculateArgs,
          remains
        );
        remains -= actual;
      }
    }

    // Step4. Simulate residual allocation to the business owners.
    if (
      remains > 0 &&
      boardingMembersProportion <
      pjManager.getBoardingMemberProportionDenominator()
    ) {
      // If a few business owner proportion exists, the residual amount is allocated to the business owner.
      address businessOwner = pjManager.getBusinessOwner();
      _registerPayout(businessOwner, remains);
    } else if (remains > 0) {
      // Otherwise, the residual amount is allocated to the DAO Treasury pool.
      _registerPayout(daoTreasuryPool, remains);
    }

    // Step5. Payout
    _payout(pjManager, _args.paymentMode, _args.paymentToken);
    _resetPayoutTemp();

    // Step6. Update the terms of the contribution pools
    _updatesTermsOfContributionPools(_args.updateNeededPools, verifiedSigners);

    // Step7. Update the nonce of the pjmanager
    _updatesNonceOfPJManager(_args.pjManager);
  }

  // --------------------------------------------------
  // ERC2771 Public Functions
  // --------------------------------------------------

  /**
   * @dev Returns the nonce of `_account`.
   */
  function getNonce(address _account) public view returns (uint256) {
    return _getNonce(_account);
  }

  // --------------------------------------------------
  // Other Public Functions
  // --------------------------------------------------

  /**
   * @dev Returns the DAO Treasury pool address.
   */
  function getDAOTreasuryPool() public view returns (address) {
    return daoTreasuryPool;
  }

  // --------------------------------------------------
  // Payments Internal Functions
  // --------------------------------------------------

  /**
   * @dev The denominator with which to interpret the payment fee set.
   */
  function _paymentFeeDenominator() internal pure virtual returns (uint96) {
    return 10000;
  }

  // --------------------------------------------------
  // ERC2771 Internal Functions
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Payments Private Functions
  // --------------------------------------------------

  /**
   * @dev Transfers ERC20 or native tokens.
   */
  function _transfer(
    bytes4 _paymentMode,
    IERC20 _paymentToken,
    IPJManager _pjManager,
    address _from,
    address _to,
    uint256 _amount
  ) private {
    if (_paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE) {
      // Sending ETH
      AddressUpgradeable.sendValue(payable(_to), _amount);
    } else if (_paymentMode == LibQuestryPlatform.ERC20_PAYMENT_MODE) {
      require(
        _pjManager.isWhitelisted(_paymentToken),
        "QuestryPlatform: token not whitelisted"
      );
      // Sending ERC20
      tokenControlProxy.erc20safeTransferFrom(
        _paymentToken,
        _from,
        _to,
        _amount
      );
    } else {
      revert("QuestryPlatform: unknown paymentMode");
    }
  }

  function _depositToPJManager(
    bytes4 _paymentMode,
    IERC20 _paymentToken,
    IPJManager _pjManager,
    address _from,
    uint256 _amount
  ) private {
    if (_paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE) {
      _pjManager.deposit{value: _amount}(
        _paymentMode,
        _paymentToken,
        _from,
        _amount
      );
    } else if (_paymentMode == LibQuestryPlatform.ERC20_PAYMENT_MODE) {
      _pjManager.deposit(_paymentMode, _paymentToken, _from, _amount);
    } else {
      revert("QuestryPlatform: unknown paymentMode");
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
   * @dev Checks parameters for executePayment.
   */
  function _checkParametersForPayments(
    LibQuestryPlatform.ExecutePaymentArgs calldata _args
  ) private view {
    if (_args.paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE) {
      require(
        _msgSender() == _args.from,
        "QuestryPlatform: mismatch between _msgSender() and _args.from"
      );
      require(
        msg.value == _args.amount,
        "QuestryPlatform: mismatch between msg.value and _args.amount"
      );
      require(
        _args.paymentToken == IERC20(address(0)),
        "QuestryPlatform: paymentToken exists though paymentMode is NATIVE"
      );
    } else if (_args.paymentMode == LibQuestryPlatform.ERC20_PAYMENT_MODE) {
      require(
        msg.value == 0,
        "QuestryPlatform: msg.value != 0 though paymentMode is ERC20"
      );
      require(
        _args.paymentToken != IERC20(address(0)),
        "QuestryPlatform: paymentToken doesn't exist though paymentMode is ERC20"
      );
      require(
        _args.paymentToken.allowance(_args.from, address(tokenControlProxy)) >=
          _args.amount,
        "QuestryPlatform: insufficient allowance"
      );
    } else {
      revert("QuestryPlatform: unknown paymentMode");
    }

    if (
      _args.paymentCategory == LibQuestryPlatform.INVESTMENT_PAYMENT_CATEGORY ||
      _args.paymentCategory == LibQuestryPlatform.PROTOCOL_PAYMENT_CATEGORY
    ) {
      require(
        _args.to == address(0),
        "QuestryPlatform: 'to' is not zero address though paymentCategory is INVESTMENT_PAYMENT_CATEGORY or PROTOCOL_PAYMENT_CATEGORY"
      );
    } else {
      require(
        _args.to != address(0),
        "QuestryPlatform: 'to' is zero address though paymentCategory is COMMON_PAYMENT_CATEGORY"
      );
    }
    require(_args.amount > 0, "QuestryPlatform: amount is zero");
    require(
      _args.nonce == _getNonce(_args.from),
      "QuestryPlatform: invalid nonce"
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
   * @dev Returns the fee rate for `_paymentCategory`.
   */
  function _getFeeRate(bytes4 paymentCategory) private view returns (uint32) {
    if (paymentCategory == LibQuestryPlatform.COMMON_PAYMENT_CATEGORY) {
      return feeRates.common;
    } else if (
      paymentCategory == LibQuestryPlatform.INVESTMENT_PAYMENT_CATEGORY
    ) {
      return feeRates.investment;
    } else if (
      paymentCategory == LibQuestryPlatform.PROTOCOL_PAYMENT_CATEGORY
    ) {
      return feeRates.protocol;
    } else {
      revert("QuestryPlatform: unknown paymentCategory");
    }
  }

  // --------------------------------------------------
  // Allocation Private Functions
  // --------------------------------------------------

  /**
   * @dev Simulate the boarding members transfer(Not actual transfer)
   */
  function _simulateBoardingMembersTransfer(
    IPJManager _pjManager,
    LibQuestryPlatform.CalculateDispatchArgs memory _calculateArgs,
    uint256 _totalAmount
  ) private returns (uint256) {
    address[] memory members = _pjManager.getBoardingMembers();
    LibQuestryPlatform.SharesResult memory sharesResult = contributionCalculator
      .calculateDispatch(members, _calculateArgs);
    if (sharesResult.totalShare == 0) {
      return 0;
    }

    uint256 actualTotalAmount = 0;
    for (uint256 i = 0; i < members.length; i++) {
      uint256 amount = (_totalAmount * sharesResult.shares[i]) /
        sharesResult.totalShare;
      actualTotalAmount += amount;
      _registerPayout(members[i], amount);
    }

    return actualTotalAmount;
  }

  /**
   * @dev Payout to all receivers using tempPayoutAddress and tempPayoutAmount
   */
  function _payout(
    IPJManager _pjManager,
    bytes4 _paymentMode,
    IERC20 _paymentToken
  ) private {
    for (uint256 i = 0; i < tempPayoutAddress.length; i++) {
      address payable receiver = payable(tempPayoutAddress[i]);
      uint256 amount = tempPayoutAmount[receiver];
      _pjManager.withdrawForAllocation(
        _paymentMode,
        _paymentToken,
        receiver,
        amount
      );
    }
  }

  /**
   * @dev Register payment locally, to be used in _payout
   *
   * @param _receiver address
   * @param _amount uint256
   */
  function _registerPayout(address _receiver, uint256 _amount) private {
    if (_amount > 0) {
      if (tempPayoutAmount[_receiver] == 0) {
        tempPayoutAddress.push(_receiver);
      }
      tempPayoutAmount[_receiver] += _amount;
    }
  }

  /**
   * @dev Clears previous payout data
   * It is used for collective payment to pay one address only once
   */
  function _resetPayoutTemp() private {
    for (uint256 i = 0; i < tempPayoutAddress.length; i++) {
      delete tempPayoutAmount[tempPayoutAddress[i]];
    }
    delete tempPayoutAddress;
  }

  /**
   * @dev Updates the terms of contribution pools.
   */
  function _updatesTermsOfContributionPools(
    IContributionPool[] calldata _pools,
    address[] memory _verifiedSigners
  ) private {
    for (uint256 i = 0; i < _pools.length; i++) {
      _pools[i].incrementTerm(_verifiedSigners);
    }
  }

  /**
   * @dev Updates the nonce of pjmanager.
   */
  function _updatesNonceOfPJManager(IPJManager pjmanager) private {
    pjmanager.incrementNonce();
  }

  /**
   * @dev Elimination of duplicate signature verification.
   */
  function _setAndcheckVerifysignature(bytes[] calldata _signatures) private {
    for (uint256 idx = 0; idx < _signatures.length; idx++) {
      require(
        !_isCompVerifySignature[_signatures[idx]],
        "QuestryPlatform: Elimination of duplicate signature verification"
      );
      _isCompVerifySignature[_signatures[idx]] = true;
    }
  }

  // --------------------------------------------------
  // ERC2771 Private Functions
  // --------------------------------------------------

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
}
