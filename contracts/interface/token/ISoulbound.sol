// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/interfaces/IERC165Upgradeable.sol";

/**
 * @title  SBINFT market non-native asset transfer protocol
 */
interface ISoulbaundToken is IERC165Upgradeable {
    

    /** event などを定義 */

    function updateBaseTokenURI(string memory _uri) external;

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
    function mint(address to) public;

    function Bulkmint(address[] calldata tos) public;

    function burn(uint256 tokenId) public;

    function Bulkburn(uint256[] calldata tokenIds) public;

}