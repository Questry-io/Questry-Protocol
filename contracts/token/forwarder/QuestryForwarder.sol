// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";

contract QuestryForwarder is
  Initializable,
  PausableUpgradeable,
  AccessControlUpgradeable,
  UUPSUpgradeable,
  EIP712Upgradeable
{
  using ECDSAUpgradeable for bytes32;
  bytes32 private constant _TYPEHASH =
    keccak256(
      "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
    );
  bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

  struct ForwardRequest {
    address from;
    address to;
    uint256 value;
    uint256 gas;
    uint256 nonce;
    bytes data;
  }

  mapping(address => uint256) private _nonces;

  event Deposit(address indexed sender, uint256 value);
  event Withdraw(address indexed sender, uint256 value);

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {}

  function initialize(address _admin, address _executor) public initializer {
    __Pausable_init();
    __AccessControl_init();
    __UUPSUpgradeable_init();
    __EIP712_init("QuestryForwarder", "0.0.1");

    _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    _grantRole(EXECUTOR_ROLE, _executor);
  }

  function deposit() public payable onlyRole(EXECUTOR_ROLE) {
    require(
      msg.value > 0,
      "QuestryForwarder: deposit value must be greater than 0"
    );
    emit Deposit(msg.sender, msg.value);
  }

  function withdraw(address _executor, uint256 _amount)
    public
    onlyRole(EXECUTOR_ROLE)
  {
    require(
      _amount > 0,
      "QuestryForwarder: withdraw value must be greater than 0"
    );
    require(
      _amount <= address(this).balance,
      "QuestryForwarder: withdraw value must be less than balance"
    );
    payable(_executor).transfer(_amount);
    emit Withdraw(_executor, _amount);
  }

  function getNonce(address from) public view returns (uint256) {
    return _nonces[from];
  }

  function verify(ForwardRequest calldata req, bytes calldata signature)
    public
    view
    returns (bool)
  {
    address signer = _hashTypedDataV4(
      keccak256(
        abi.encode(
          _TYPEHASH,
          req.from,
          req.to,
          req.value,
          req.gas,
          req.nonce,
          keccak256(req.data)
        )
      )
    ).recover(signature);
    return _nonces[req.from] == req.nonce && signer == req.from;
  }

  function execute(ForwardRequest calldata req, bytes calldata signature)
    public
    payable
    onlyRole(EXECUTOR_ROLE)
    whenNotPaused
    returns (bool, bytes memory)
  {
    require(
      verify(req, signature),
      "MinimalForwarder: signature does not match request"
    );
    uint256 startGas = gasleft();
    _nonces[req.from] = req.nonce + 1;

    (bool success, bytes memory returndata) = req.to.call{
      gas: req.gas,
      value: req.value
    }(abi.encodePacked(req.data, req.from));

    // Validate that the relayer has sent enough gas for the call.
    // See https://ronan.eth.limo/blog/ethereum-gas-dangers/
    if (gasleft() <= req.gas / 63) {
      // We explicitly trigger invalid opcode to consume all gas and bubble-up the effects, since
      // neither revert or assert consume all gas since Solidity 0.8.0
      // https://docs.soliditylang.org/en/v0.8.0/control-structures.html#panic-via-assert-and-error-via-require
      /// @solidity memory-safe-assembly
      assembly {
        invalid()
      }
    }

    if (!success) {
      revert("QuestryForwarder: execute reverted");
    }

    uint256 gasUsed = startGas - gasleft();
    uint256 gasPrice = tx.gasprice;
    uint256 refundAmount = gasUsed * gasPrice;

    withdraw(msg.sender, refundAmount);

    return (success, returndata);
  }

  function addExecutor(address executor) public onlyRole(DEFAULT_ADMIN_ROLE) {
    _grantRole(EXECUTOR_ROLE, executor);
  }

  function removeExecutor(address executor)
    public
    onlyRole(DEFAULT_ADMIN_ROLE)
  {
    _revokeRole(EXECUTOR_ROLE, executor);
  }

  function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
  }

  function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
  }

  function _authorizeUpgrade(address newImplementation)
    internal
    override
    onlyRole(DEFAULT_ADMIN_ROLE)
  {}
}
