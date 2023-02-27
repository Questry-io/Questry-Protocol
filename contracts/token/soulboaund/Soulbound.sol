// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

//こちらのコントラクトを改造してプロトコルのコントラクトにしていく


import { ERC721, IERC721, Context } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ERC2771Context } from "@openzeppelin/contracts/metatx/ERC2771Context.sol";


contract SBT is 
    ERC721,
    AccessControl,
    ERC2771Context
{
    using Counters for Counters.Counter;
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant URIUPDATER_ROLE = keccak256("URIUPDATER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BUNER_ROLE");

    Counters.Counter private _tokenIdTracker;

    string public _baseTokenURI;

    bool public isTransfable = false;
    /**
     * @dev Grants `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE` and `PAUSER_ROLE` to the
     * account that deploys the contract.
     *
     * Token URIs will be autogenerated based on `baseURI` and their token IDs.
     * See {ERC721-tokenURI}.
     */
    constructor(
        string memory name,
        string memory symbol,
        string memory defaultURI,
        address admin,
        address Trustedforwarder
    ) ERC721(name, symbol) 
      ERC2771Context(Trustedforwarder)
    {
        _DefaultURI = defaultURI;
        _tokenIdTracker.increment();

        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(MINTER_ROLE, admin);
        _setupRole(URIUPDATER_ROLE, admin);
        _setupRole(BURNER_ROLE, admin);
    }

    function tokenURI(uint256 tokenId) public view virtual override(ERC721) returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        return string(abi.encodePacked(_baseURI(), tokenId.toString(), ".json"));
    }

    function _baseURI() internal view virtual override(ERC721) returns (string memory) {
        return _baseTokenURI;
    }

    function updateBaseTokenURI(string memory _uri) external {
        require(hasRole(URIUPDATER_ROLE, _msgSender()), "SBT: must have URI updater role to update URI");
        _baseTokenURI = _uri;
    }

    function updateDefaultURI(string memory _uri) external {
        require(hasRole(URIUPDATER_ROLE, _msgSender()), "SBT: must have URI updater role to update URI");
        _DefaultURI = _uri;
    }

    /**
     * @dev Creates a new token for `to`. Its token ID will be automatically
     * assigned (and available on the emitted {IERC721-Transfer} event), and the token
     * URI autogenerated based on the base URI passed at construction.
     *
     * See {ERC721-_mint}.
     *
     * Requirements:
     *
     * - the caller must have the `MINTER_ROLE`.
     */
    function mint(address to) public {
        require(hasRole(MINTER_ROLE, _msgSender()), "SBT: must have minter role to mint");

        _mint(to, _tokenIdTracker.current());
        _tokenIdTracker.increment();
    }

    function Bulkmint(address[] calldata tos) public {
        for(uint i =0;i < tos.length;i++){
            mint(tos[i]);
        }
    }

    function burn(uint256 tokenId) public {
        require(hasRole(BURNER_ROLE, _msgSender()),"SBT: must have burner role to burn");
        _burn(tokenId);
    }

    function Bulkburn(uint256[] calldata tokenIds) public {
        for(uint i =0;i < tokenIds.length;i++){
            burn(tokenIds[i]);
        }
    }

    function _transfer(address from, address to, uint256 tokenId) internal virtual override {
        require(isTransfable,'SBT: Err Token is SBT');
        super._transfer(from,to,tokenId);
    }

    function _setApprovalForAll(address owner, address operator, bool approved) internal virtual override {
        require(isTransfable,'SBT: Err Token is SBT');
        super._setApprovalForAll(owner,operator,approved);
    }

    function _approve(address to, uint256 tokenId) internal virtual override {
        require(isTransfable || to == address(0),'SBT: Err Token is SBT');
        super._approve(to,tokenId);
    }

    function _msgData()
        internal
        view
        override(ERC2771Context,Context)
        returns (bytes calldata)
    {
        return ERC2771Context._msgData();
    }

    function _msgSender()
        internal
        view
        override(ERC2771Context,Context)
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
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControl, ERC721)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}