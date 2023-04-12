// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPJManager} from "../interface/pjmanager/IPJManager.sol";
import {IContributionCalculator} from "../interface/platform/IContributionCalculator.sol";
import {IQuestryPlatform} from "../interface/platform/IQuestryPlatform.sol";
import {LibPJManager} from "../library/LibPJManager.sol";
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";
import {ISBT} from "../interface/token/ISBT.sol";

contract QuestryPlatform is IQuestryPlatform, AccessControl, ReentrancyGuard {
  uint32 public constant PROTOCOL_FEE_RATE = 300;

  IContributionCalculator public contributionCalculator;
  address public daoTreasuryPool;

  // Just a temp variable to be used as local function variable
  // as mapping declaration is not supported inside function
  mapping(address => uint256) private _tempPayoutAmount;
  address[] private _tempPayoutAddress;

  constructor(
    IContributionCalculator _contributionCalculator,
    address _daoTreasuryPool
  ) {
    contributionCalculator = _contributionCalculator;
    daoTreasuryPool = _daoTreasuryPool;
  }

  /**
   * @dev Allocates tokens to business owners, boarding members and DAO treasury pool.
   */
  function allocate(LibQuestryPlatform.AllocateArgs calldata _args)
    external
    nonReentrant
  {
    IPJManager pjManager = _args.pjManager;
    require(
      pjManager.verifySignature(_args.signature),
      "QuestryPlatform: signature verification failed"
    );

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
  }

  // --------------------------------------------------
  // Private functions
  // --------------------------------------------------

  /**
   * @dev Simulate the DAO Treasury transfer(Not actual transfer)
   */
  function _simulateDAOTreasuryTransfer(uint256 amount) private {
    _registerPayout(daoTreasuryPool, amount);
  }

  /**
   * @dev Simulate the boarding members transfer(Not actual transfer)
   */
  function _simulateBoardingMembersTransfer(
    ISBT board,
    LibQuestryPlatform.CalculateDispatchArgs memory calculateArgs,
    uint256 totalAmount
  ) private returns (uint256) {
    address[] memory members = board.boardingMembers();
    LibQuestryPlatform.SharesResult memory sharesResult = contributionCalculator
      .calculateDispatch(members, calculateArgs);
    if (sharesResult.totalShare == 0) {
      return 0;
    }

    uint256 actualTotalAmount = 0;
    for (uint256 i = 0; i < members.length; i++) {
      uint256 amount = (totalAmount * sharesResult.shares[i]) /
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
    LibPJManager.AllocationShare[] memory businessOwners,
    uint256 totalAmount
  ) private returns (uint256) {
    uint120 totalShare = 0;
    for (uint256 i = 0; i < businessOwners.length; i++) {
      totalShare += businessOwners[i].share;
    }
    if (totalShare == 0) {
      return 0;
    }

    uint256 actualTotalAmount = 0;
    for (uint256 i = 0; i < businessOwners.length; i++) {
      uint256 amount = (totalAmount * businessOwners[i].share) / totalShare;
      actualTotalAmount += amount;
      _registerPayout(businessOwners[i].recipient, amount);
    }

    return actualTotalAmount;
  }

  /**
   * @dev Payout to all receivers using _tempPayoutAddress and _tempPayoutAmount
   */
  function _payout(
    IPJManager pjManager,
    bytes4 paymentMode,
    IERC20 paymentToken
  ) private {
    for (uint256 i = 0; i < _tempPayoutAddress.length; i++) {
      address payable receiver = payable(_tempPayoutAddress[i]);
      uint256 amount = _tempPayoutAmount[receiver];
      pjManager.withdrawForAllocation(
        paymentMode,
        paymentToken,
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
      if (_tempPayoutAmount[_receiver] == 0) {
        _tempPayoutAddress.push(_receiver);
      }
      _tempPayoutAmount[_receiver] += _amount;
    }
  }

  /**
   * @dev Clears previous payout data
   * It is used for collective payment to pay one address only once
   */
  function _resetPayoutTemp() private {
    for (uint256 i = 0; i < _tempPayoutAddress.length; i++) {
      delete _tempPayoutAmount[_tempPayoutAddress[i]];
    }
    delete _tempPayoutAddress;
  }

  /**
   * @dev Returns protocol fees deducted from `totalBalance`.
   */
  function _protocolFee(uint256 totalBalance) private view returns (uint256) {
    return (totalBalance * PROTOCOL_FEE_RATE) / 10000;
  }

  /**
   * @dev Returns the balance allocated to boarding members
   * based on the specified `revenue` and `boardingMembersProportion`.
   * The `revenue` is the total balance with the fees deducted.
   */
  function _boardingMembersBalance(
    uint256 revenue,
    uint32 boardingMembersProportion
  ) private pure returns (uint256) {
    return (revenue * boardingMembersProportion) / 10000;
  }
}
