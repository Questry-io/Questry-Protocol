// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
//interface Inheritance
import "contracts/interface/token-control-proxy/ITokenControlProxy.sol";

/**
 * @title
 */
contract TokenControlProxy is
  Initializable,
  ITokenControlProxy,
  ERC2771ContextUpgradeable,
  ERC165Upgradeable,
  AccessControlUpgradeable,
  UUPSUpgradeable
{
  event ExecutorRoleGranted(address indexed _questryPlatform);

  /// @dev QuestryPlatform is the sole owner of the EXECUTOR_ROLE.
  address public questryPlatform;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address _trustedForwarder)
    ERC2771ContextUpgradeable(_trustedForwarder)
  {
    _disableInitializers();
  }

  /**
   * @dev Used instead of constructor(must be called once)
   */
  function __TokenControlProxy_init(address _roleManager) external initializer {
    __ERC165_init();
    __AccessControl_init();
    __UUPSUpgradeable_init();
    // Set Token Control Proxy Role Manager (EOA)
    _setupRole(ADMIN_ROLE, _roleManager);
  }

  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
  bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

  /**
   * @dev See {UUPSUpgradeable._authorizeUpgrade()}
   *
   * Requirements:
   * - onlyAdmin can call
   */
  function _authorizeUpgrade(address _newImplementation)
    internal
    virtual
    override
    onlyRole(ADMIN_ROLE)
  {}

  /**
   * @dev Grants the executor role to `_questryPlatform`.
   *
   * Emits an {ExecutorRoleGranted} event.
   */
  function grantExecutorRoleToQuestryPlatform(address _questryPlatform)
    external
    onlyRole(ADMIN_ROLE)
  {
    require(
      questryPlatform == address(0),
      "TokenControlProxy: already granted"
    );
    questryPlatform = _questryPlatform;
    _setupRole(EXECUTOR_ROLE, _questryPlatform);
    emit ExecutorRoleGranted(_questryPlatform);
  }

  /**
   * @dev See {IERC165Upgradeable-supportsInterface}.
   *
   * @param _interfaceId bytes4
   */
  function supportsInterface(bytes4 _interfaceId)
    public
    view
    virtual
    override(ERC165Upgradeable, IERC165Upgradeable, AccessControlUpgradeable)
    returns (bool)
  {
    return
      _interfaceId == type(ITokenControlProxy).interfaceId ||
      super.supportsInterface(_interfaceId);
  }

  /**
   * See {ERC2771ContextUpgradeable._msgSender()}
   */
  function _msgSender()
    internal
    view
    virtual
    override(ContextUpgradeable, ERC2771ContextUpgradeable)
    returns (address sender)
  {
    return ERC2771ContextUpgradeable._msgSender();
  }

  /**
   * See {ERC2771ContextUpgradeable._msgData()}
   */
  function _msgData()
    internal
    view
    virtual
    override(ContextUpgradeable, ERC2771ContextUpgradeable)
    returns (bytes calldata)
  {
    return ERC2771ContextUpgradeable._msgData();
  }

  /**
   * @notice Safe transfer ERC20 token
   * @dev only registered operators could call this function(i.e. Exchange)
   *
   * @param _token IERC20 token address
   * @param _from address from
   * @param _to address to
   * @param _value uint256 value
   *
   * Requirements:
   *
   * - `onlyAdmin` can call
   */
  function erc20safeTransferFrom(
    IERC20 _token,
    address _from,
    address _to,
    uint256 _value
  ) external {
    require(
      hasRole(EXECUTOR_ROLE, _msgSender()),
      "TokenControlProxy: must have executor role to exec"
    );
    _token.transferFrom(_from, _to, _value);
  }

  /**
   * @notice Safe transfer ERC721 token
   * @dev only registered operators could call this function(i.e. Exchange)
   *
   * @param _token IERC721 token address
   * @param _from address current owner address
   * @param _to address new to be owner address
   * @param _tokenId uint256 token id to transfer
   *
   * Requirements:
   *
   * - `onlyAdmin` can call
   */
  function erc721safeTransferFrom(
    IERC721 _token,
    address _from,
    address _to,
    uint256 _tokenId
  ) external {
    require(
      hasRole(EXECUTOR_ROLE, _msgSender()),
      "TokenControlProxy: must have executor role to exec"
    );
    _token.safeTransferFrom(_from, _to, _tokenId);
  }

  /**
   * @notice Safe transfer ERC1155 token
   * @dev only registered operators could call this function(i.e. Exchange)
   *
   * @param _token IERC1155 token address
   * @param _from address current owner address
   * @param _to address new to be owner address
   * @param _tokenId uint256 token id to transfer
   * @param _value uint256 count of token to transfer
   * @param _data bytes extra data if needed
   *
   * Requirements:
   *
   * - `onlyAdmin` can call
   */
  function erc1155safeTransferFrom(
    IERC1155 _token,
    address _from,
    address _to,
    uint256 _tokenId,
    uint256 _value,
    bytes calldata _data
  ) external {
    require(
      hasRole(EXECUTOR_ROLE, _msgSender()),
      "TokenControlProxy: must have executor role to exec"
    );
    _token.safeTransferFrom(_from, _to, _tokenId, _value, _data);
  }
}
