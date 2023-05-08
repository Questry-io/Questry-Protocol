// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
//library import
import {LibPJManager} from "../library/LibPJManager.sol";
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";
//interface import
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {IContributionCalculator} from "../interface/platform/IContributionCalculator.sol";
import {IContributionPool} from "../interface/pjmanager/IContributionPool.sol";
import {IQuestryPlatform} from "../interface/platform/IQuestryPlatform.sol";
import {IBoard} from "../interface/token/IBoard.sol";

contract QuestryPlatform is Initializable, OwnableUpgradeable, UUPSUpgradeable {
  event CommonFeeRateChanged(uint32 _rate);
  event InvestmentFeeRateChanged(uint32 _rate);
  event ProtocolFeeRateChanged(uint32 _rate);

  IContributionCalculator public contributionCalculator;
  address public daoTreasuryPool;
  LibQuestryPlatform.FeeRates public feeRates;

  // Just a temp variable to be used as local function variable
  // as mapping declaration is not supported inside function
  mapping(address => uint256) private tempPayoutAmount;
  address[] private tempPayoutAddress;
  //set veryfy signature hystory
  mapping(bytes => bool) private _isCompVerifySignature;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IContributionCalculator _contributionCalculator,
    address _daoTreasuryPool
  ) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();

    contributionCalculator = _contributionCalculator;
    daoTreasuryPool = _daoTreasuryPool;
    _setDefaultFeeRates();
  }

  /// @inheritdoc UUPSUpgradeable
  function _authorizeUpgrade(address _newImplementation)
    internal
    override
    onlyOwner
  {}

  /**
   * @dev Allocates tokens to business owners, boarding members and DAO treasury pool.
   */

  function allocate(
    LibQuestryPlatform.AllocateArgs calldata _args,
    bytes[] calldata _AllcatorSigns
  ) external {
    IPJManager pjManager = _args.pjManager;
    // Step1 : Parameters and signatures checks
    // Check parameters
    LibQuestryPlatform._checkParameterForAllocation(_args);
    //signatures validation
    _setAndcheckVerifysignature(_AllcatorSigns);
    //EIP712 verify signature
    pjManager.verifySignature(_args, _AllcatorSigns);

    LibPJManager.AllocationShare[] memory businessOwners = pjManager
      .getBusinessOwners();
    uint32 boardingMembersProportion = pjManager.getBoardingMembersProportion();

    // Step1. Simulate deduction of the protocol fee.
    uint256 totalBalance = pjManager.getTotalBalance(
      _args.paymentMode,
      _args.paymentToken
    );
    uint256 protocolFee = _protocolFee(totalBalance);
    _simulateDAOTreasuryTransfer(protocolFee);

    // Step2. Simulate allocation to the boarding members.
    uint256 remains = totalBalance - protocolFee;
    if (boardingMembersProportion > 0 && _args.board.boardingMembersExist()) {
      uint256 reserved = _boardingMembersBalance(
        remains,
        boardingMembersProportion
      );
      uint256 actual = _simulateBoardingMembersTransfer(
        _args.board,
        _args.calculateArgs,
        reserved
      );
      remains -= actual;
    }

    // Step3. Simulate allocation to the business owners.
    uint256 actual = _simulateBusinessOwnersTransfer(businessOwners, remains);
    remains -= actual;

    // Step4. Simulate residual allocation
    if (remains > 0) {
      _simulateDAOTreasuryTransfer(remains);
    }

    // Step5. Payout
    _payout(pjManager, _args.paymentMode, _args.paymentToken);
    _resetPayoutTemp();

    // Step6. Update the terms of the contribution pools
    _updatesTermsOfContributionPools(
      _args.updateNeededPools,
      _args.contributePoolOwner
    );
    //Step7. Update the nonce of the pjmanager
    _updatesNonceOfPJManager(_args.pjManager);
  }

  /**
   * @dev Sets the common fee `_rate`.
   */
  function setCommonFeeRate(uint32 _rate) external onlyOwner {
    require(
      _rate <= 10000,
      "QuestryPlatform: common fee rate must be less than or equal to 10000"
    );
    feeRates.common = _rate;
    emit CommonFeeRateChanged(_rate);
  }

  /**
   * @dev Sets the investment fee `_rate`.
   */
  function setInvestmentFeeRate(uint32 _rate) external onlyOwner {
    require(
      _rate <= 10000,
      "QuestryPlatform: investment fee rate must be less than or equal to 10000"
    );
    feeRates.investment = _rate;
    emit InvestmentFeeRateChanged(_rate);
  }

  /**
   * @dev Sets the protocol fee `_rate`.
   */
  function setProtocolFeeRate(uint32 _rate) external onlyOwner {
    require(
      _rate <= 10000,
      "QuestryPlatform: protocol fee rate must be less than or equal to 10000"
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
  // Private functions
  // --------------------------------------------------

  /**
   * @dev Simulate the DAO Treasury transfer(Not actual transfer)
   */
  function _simulateDAOTreasuryTransfer(uint256 _amount) private {
    _registerPayout(daoTreasuryPool, _amount);
  }

  /**
   * @dev Simulate the boarding members transfer(Not actual transfer)
   */
  function _simulateBoardingMembersTransfer(
    IBoard _board,
    LibQuestryPlatform.CalculateDispatchArgs memory _calculateArgs,
    uint256 _totalAmount
  ) private returns (uint256) {
    address[] memory members = _board.getBoardingMembers();
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
   * @dev Simulate the business owners transfer(Not actual transfer)
   */
  function _simulateBusinessOwnersTransfer(
    LibPJManager.AllocationShare[] memory _businessOwners,
    uint256 _totalAmount
  ) private returns (uint256) {
    uint120 totalShare = 0;
    for (uint256 i = 0; i < _businessOwners.length; i++) {
      totalShare += _businessOwners[i].share;
    }
    if (totalShare == 0) {
      return 0;
    }

    uint256 actualTotalAmount = 0;
    for (uint256 i = 0; i < _businessOwners.length; i++) {
      uint256 amount = (_totalAmount * _businessOwners[i].share) / totalShare;
      actualTotalAmount += amount;
      _registerPayout(_businessOwners[i].recipient, amount);
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
    address[] calldata _poolowners
  ) private {
    for (uint256 i = 0; i < _pools.length; i++) {
      _pools[i].incrementTerm(_poolowners[i]);
    }
  }

  /**
   * @dev Updates the nonce of pjmanager.
   */
  function _updatesNonceOfPJManager(IPJManager pjmanager) private {
    pjmanager.incrementNonce();
  }

  /**
   * @dev Returns protocol fees deducted from `totalBalance`.
   */
  function _protocolFee(uint256 _totalBalance) private view returns (uint256) {
    return (_totalBalance * feeRates.protocol) / 10000;
  }

  /**
   * @dev Returns the balance allocated to boarding members
   * based on the specified `revenue` and `boardingMembersProportion`.
   * The `revenue` is the total balance with the fees deducted.
   */
  function _boardingMembersBalance(
    uint256 _revenue,
    uint32 _boardingMembersProportion
  ) private pure returns (uint256) {
    return (_revenue * _boardingMembersProportion) / 10000;
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

  /**
   * @dev Sets the default fee rates.
   */
  function _setDefaultFeeRates() private {
    feeRates.common = 300;
    feeRates.investment = 300;
    feeRates.protocol = 300;
  }
}
