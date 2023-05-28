// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {ERC721, IERC721, Context} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {IBoard} from "../../interface/token/IBoard.sol";
import {IPJManager} from "../../interface/pjmanager/IPJManager.sol";
import {IContributionPool} from "../../interface/pjmanager/IContributionPool.sol";

contract Board is IBoard, ERC721, AccessControl, ERC2771Context {
  using Counters for Counters.Counter;
  using Strings for uint256;

  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
  bytes32 public constant URIUPDATER_ROLE = keccak256("URIUPDATER_ROLE");
  bytes32 public constant BURNER_ROLE = keccak256("BUNER_ROLE");
  bytes32 public constant CONTRIBUTION_POOL_ROLE =
    keccak256("CONTRIBUTION_POOL_ROLE");

  bool public isTransfable = false;
  IPJManager public immutable pjManager;
  IContributionPool[] private contributionPools;
  string private baseTokenURI;
  address[] private boardingMembers;
  mapping(address => bool) private isBoardingMember;
  Counters.Counter private tokenIdTracker;

  /**
   * @dev Grants `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`, `URIUPDATETR_ROLE` and
   * `BURNER_ROLE` to the account that deploys the contract.
   *
   * Token URIs will be autogenerated based on `baseURI` and their token IDs.
   * See {ERC721-tokenURI}.
   */
  constructor(
    string memory _name,
    string memory _symbol,
    string memory _baseTokenURI,
    IPJManager _pjManager,
    IContributionPool[] memory _contributionPools,
    address _admin,
    address _trustedForwarder
  ) ERC721(_name, _symbol) ERC2771Context(_trustedForwarder) {
    baseTokenURI = _baseTokenURI;
    pjManager = _pjManager;
    tokenIdTracker.increment();
    for (uint256 i = 0; i < _contributionPools.length; i++) {
      contributionPools.push(_contributionPools[i]);
    }

    _setupRole(DEFAULT_ADMIN_ROLE, _admin);
    _setupRole(MINTER_ROLE, _admin);
    _setupRole(URIUPDATER_ROLE, _admin);
    _setupRole(BURNER_ROLE, _admin);
    _setupRole(CONTRIBUTION_POOL_ROLE, _admin);
  }

  /**
   * @dev Resolve metadata from Questry Protocol DID for the board which tokenId is `tokenId`.
   * Example: https://example.questry.io/did:questry:
   * DID spec: https://github.com/KanameProtocol/did-kaname-spec
   * See {IERC721Metadata-tokenURI}
   */
  function tokenURI(uint256 _tokenId)
    public
    view
    virtual
    override(ERC721)
    returns (string memory)
  {
    require(
      _exists(_tokenId),
      "ERC721Metadata: URI query for nonexistent token"
    );
    return string(abi.encodePacked(_baseURI(), did(_tokenId)));
  }

  /**
   * @dev Return the baseTokenURI.
   * See {ERC721-_baseURI}.
   */
  function _baseURI()
    internal
    view
    virtual
    override(ERC721)
    returns (string memory)
  {
    return baseTokenURI;
  }

  /**
   * @dev Update baseTokenURI to `_uri`.
   */
  function updateBaseTokenURI(string memory _uri) external {
    require(
      hasRole(URIUPDATER_ROLE, _msgSender()),
      "Board: must have URI updater role to update URI"
    );
    baseTokenURI = _uri;
  }

  /**
   * @dev Resolve Questry Protocol DID from the board which tokenId is `tokenId`.
   */
  function did(uint256 _tokenId) public view returns (string memory) {
    address member = ownerOf(_tokenId);
    string memory boardId = pjManager
      .resolveBoardId(address(this), _tokenId)
      .toString();
    return
      string(
        abi.encodePacked(
          didSchema(),
          ":",
          didNamespace(),
          ":",
          didMember(member),
          ":",
          boardId
        )
      );
  }

  /**
   * @dev Returns Questry Protocol DID spec's schema.
   */
  function didSchema() public pure returns (string memory) {
    return "did:questry";
  }

  /**
   * @dev Returns Questry Protocol DID spec's namespace corresponding to the boards.
   */
  function didNamespace() public view returns (string memory) {
    string memory chainId = block.chainid.toString();
    string memory hexPJManager = Strings.toHexString(
      uint160(address(pjManager)),
      20
    );
    return string(abi.encodePacked("eip155:", chainId, ":", hexPJManager));
  }

  /**
   * @dev Returns Questry Protocol DID spec's member.
   */
  function didMember(address _member) public view returns (string memory) {
    string memory chainId = block.chainid.toString();
    string memory hexMember = Strings.toHexString(uint160(_member), 20);
    return string(abi.encodePacked("eip155:", chainId, ":", hexMember));
  }

  /// @inheritdoc IBoard
  function mint(address _to) public {
    require(
      hasRole(MINTER_ROLE, _msgSender()),
      "Board: must have minter role to mint"
    );

    if (!isBoardingMember[_to]) {
      boardingMembers.push(_to);
      isBoardingMember[_to] = true;
    }

    uint256 tokenId = tokenIdTracker.current();
    _mint(_to, tokenId);
    tokenIdTracker.increment();

    IPJManager(pjManager).assignBoardId(address(this), tokenId);
  }

  /// @inheritdoc IBoard
  function bulkMint(address[] calldata _tos) public {
    for (uint256 i = 0; i < _tos.length; i++) {
      mint(_tos[i]);
    }
  }

  /// @inheritdoc IBoard
  function burn(uint256 _tokenId) public {
    require(
      hasRole(BURNER_ROLE, _msgSender()),
      "Board: must have burner role to burn"
    );

    address owner = ownerOf(_tokenId);
    if (balanceOf(owner) == 1) {
      isBoardingMember[owner] = false;
      // XXX: too much gas cost especially when tokens bulk burned
      uint256 newIdx = 0;
      for (uint256 i = 0; i < boardingMembers.length; i++) {
        if (boardingMembers[i] != owner) {
          boardingMembers[newIdx++] = boardingMembers[i];
        }
      }
      require(
        newIdx + 1 == boardingMembers.length,
        "Board: cannot remove boarding member"
      );
      boardingMembers.pop();
    }

    _burn(_tokenId);
  }

  /// @inheritdoc IBoard
  function bulkBurn(uint256[] calldata _tokenIds) public {
    for (uint256 i = 0; i < _tokenIds.length; i++) {
      burn(_tokenIds[i]);
    }
  }

  /**
   * @dev Add contribution pool `_pool` to the board.
   */
  function addContributionPool(IContributionPool _pool) external {
    require(
      hasRole(CONTRIBUTION_POOL_ROLE, _msgSender()),
      "Board: must have contribution pool role to add pool"
    );
    contributionPools.push(_pool);
  }

  /// @inheritdoc IBoard
  function getBoardingMembers() external view returns (address[] memory) {
    return boardingMembers;
  }

  /// @inheritdoc IBoard
  function boardingMembersExist() external view returns (bool) {
    return boardingMembers.length > 0;
  }

  /**
   * @dev Returns if `_account` has the token, in other words, it is a boarding member.
   * Note that only one token can be minted from the same Board contract per account.
   */
  function getIsBoardingMember(address _account) external view returns (bool) {
    return isBoardingMember[_account];
  }

  /**
   * @dev Returns contribution pool addresses associated with the board.
   */
  function getContributionPools()
    external
    view
    returns (IContributionPool[] memory)
  {
    return contributionPools;
  }

  /// @dev Overridden for Board
  function _transfer(
    address _from,
    address _to,
    uint256 _tokenId
  ) internal virtual override {
    require(isTransfable, "Board: Err Token is Board");
    super._transfer(_from, _to, _tokenId);
  }

  /// @dev Overridden for Board
  function _setApprovalForAll(
    address _owner,
    address _operator,
    bool _approved
  ) internal virtual override {
    require(isTransfable, "Board: Err Token is Board");
    super._setApprovalForAll(_owner, _operator, _approved);
  }

  /// @dev Overridden for Board
  function _approve(address _to, uint256 _tokenId) internal virtual override {
    require(isTransfable || _to == address(0), "Board: Err Token is Board");
    super._approve(_to, _tokenId);
  }

  /**
   * @dev See {ERC2771Context-_msgData}
   */
  function _msgData()
    internal
    view
    override(ERC2771Context, Context)
    returns (bytes calldata)
  {
    return ERC2771Context._msgData();
  }

  /**
   * @dev See {ERC2771Context-_msgSender}
   */
  function _msgSender()
    internal
    view
    override(ERC2771Context, Context)
    returns (address sender)
  {
    return ERC2771Context._msgSender();
  }

  /**
   * @dev See {IERC165-supportsInterface}.
   *
   * - Contracts can inherit from multiple parent contracts.
   *   When a function is called that is defined multiple times in
   *   different contracts, parent contracts are searched from
   *   right to left, and in depth-first manner.
   *
   * - BasicERC721.supportsInterface() returns ERC721.supportsInterface();
   */
  function supportsInterface(bytes4 _interfaceId)
    public
    view
    virtual
    override(AccessControl, ERC721)
    returns (bool)
  {
    return super.supportsInterface(_interfaceId);
  }
}
