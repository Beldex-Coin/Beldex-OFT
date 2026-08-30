// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OFTUpgradeable } from "@layerzerolabs/oft-evm-upgradeable/contracts/oft/OFTUpgradeable.sol";

/**
 * @title BELDEX V2
 * @notice UUPS upgrade of the BELDEX proxy that moves minting behind a dedicated
 *         mint authority address instead of the owner.
 * @dev Does NOT inherit BELDEX (contracts/MyOFT.sol). Instead it independently
 *      inherits the same base contracts as V1 (PausableUpgradeable, UUPSUpgradeable,
 *      OFTUpgradeable) and reimplements every V1 function directly. This keeps V1's
 *      source untouched — no `virtual` needed on V1's mint() — while still upgrading
 *      the same proxy safely.
 *
 *      Storage-safety: PausableUpgradeable and UUPSUpgradeable use OZ v5's ERC-7201
 *      namespaced storage (a fixed slot derived by hashing a unique identifier), not
 *      sequential slots assigned by declaration/inheritance order — so their relative
 *      order here does not affect layout, unlike pre-v5 `__gap`-based contracts.
 *      OFTUpgradeable is kept last, preserving its own (ERC20Upgradeable-based,
 *      sequential + `__gap`) storage chain exactly as it was in V1.
 *
 *      V1's own trailing storage was a fully-unused `uint256[50] private __gap`. V2
 *      repurposes the first of those reserved slots for `mintAuthority` and
 *      re-declares a `uint256[49]` gap afterwards, keeping the same total
 *      reserved-storage budget for future versions.
 *
 *      Verified with `npm run validate:v2` (OpenZeppelin upgrades-core storage
 *      layout comparison against BELDEX) — re-run this after any further changes.
 */
contract BELDEXV2 is PausableUpgradeable, UUPSUpgradeable, OFTUpgradeable {

    error DisabledRenounceOwnership();
    error NotMintAuthority(address caller);
    error ZeroAddress();

    /// @notice The only address permitted to call {mint}. Distinct from owner.
    address public mintAuthority;
    
    event Mint(address indexed to, uint256 value);
    event Burn(address indexed from, uint256 value);
    event MintAuthorityUpdated(address indexed previousAuthority, address indexed newAuthority);

    modifier onlyMintAuthority() {
        if (msg.sender != mintAuthority) revert NotMintAuthority(msg.sender);
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor state-variable-immutable
    constructor(address _lzEndpoint) OFTUpgradeable(_lzEndpoint) {
        _disableInitializers();
    }

    /// @notice Proxy initializer. Only runs if V2 is deployed on a network that
    ///         never had a V1 proxy (fresh deploy straight onto V2).
    function initialize(
        string memory _name,
        string memory _symbol,
        address _delegate
    ) external initializer {
        __OFT_init(_name, _symbol, _delegate);
        __Ownable_init(_delegate);
        __Pausable_init();
        __UUPSUpgradeable_init();
    }

    /// @notice Upgrade hook called once via `upgradeToAndCall` when migrating V1 -> V2.
    /// @dev Seeds the mint authority so minting doesn't get locked out immediately
    ///      after the upgrade. The reinitializer(2) guard ensures this runs only once.
    ///
    ///      SECURITY: `onlyOwner` is load-bearing, not decoration. `reinitializer(2)`
    ///      constrains *how many times* this runs, never *who* runs it, so without an
    ///      access-control modifier this function was callable by any address the moment
    ///      the V2 implementation was set behind the proxy. Whoever won that race became
    ///      `mintAuthority` and could then call {mint} for an unbounded amount — full
    ///      control of token supply, obtained by watching the mempool. The exposure was
    ///      not limited to a plain `upgradeTo` followed by a separate initialization
    ///      call: even the intended `upgradeToAndCall` path is a two-transaction sequence
    ///      from the operator's point of view (deploy the implementation, then upgrade),
    ///      and an attacker only needed to land between them.
    ///
    ///      With `onlyOwner`, a lost race is no longer a compromise: an attacker's call
    ///      reverts, and the single permitted invocation stays reserved for the owner
    ///      inside `upgradeToAndCall`, where `msg.sender` is preserved through the
    ///      delegatecall and is therefore still the owner.
    function initializeV2(address _initialMintAuthority) external reinitializer(2) onlyOwner {
        if (_initialMintAuthority == address(0)) revert ZeroAddress();
        mintAuthority = _initialMintAuthority;
        emit MintAuthorityUpdated(address(0), _initialMintAuthority);
    }

    function decimals() public pure override returns (uint8) {
        return 9;
    }

    function renounceOwnership() public pure override {
        revert DisabledRenounceOwnership();
    }

    /// @notice Pauses all token activity: mint, burn, transfers and bridging.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resumes all token activity.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @dev Marked virtual so future versions can override minting rules if they
    ///      choose to inherit BELDEXV2 directly.
    /// @notice Mints tokens. Restricted to {mintAuthority} instead of the owner.
    function mint(address _to, uint256 _value) external virtual onlyMintAuthority {
        _mint(_to, _value);
        emit Mint(_to, _value);
    }

    /// @notice Reassigns the mint authority. Owner-only.
    function setMintAuthority(address _newAuthority) external onlyOwner {
        if (_newAuthority == address(0)) revert ZeroAddress();
        address previous = mintAuthority;
        mintAuthority = _newAuthority;
        emit MintAuthorityUpdated(previous, _newAuthority);
    }

    function burn(uint256 _value) external {
        _burn(msg.sender, _value);
        emit Burn(msg.sender, _value);
    }

    /// @dev Single hook for every transfer, mint, and burn (including LayerZero
    ///      debit/credit). When paused, all token activity halts.
    ///      Marked virtual so future versions (e.g. V3) can layer extra checks.
    function _update(address from, address to, uint256 value) internal virtual override whenNotPaused {
        super._update(from, to, value);
    }

    /// @dev UUPS upgrade authorization — only the owner may upgrade the implementation.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @dev Reserved storage. One slot narrower than V1's gap since `mintAuthority`
    ///      now occupies the first slot that was previously part of V1's `__gap`.
    uint256[49] private __gapV2;
}
