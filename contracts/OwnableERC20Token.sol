// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OwnableERC20Token is ERC20, Ownable {
    constructor(string memory name, string memory symbol, uint256 initialSupply) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    function transfer(address to, uint256 amount) public override onlyOwner returns (bool) {
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override onlyOwner returns (bool) {
        return super.transferFrom(from, to, amount);
    }

    function approve(address spender, uint256 amount) public override onlyOwner returns (bool) {
        return super.approve(spender, amount);
    }
    
    function burn(address account, uint256 value) public onlyOwner {
        return super._burn(account, value);
    }

    function mint(address account, uint256 value) public onlyOwner {
        _mint(account, value);
    }
}
