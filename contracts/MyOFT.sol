// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OFTUpgradeable } from "@layerzerolabs/oft-evm-upgradeable/contracts/oft/OFTUpgradeable.sol";

contract BELDEX is PausableUpgradeable, UUPSUpgradeable, OFTUpgradeable {

    error DisabledRenounceOwnership();

    event Mint(address indexed to, uint256 value);
    event Burn(address indexed from, uint256 value);

    /// @custom:oz-upgrades-unsafe-allow constructor state-variable-immutable
    constructor(address _lzEndpoint) OFTUpgradeable(_lzEndpoint) {
        _disableInitializers();
    }

    /// @notice Proxy initializer. Replaces the constructor for upgradeable deploys.
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

    function mint(address _to, uint256 _value) external onlyOwner {
        _mint(_to, _value);
        emit Mint(_to, _value);
    }

    function burn(uint256 _value) external {
        _burn(msg.sender, _value);
        emit Burn(msg.sender, _value);
    }

    /// @dev Single hook for every transfer, mint, and burn (including LayerZero
    ///      debit/credit). When paused, all token activity halts.
    ///      Marked virtual so future versions (e.g. V2) can layer extra checks.
    function _update(address from, address to, uint256 value) internal virtual override whenNotPaused {
        super._update(from, to, value);
    }

    /// @dev UUPS upgrade authorization — only the owner may upgrade the implementation.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @dev Reserved storage to allow future variable additions without shifting
    ///      the layout of inheriting/upgraded versions.
    uint256[50] private __gap;
}
