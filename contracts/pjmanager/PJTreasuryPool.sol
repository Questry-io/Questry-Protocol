// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IContributionCalculator} from "../interface/platform/IContributionCalculator.sol";
import {IQuestryPlatform} from "../interface/platform/IQuestryPlatform.sol";
import {IPJTreasuryPool} from "../interface/pjmanager/IPJTreasuryPool.sol";
import {ISBT} from "../interface/token/ISBT.sol";
import {LibPJManager} from "../library/LibPJManager.sol";
import {LibQuestryPlatform} from "../library/LibQuestryPlatform.sol";

/**
 * @title PJTreasuryPool
 * @dev This contract stores treasury and controls token whitelists.
 */
contract PJTreasuryPool is IPJTreasuryPool, AccessControl, ReentrancyGuard {
  IQuestryPlatform public immutable questryPlatform;
  IContributionCalculator public immutable contributionCalculator;
  address public immutable admin;
  IERC20[] public tokenWhitelists;
  mapping(IERC20 => bool) private _isTokenWhitelisted;

  LibPJManager.AllocationShare[] public businessOwners;

  /// @dev the basis points proportion of total allocation for boarding members
  uint32 public immutable boardingMembersProportion;

  // Just a temp variable to be used as local function variable
  // as mapping declaration is not supported inside function
  mapping(address => uint256) private _tempPayoutAmount;
  address[] private _tempPayoutAddress;

  constructor(
    IQuestryPlatform _questryPlatform,
    IContributionCalculator _contributionCalculator,
    address _admin,
    uint32 _boardingMembersProportion,
    LibPJManager.AllocationShare[] memory _businessOwners
  ) {
    bool ownersShareExists = _initBusinessOwners(_businessOwners);
    LibPJManager._validateAllocationSettings(
      _boardingMembersProportion,
      ownersShareExists
    );

    questryPlatform = _questryPlatform;
    contributionCalculator = _contributionCalculator;
    admin = _admin;
    boardingMembersProportion = _boardingMembersProportion;

    _setupRole(LibPJManager.PJ_ALLOCATE_ROLE, address(_questryPlatform));

    _setupRole(LibPJManager.PJ_ADMIN_ROLE, _admin);
    _setupRole(LibPJManager.PJ_MANAGEMENT_ROLE, _admin);
    _setupRole(LibPJManager.PJ_WHITELIST_ROLE, _admin);
    _setupRole(LibPJManager.PJ_DEPOSIT_ROLE, _admin);

    _setRoleAdmin(LibPJManager.PJ_MANAGEMENT_ROLE, LibPJManager.PJ_ADMIN_ROLE);
    _setRoleAdmin(LibPJManager.PJ_WHITELIST_ROLE, LibPJManager.PJ_ADMIN_ROLE);
    _setRoleAdmin(LibPJManager.PJ_DEPOSIT_ROLE, LibPJManager.PJ_ADMIN_ROLE);
  }

  // --------------------------------------------------
  // LibPJManager.PJ_MANAGEMENT_ROLE
  // --------------------------------------------------

  /// @inheritdoc IPJTreasuryPool
  function addBusinessOwner(
    LibPJManager.AllocationShare calldata _businessOwner
  ) external onlyRole(LibPJManager.PJ_MANAGEMENT_ROLE) {
    for (uint256 i = 0; i < businessOwners.length; i++) {
      require(
        businessOwners[i].recipient != _businessOwner.recipient,
        "PJTreasuryPool: businessOwner already exists"
      );
    }
    businessOwners.push(_businessOwner);
    LibPJManager._validateAllocationSettings(
      businessOwners,
      boardingMembersProportion
    );
    emit AddBusinessOwner(_businessOwner.recipient, _businessOwner.share);
  }

  /// @inheritdoc IPJTreasuryPool
  function removeBusinessOwner(address _businessOwner)
    external
    onlyRole(LibPJManager.PJ_MANAGEMENT_ROLE)
  {
    bool removed = false;
    uint32 newIdx = 0;
    for (uint256 i = 0; i < businessOwners.length; i++) {
      if (businessOwners[i].recipient == _businessOwner) {
        removed = true;
      } else {
        businessOwners[newIdx++] = businessOwners[i];
      }
    }
    require(removed, "PJTreasuryPool: businessOwner doesn't exist");
    businessOwners.pop();
    LibPJManager._validateAllocationSettings(
      businessOwners,
      boardingMembersProportion
    );
    emit RemoveBusinessOwner(_businessOwner);
  }

  /// @inheritdoc IPJTreasuryPool
  function updateBusinessOwner(
    LibPJManager.AllocationShare calldata _businessOwner
  ) external onlyRole(LibPJManager.PJ_MANAGEMENT_ROLE) {
    bool updated = false;
    for (uint256 i = 0; i < businessOwners.length; i++) {
      if (businessOwners[i].recipient == _businessOwner.recipient) {
        businessOwners[i].share = _businessOwner.share;
        updated = true;
      }
    }
    require(updated, "PJTreasuryPool: businessOwner doesn't exist");
    LibPJManager._validateAllocationSettings(
      businessOwners,
      boardingMembersProportion
    );
    emit UpdateBusinessOwner(_businessOwner.recipient, _businessOwner.share);
  }

  // --------------------------------------------------
  // LibPJManager.PJ_WHITELIST_ROLE
  // --------------------------------------------------

  /// @inheritdoc IPJTreasuryPool
  function allowERC20(IERC20 token)
    external
    onlyRole(LibPJManager.PJ_WHITELIST_ROLE)
  {
    require(
      Address.isContract(address(token)),
      "PJTreasuryPool: token is not a contract"
    );
    require(!_isTokenWhitelisted[token], "PJTreasuryPool: already whitelisted");
    tokenWhitelists.push(token);
    _isTokenWhitelisted[token] = true;
    emit AllowERC20(address(token));
  }

  /// @inheritdoc IPJTreasuryPool
  function disallowERC20(IERC20 token)
    external
    onlyRole(LibPJManager.PJ_WHITELIST_ROLE)
  {
    require(_isTokenWhitelisted[token], "PJTreasuryPool: not whitelisted");
    uint32 newIdx = 0;
    for (uint256 i = 0; i < tokenWhitelists.length; i++) {
      if (token != tokenWhitelists[i]) {
        tokenWhitelists[newIdx++] = tokenWhitelists[i];
      }
    }
    tokenWhitelists.pop();
    _isTokenWhitelisted[token] = false;
    emit DisallowERC20(address(token));
  }

  // --------------------------------------------------
  // LibPJManager.PJ_DEPOSIT_ROLE
  // --------------------------------------------------

  /// @inheritdoc IPJTreasuryPool
  function deposit() external payable onlyRole(LibPJManager.PJ_DEPOSIT_ROLE) {
    emit Deposit(_msgSender(), msg.value);
  }

  /// @inheritdoc IPJTreasuryPool
  function depositERC20(IERC20 token, uint256 amount)
    external
    onlyRole(LibPJManager.PJ_DEPOSIT_ROLE)
  {
    require(_isTokenWhitelisted[token], "PJTreasuryPool: not whitelisted");
    token.transferFrom(_msgSender(), address(this), amount);
    emit DepositERC20(address(token), _msgSender(), amount);
  }

  // --------------------------------------------------
  // LibPJManager.PJ_ALLOCATE_ROLE
  // --------------------------------------------------

  /// @inheritdoc IPJTreasuryPool
  function allocate(LibQuestryPlatform.AllocateArgs calldata _args)
    external
    nonReentrant
    onlyRole(LibPJManager.PJ_ALLOCATE_ROLE)
  {
    // Step1. Simulate deduction of the protocol fee.
    uint256 totalBalance = _totalBalance(_args.paymentMode, _args.paymentToken);
    uint256 protocolFee = _protocolFee(totalBalance);
    _simulateDAOTreasuryTransfer(protocolFee);

    // Step2. Simulate allocation to the boarding members.
    uint256 remains = totalBalance - protocolFee;
    if (boardingMembersProportion > 0 && _args.board.boardingMembersExist()) {
      uint256 reserved = _boardingMembersBalance(remains);
      uint256 actual = _simulateBoardingMembersTransfer(
        _args.board,
        _args.calculateArgs,
        reserved
      );
      remains -= actual;
    }

    // Step3. Simulate allocation to the business owners.
    uint256 actual = _simulateBusinessOwnersTransfer(remains);
    remains -= actual;

    // Step4. Simulate residual allocation
    if (remains > 0) {
      _simulateDAOTreasuryTransfer(remains);
    }

    // Step5. Payout
    _payout(_args.paymentMode, _args.paymentToken);
    _resetPayoutTemp();
  }

  // --------------------------------------------------
  // Public functions
  // --------------------------------------------------

  /// @inheritdoc IPJTreasuryPool
  function getBusinessOwners()
    external
    view
    returns (LibPJManager.AllocationShare[] memory)
  {
    return businessOwners;
  }

  /// @inheritdoc IPJTreasuryPool
  function getTokenWhitelists() external view returns (IERC20[] memory) {
    return tokenWhitelists;
  }

  /// @inheritdoc IPJTreasuryPool
  function isWhitelisted(IERC20 token) external view returns (bool) {
    return _isTokenWhitelisted[token];
  }

  // --------------------------------------------------
  // Private functions
  // --------------------------------------------------

  /**
   * @dev Simulate the DAO Treasury transfer(Not actual transfer)
   */
  function _simulateDAOTreasuryTransfer(uint256 amount) private {
    address daoTreasuryPool = questryPlatform.getDAOTreasuryPool();
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
  function _simulateBusinessOwnersTransfer(uint256 totalAmount)
    private
    returns (uint256)
  {
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
  function _payout(bytes4 _paymentMode, IERC20 _paymentToken) private {
    require(
      _paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE ||
        _isTokenWhitelisted[_paymentToken],
      "PJTreasuryPool: not whitelisted"
    );

    for (uint256 i = 0; i < _tempPayoutAddress.length; i++) {
      address payable receiver = payable(_tempPayoutAddress[i]);
      uint256 amount = _tempPayoutAmount[receiver];

      if (_paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE) {
        // Sending ETH
        Address.sendValue(receiver, amount);
      } else if (_paymentMode == LibQuestryPlatform.ERC20_PAYMENT_MODE) {
        // Sending ERC20
        _paymentToken.transfer(receiver, amount);
      } else {
        revert("PJTreasuryPool: unknown paymentMode");
      }
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

  function _initBusinessOwners(
    LibPJManager.AllocationShare[] memory _businessOwners
  ) private returns (bool shareExists) {
    uint256 totalShare = 0;
    for (uint256 i = 0; i < _businessOwners.length; i++) {
      totalShare += _businessOwners[i].share;
      businessOwners.push(_businessOwners[i]);
    }
    shareExists = totalShare > 0;
  }

  function _totalBalance(bytes4 _paymentMode, IERC20 _paymentToken)
    private
    view
    returns (uint256)
  {
    if (_paymentMode == LibQuestryPlatform.NATIVE_PAYMENT_MODE) {
      return address(this).balance;
    } else if (_paymentMode == LibQuestryPlatform.ERC20_PAYMENT_MODE) {
      return _paymentToken.balanceOf(address(this));
    } else {
      revert("PJTreasuryPool: unknown paymentMode");
    }
  }

  /**
   * @dev Returns allocated boardingMembers balance.
   * The `revenue` is the total balance with the fees deducted.
   */
  function _boardingMembersBalance(uint256 revenue)
    private
    view
    returns (uint256)
  {
    return (revenue * boardingMembersProportion) / 10000;
  }

  function _protocolFee(uint256 totalBalance) private view returns (uint256) {
    return (totalBalance * questryPlatform.getProtocolFeeRate()) / 10000;
  }
}
