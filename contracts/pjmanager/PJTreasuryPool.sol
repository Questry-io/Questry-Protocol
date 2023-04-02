// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IContributionCalculator} from "../interface/platform/IContributionCalculator.sol";
import {IKanamePlatform} from "../interface/platform/IKanamePlatform.sol";
import {IPJTreasuryPool} from "../interface/pjmanager/IPJTreasuryPool.sol";
import {ISBT} from "../interface/token/ISBT.sol";

/**
 * @title PJTreasuryPool
 * @dev This contract stores treasury and controls token whitelists.
 */
contract PJTreasuryPool is IPJTreasuryPool, AccessControl, ReentrancyGuard {
  // TODO: Move PlatformDomain library
  bytes4 public constant NATIVE_PAYMENT_MODE = bytes4(keccak256("NATIVE"));
  bytes4 public constant ERC20_PAYMENT_MODE = bytes4(keccak256("ERC20"));

  // TODO: Move PlatformDomain library
  bytes32 public constant PJ_ALLOCATE_ROLE = keccak256("PJ_ALLOCATE_ROLE");

  bytes32 public constant PJ_ADMIN_ROLE = keccak256("PJ_ADMIN_ROLE");
  bytes32 public constant PJ_MANAGEMENT_ROLE = keccak256("PJ_MANAGEMENT_ROLE");
  bytes32 public constant PJ_WHITELIST_ROLE = keccak256("PJ_WHITELIST_ROLE");
  bytes32 public constant PJ_DEPOSIT_ROLE = keccak256("PJ_DEPOSIT_ROLE");

  IKanamePlatform public immutable kanamePlatform;
  IContributionCalculator public immutable contributionCalculator;
  address public immutable admin;
  IERC20[] public tokenWhitelists;
  mapping(IERC20 => bool) private _isTokenWhitelisted;

  AllocationShare[] public businessOwners;

  /// @dev the basis points proportion of total allocation for boarding members
  uint32 public immutable boardingMembersProportion;

  // Just a temp variable to be used as local function variable
  // as mapping declaration is not supported inside function
  mapping(address => uint256) private _tempPayoutAmount;
  address[] private _tempPayoutAddress;

  constructor(
    IKanamePlatform _kanamePlatform,
    IContributionCalculator _contributionCalculator,
    address _admin,
    uint32 _boardingMembersProportion,
    AllocationShare[] memory _businessOwners
  ) {
    bool ownersShareExists = _initBusinessOwners(_businessOwners);
    _validateAllocationSettings(_boardingMembersProportion, ownersShareExists);

    kanamePlatform = _kanamePlatform;
    contributionCalculator = _contributionCalculator;
    admin = _admin;
    boardingMembersProportion = _boardingMembersProportion;

    _setupRole(PJ_ALLOCATE_ROLE, address(_kanamePlatform));

    _setupRole(PJ_ADMIN_ROLE, _admin);
    _setupRole(PJ_MANAGEMENT_ROLE, _admin);
    _setupRole(PJ_WHITELIST_ROLE, _admin);
    _setupRole(PJ_DEPOSIT_ROLE, _admin);

    _setRoleAdmin(PJ_MANAGEMENT_ROLE, PJ_ADMIN_ROLE);
    _setRoleAdmin(PJ_WHITELIST_ROLE, PJ_ADMIN_ROLE);
    _setRoleAdmin(PJ_DEPOSIT_ROLE, PJ_ADMIN_ROLE);
  }

  // --------------------------------------------------
  // PJ_MANAGEMENT_ROLE
  // --------------------------------------------------

  /// @inheritdoc IPJTreasuryPool
  function addBusinessOwner(AllocationShare calldata _businessOwner)
    external
    onlyRole(PJ_MANAGEMENT_ROLE)
  {
    for (uint256 i = 0; i < businessOwners.length; i++) {
      require(
        businessOwners[i].recipient != _businessOwner.recipient,
        "PJTreasuryPool: businessOwner already exists"
      );
    }
    businessOwners.push(_businessOwner);
    _validateAllocationSettings();
    emit AddBusinessOwner(_businessOwner.recipient, _businessOwner.share);
  }

  /// @inheritdoc IPJTreasuryPool
  function removeBusinessOwner(address _businessOwner)
    external
    onlyRole(PJ_MANAGEMENT_ROLE)
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
    _validateAllocationSettings();
    emit RemoveBusinessOwner(_businessOwner);
  }

  /// @inheritdoc IPJTreasuryPool
  function updateBusinessOwner(AllocationShare calldata _businessOwner)
    external
    onlyRole(PJ_MANAGEMENT_ROLE)
  {
    bool updated = false;
    for (uint256 i = 0; i < businessOwners.length; i++) {
      if (businessOwners[i].recipient == _businessOwner.recipient) {
        businessOwners[i].share = _businessOwner.share;
        updated = true;
      }
    }
    require(updated, "PJTreasuryPool: businessOwner doesn't exist");
    _validateAllocationSettings();
    emit UpdateBusinessOwner(_businessOwner.recipient, _businessOwner.share);
  }

  // --------------------------------------------------
  // PJ_WHITELIST_ROLE
  // --------------------------------------------------

  /// @inheritdoc IPJTreasuryPool
  function allowERC20(IERC20 token) external onlyRole(PJ_WHITELIST_ROLE) {
    require(Address.isContract(address(token)), "PJTreasuryPool: token is not a contract");
    require(!isWhitelisted(token), "PJTreasuryPool: already whitelisted");
    tokenWhitelists.push(token);
    _isTokenWhitelisted[token] = true;
    emit AllowERC20(address(token));
  }

  /// @inheritdoc IPJTreasuryPool
  function disallowERC20(IERC20 token) external onlyRole(PJ_WHITELIST_ROLE) {
    require(isWhitelisted(token), "PJTreasuryPool: not whitelisted");
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
  // PJ_DEPOSIT_ROLE
  // --------------------------------------------------

  /// @inheritdoc IPJTreasuryPool
  function deposit() external payable onlyRole(PJ_DEPOSIT_ROLE) {
    emit Deposit(_msgSender(), msg.value);
  }

  /// @inheritdoc IPJTreasuryPool
  function depositERC20(IERC20 token, uint256 amount)
    external
    onlyRole(PJ_DEPOSIT_ROLE)
  {
    require(isWhitelisted(token), "PJTreasuryPool: not whitelisted");
    token.transferFrom(_msgSender(), address(this), amount);
    emit DepositERC20(address(token), _msgSender(), amount);
  }

  // --------------------------------------------------
  // PJ_ALLOCATE_ROLE
  // --------------------------------------------------

  /// @inheritdoc IPJTreasuryPool
  function allocate(IKanamePlatform.AllocateArgs calldata _args)
    external
    nonReentrant
    onlyRole(PJ_ALLOCATE_ROLE)
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
  function getBusinessOwners() external view returns (AllocationShare[] memory) {
    return businessOwners;
  }

  /// @inheritdoc IPJTreasuryPool
  function getTokenWhitelists() external view returns (IERC20[] memory) {
    return tokenWhitelists;
  }

  /// @inheritdoc IPJTreasuryPool
  function isWhitelisted(IERC20 token) public view returns (bool) {
    return _isTokenWhitelisted[token];
  }

  // --------------------------------------------------
  // Private functions
  // --------------------------------------------------

  function _validateAllocationSettings() private view {
    bool ownersShareExists = false;
    for (uint256 i = 0; i < businessOwners.length; i++) {
      if (businessOwners[i].share > 0) {
        ownersShareExists = true;
        break;
      }
    }
    _validateAllocationSettings(boardingMembersProportion, ownersShareExists);
  }

  function _validateAllocationSettings(
    uint32 _boardingMembersProportion,
    bool _businessOwnersShareExists
  ) private pure {
    require(
      _boardingMembersProportion <= 10000,
      "PJTreasuryPool: proportion is out of range"
    );
    if (_boardingMembersProportion < 10000) {
      require(
        _businessOwnersShareExists,
        "PJTreasuryPool: businessOwners share should exist unless proportion is 10000"
      );
    } else {
      require(
        !_businessOwnersShareExists,
        "PJTreasuryPool: proportion should be less than 10000 or businessOwners share should not exist"
      );
    }
  }

  /**
   * @dev Simulate the DAO Treasury transfer(Not actual transfer)
   */
  function _simulateDAOTreasuryTransfer(uint256 amount) private {
    address daoTreasuryPool = kanamePlatform.getDAOTreasuryPool();
    _registerPayout(daoTreasuryPool, amount);
  }

  /**
   * @dev Simulate the boarding members transfer(Not actual transfer)
   */
  function _simulateBoardingMembersTransfer(
    ISBT board,
    IContributionCalculator.CalculateDispatchArgs memory calculateArgs,
    uint256 totalAmount
  ) private returns (uint256) {
    address[] memory members = board.boardingMembers();
    IContributionCalculator.SharesResult
      memory sharesResult = contributionCalculator.calculateDispatch(
        members,
        calculateArgs
      );
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
      _paymentMode == NATIVE_PAYMENT_MODE || isWhitelisted(_paymentToken),
      "PJTreasuryPool: not whitelisted"
    );

    for (uint256 i = 0; i < _tempPayoutAddress.length; i++) {
      address payable receiver = payable(_tempPayoutAddress[i]);
      uint256 amount = _tempPayoutAmount[receiver];

      if (_paymentMode == NATIVE_PAYMENT_MODE) {
        // Sending ETH
        Address.sendValue(receiver, amount);
      } else if (_paymentMode == ERC20_PAYMENT_MODE) {
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

  function _initBusinessOwners(AllocationShare[] memory _businessOwners)
    private
    returns (bool shareExists)
  {
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
    if (_paymentMode == NATIVE_PAYMENT_MODE) {
      return address(this).balance;
    } else if (_paymentMode == ERC20_PAYMENT_MODE) {
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
    return (totalBalance * kanamePlatform.getProtocolFeeRate()) / 10000;
  }
}
