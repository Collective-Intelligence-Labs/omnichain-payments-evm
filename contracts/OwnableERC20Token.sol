// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OwnableERC20Token is ERC20, Ownable {
    constructor() ERC20("OMNI", "OMNI") Ownable(msg.sender) {
        //_mint(msg.sender, initialSupply);
    }

    function transfer(address to, uint256 amount) public override onlyOwner returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public override onlyOwner returns (bool) {
        _transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) public override onlyOwner returns (bool) {
         _approve(msg.sender, spender, amount, true);
         return true;
    }
    
    function burn(address account, uint256 value) public onlyOwner {
        return super._burn(account, value);
    }

    function mint(address account, uint256 value) public onlyOwner {
        _mint(account, value);
    }
}
