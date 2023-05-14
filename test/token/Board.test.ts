/* eslint-disable node/no-missing-import */
import { ethers, network } from "hardhat";
import { utils } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Board, PJManager } from "../../typechain";

describe("Board", function () {
  let Deployer: SignerWithAddress;
  let SuperAdmin: SignerWithAddress;
  let NotMinter: SignerWithAddress;
  let NotBurner: SignerWithAddress;
  let address3: SignerWithAddress;
  let cPJManagerMock: PJManager;
  let cBoardMock: Board;

  const TokenExistsError = "ERC721Metadata: URI query for nonexistent token";
  const URIUpdaterError = "Board: must have URI updater role to update URI";
  const NotMinterRoleError = "Board: must have minter role to mint";
  const NotBurnerRoleError = "Board: must have burner role to burn";
  const BoardError = "Board: Err Token is Board";

  const name = "SugaiYuuka";
  const symbol = "SY";
  const baseURI = "https://sample.com/";

  const dummyContract = "0x00E9C198af8F6a8692d83d1702e691A03F2cdc63";
  const Adminhash =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  beforeEach(async function () {
    [Deployer, SuperAdmin, NotMinter, NotBurner, address3] =
      await ethers.getSigners();
    const cfPJManager = await ethers.getContractFactory("PJManager");
    cPJManagerMock = await cfPJManager.deploy(
      ethers.constants.AddressZero,
      SuperAdmin.address,
      10000,
      []
    );
    const cfBoard = await ethers.getContractFactory("Board");
    cBoardMock = await cfBoard.deploy(
      name,
      symbol,
      baseURI,
      cPJManagerMock.address,
      SuperAdmin.address,
      dummyContract
    );
  });

  describe("Post deployment checks", function () {
    it("name check", async function () {
      expect(await cBoardMock.name()).to.equal(name);
    });

    it("symbol check", async function () {
      expect(await cBoardMock.symbol()).to.equal(symbol);
    });

    it("Admin Role Check", async function () {
      expect(await cBoardMock.hasRole(Adminhash, SuperAdmin.address)).to.equal(
        true
      );
    });

    it("MINTER Role Check", async function () {
      const Minterhash = utils.keccak256(utils.toUtf8Bytes("MINTER_ROLE"));
      expect(await cBoardMock.hasRole(Minterhash, SuperAdmin.address)).to.equal(
        true
      );
    });

    it("BURNER Role Check", async function () {
      const Burnerhash = utils.keccak256(utils.toUtf8Bytes("BUNER_ROLE"));
      expect(await cBoardMock.hasRole(Burnerhash, SuperAdmin.address)).to.equal(
        true
      );
    });

    it("URI UPDATER Role Check", async function () {
      const URIupdaterhash = utils.keccak256(
        utils.toUtf8Bytes("URIUPDATER_ROLE")
      );
      expect(
        await cBoardMock.hasRole(URIupdaterhash, SuperAdmin.address)
      ).to.equal(true);
    });

    it("Trusted Forwarder Check", async function () {
      expect(await cBoardMock.isTrustedForwarder(dummyContract)).to.equal(true);
    });
  });

  describe("did", function () {
    it("[S] check DID schema", async function () {
      expect(await cBoardMock.didSchema()).to.equal("did:questry");
    });

    it("[S] check DID namespace", async function () {
      const chainId = network.config.chainId;
      const pjmanager = cPJManagerMock.address.toLowerCase();
      expect(await cBoardMock.didNamespace()).to.equal(
        `eip155:${chainId}:${pjmanager}`
      );
    });

    it("[S] check DID member", async function () {
      const chainId = network.config.chainId;
      const member = address3.address.toLowerCase();
      expect(await cBoardMock.didMember(address3.address)).to.equal(
        `eip155:${chainId}:${member}`
      );
    });

    it("[S] check DID", async function () {
      await cBoardMock.connect(SuperAdmin).mint(address3.address);
      const chainId = network.config.chainId;
      const pjmanager = cPJManagerMock.address.toLowerCase();
      const member = address3.address.toLowerCase();
      const expected = `did:questry:eip155:${chainId}:${pjmanager}:eip155:${chainId}:${member}:1`;
      expect(await cBoardMock.did(1)).to.equal(expected);
    });

    it("[R] can not resolve DID before mint", async function () {
      await expect(cBoardMock.did(1)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
    });
  });

  describe("tokenURI", function () {
    it("[R] err check tokenURI", async function () {
      await expect(cBoardMock.tokenURI(1)).to.be.revertedWith(TokenExistsError);
    });

    it("[S] check tokenURI for baseURI", async function () {
      await cBoardMock.connect(SuperAdmin).mint(address3.address);
      const chainId = network.config.chainId;
      const pjmanager = cPJManagerMock.address.toLowerCase();
      const member = address3.address.toLowerCase();
      const did = `did:questry:eip155:${chainId}:${pjmanager}:eip155:${chainId}:${member}:1`;
      expect(await cBoardMock.tokenURI(1)).to.equal(`${baseURI}${did}`);
    });

    it("[R] err check updateBaseTokenURI", async function () {
      await expect(
        cBoardMock.connect(address3).updateBaseTokenURI(baseURI)
      ).to.be.revertedWith(URIUpdaterError);
    });
  });

  describe("mint test", function () {
    it("[S] mint check", async function () {
      expect(await cBoardMock.boardingMembersExist()).to.be.false;

      await cBoardMock.connect(SuperAdmin).mint(address3.address);

      expect(await cBoardMock.balanceOf(address3.address)).to.equal(1);
      expect(await cBoardMock.ownerOf(1)).to.equal(address3.address);
      expect(await cBoardMock.boardingMembersExist()).to.be.true;
      expect(await cBoardMock.getBoardingMembers()).deep.equal([
        address3.address,
      ]);
      expect(await cBoardMock.getIsBoardingMember(address3.address)).to.be.true;
      expect(
        await cPJManagerMock.resolveBoardId(cBoardMock.address, 1)
      ).to.equal(1);
    });

    it("[S] check adding new members sequencially", async function () {
      await cBoardMock.connect(SuperAdmin).mint(NotMinter.address);
      expect(await cBoardMock.boardingMembersExist()).to.be.true;
      expect(await cBoardMock.getBoardingMembers()).deep.equal([
        NotMinter.address,
      ]);
      await cBoardMock.connect(SuperAdmin).mint(NotBurner.address);
      expect(await cBoardMock.boardingMembersExist()).to.be.true;
      expect(await cBoardMock.getBoardingMembers()).deep.equal([
        NotMinter.address,
        NotBurner.address,
      ]);
    });

    it("[S] can mint multiple Boards to the same member", async function () {
      await cBoardMock.connect(SuperAdmin).mint(NotMinter.address);
      expect(await cBoardMock.boardingMembersExist()).to.be.true;
      expect(await cBoardMock.getBoardingMembers()).deep.equal([
        NotMinter.address,
      ]);
      await cBoardMock.connect(SuperAdmin).mint(NotMinter.address);
      expect(await cBoardMock.boardingMembersExist()).to.be.true;
      expect(await cBoardMock.getBoardingMembers()).deep.equal([
        NotMinter.address,
      ]);
      expect(await cBoardMock.balanceOf(NotMinter.address)).equals(2);
    });

    it("[S] bulkMint check", async function () {
      const recipients = [
        NotMinter.address,
        NotBurner.address,
        address3.address,
      ];

      await cBoardMock.connect(SuperAdmin).bulkMint(recipients);
      // check Not Minter address recipient
      expect(await cBoardMock.balanceOf(NotMinter.address)).to.equal(1);
      expect(await cBoardMock.ownerOf(1)).to.equal(NotMinter.address);
      expect(await cBoardMock.getIsBoardingMember(NotMinter.address)).to.be
        .true;
      // check Not Burner address recipient
      expect(await cBoardMock.balanceOf(NotBurner.address)).to.equal(1);
      expect(await cBoardMock.ownerOf(2)).to.equal(NotBurner.address);
      expect(await cBoardMock.getIsBoardingMember(NotBurner.address)).to.be
        .true;
      // check address3 address recipient
      expect(await cBoardMock.balanceOf(address3.address)).to.equal(1);
      expect(await cBoardMock.ownerOf(3)).to.equal(address3.address);
      expect(await cBoardMock.getIsBoardingMember(address3.address)).to.be.true;

      expect(await cBoardMock.boardingMembersExist()).to.be.true;
      expect(await cBoardMock.getBoardingMembers()).deep.equal(recipients);
    });

    it("[R] can not mint by NotMinter not have role", async function () {
      await expect(
        cBoardMock.connect(NotMinter).mint(address3.address)
      ).to.be.revertedWith(NotMinterRoleError);
    });

    it("[R] can not bulkMint by NotMinter not have role", async function () {
      const recipents = [
        NotMinter.address,
        NotBurner.address,
        address3.address,
      ];
      await expect(
        cBoardMock.connect(NotMinter).bulkMint(recipents)
      ).to.be.revertedWith(NotMinterRoleError);
    });
  });

  describe("burn", function () {
    it("[S] burn check", async function () {
      await cBoardMock.connect(SuperAdmin).mint(address3.address);
      await cBoardMock.connect(SuperAdmin).burn(1);
      expect(await cBoardMock.balanceOf(address3.address)).to.equal(0);
      await expect(cBoardMock.ownerOf(1)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      expect(await cBoardMock.getIsBoardingMember(address3.address)).to.be
        .false;
      expect(await cBoardMock.boardingMembersExist()).to.be.false;
      expect(await cBoardMock.getBoardingMembers()).deep.equal([]);
    });

    it("[S] check removing the members correctly", async function () {
      await cBoardMock.connect(SuperAdmin).mint(address3.address);
      await cBoardMock.connect(SuperAdmin).mint(NotMinter.address);

      await cBoardMock.connect(SuperAdmin).burn(1);
      expect(await cBoardMock.boardingMembersExist()).to.be.true;
      expect(await cBoardMock.getBoardingMembers()).deep.equal([
        NotMinter.address,
      ]);

      await cBoardMock.connect(SuperAdmin).burn(2);
      expect(await cBoardMock.boardingMembersExist()).to.be.false;
      expect(await cBoardMock.getBoardingMembers()).deep.equal([]);
    });

    it("[S] bulkBurn check", async function () {
      const recipents = [
        NotMinter.address,
        NotBurner.address,
        address3.address,
      ];
      await cBoardMock.connect(SuperAdmin).bulkMint(recipents);

      const tokenIDs = [1, 2, 3];
      await cBoardMock.connect(SuperAdmin).bulkBurn(tokenIDs);
      // check Not Minter address recipent
      expect(await cBoardMock.balanceOf(NotMinter.address)).to.equal(0);
      await expect(cBoardMock.ownerOf(1)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      expect(await cBoardMock.getIsBoardingMember(NotMinter.address)).to.be
        .false;
      // check Not Burner address recipient
      expect(await cBoardMock.balanceOf(NotBurner.address)).to.equal(0);
      await expect(cBoardMock.ownerOf(2)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      expect(await cBoardMock.getIsBoardingMember(NotBurner.address)).to.be
        .false;
      // check address3 address recipient
      expect(await cBoardMock.balanceOf(address3.address)).to.equal(0);
      await expect(cBoardMock.ownerOf(3)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      expect(await cBoardMock.getIsBoardingMember(address3.address)).to.be
        .false;
      expect(await cBoardMock.boardingMembersExist()).to.be.false;
      expect(await cBoardMock.getBoardingMembers()).deep.equal([]);
    });

    it("[R] NotBurner Err check", async function () {
      await cBoardMock.connect(SuperAdmin).mint(address3.address);
      await expect(cBoardMock.connect(NotBurner).burn(1)).to.be.revertedWith(
        NotBurnerRoleError
      );
    });
  });

  describe("Board Test", function () {
    it("[R] Board transferFrom err", async function () {
      await cBoardMock.connect(SuperAdmin).mint(NotMinter.address);
      await expect(
        cBoardMock
          .connect(NotMinter)
          .transferFrom(NotMinter.address, NotBurner.address, 1)
      ).to.be.revertedWith(BoardError);
    });

    it("[R] Board safeTransferFrom err", async function () {
      await cBoardMock.connect(SuperAdmin).mint(NotMinter.address);
      await expect(
        cBoardMock
          .connect(NotMinter)
          ["safeTransferFrom(address,address,uint256)"](
            NotMinter.address,
            NotBurner.address,
            1
          )
      ).to.be.revertedWith(BoardError);
      await expect(
        cBoardMock
          .connect(NotMinter)
          ["safeTransferFrom(address,address,uint256,bytes)"](
            NotMinter.address,
            NotBurner.address,
            1,
            []
          )
      ).to.be.revertedWith(BoardError);
    });

    it("[R] Board approve err", async function () {
      await cBoardMock.connect(SuperAdmin).mint(NotMinter.address);
      await expect(
        cBoardMock.connect(NotMinter).approve(dummyContract, 1)
      ).to.be.revertedWith(BoardError);
    });

    it("[R] Board setApprovalForAll err", async function () {
      await cBoardMock.connect(SuperAdmin).mint(NotMinter.address);
      await expect(
        cBoardMock.connect(NotMinter).setApprovalForAll(dummyContract, true)
      ).to.be.revertedWith(BoardError);
    });
  });
});
