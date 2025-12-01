// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import { OFT } from "@layerzerolabs/oft-evm/contracts/OFT.sol";

contract BELDEX is OFT, Pausable {

    error DisabledRenounceOwnership();
        
    event Mint(address indexed to, uint256 value);
    event Burn(address indexed from, uint256 value);

    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate
    ) OFT(_name, _symbol, _lzEndpoint, _delegate) Ownable(_delegate) {
        // Uncomment the line below to mint test tokens on deployment (for testnet only)
        // _mint(msg.sender, 100000 * (10 ** 18));
    }

    function decimals() public pure override returns (uint8) {
        return 9;
    }

    function renounceOwnership() public pure override {
        revert DisabledRenounceOwnership();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function mint(address _to, uint256 _value) external whenNotPaused onlyOwner {
        _mint(_to, _value);
        emit Mint(_to, _value);
    }

    function burn(uint256 _value) external whenNotPaused {
        _burn(msg.sender, _value);
        emit Burn(msg.sender, _value);
    }
}
