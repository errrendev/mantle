// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonToken} from "../src/TycoonToken.sol";
import {TycoonRewardSystem, Tycoon} from "../src/Tycoon.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployTycoon
 * @notice Deploys all Tycoon contracts to Monad testnet
 * 
 * Deployment order:
 * 1. TYC Token (ERC20)
 * 2. USDC Token (ERC20) - mock for testing
 * 3. Reward System (ERC1155)
 * 4. Tycoon Contract (main game)
 */
contract DeployTycoon is Script {
    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("==============================================");
        console.log("Deploying Tycoon Contracts to Monad Testnet");
        console.log("==============================================");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy TYC Token
        console.log("1. Deploying TYC Token...");
        TycoonToken tycToken = new TycoonToken(deployer);
        console.log("   TYC Token deployed at:", address(tycToken));
        console.log("   Name:", tycToken.name());
        console.log("   Symbol:", tycToken.symbol());
        console.log("");

        // 2. Deploy USDC Token (mock for testing)
        console.log("2. Deploying USDC Token (mock)...");
        TycoonToken usdcToken = new TycoonToken(deployer);
        console.log("   USDC Token deployed at:", address(usdcToken));
        console.log("");

        // 3. Deploy Reward System
        console.log("3. Deploying Reward System...");
        TycoonRewardSystem rewardSystem = new TycoonRewardSystem(
            address(tycToken),
            address(usdcToken),
            deployer
        );
        console.log("   Reward System deployed at:", address(rewardSystem));
        console.log("");

        // 4. Deploy Tycoon Contract
        console.log("4. Deploying Tycoon Contract...");
        Tycoon tycoon = new Tycoon(deployer, address(rewardSystem));
        console.log("   Tycoon Contract deployed at:", address(tycoon));
        console.log("");

        // 5. Set backend minter on reward system
        console.log("5. Configuring Reward System...");
        rewardSystem.setBackendMinter(address(tycoon));
        console.log("   Backend minter set to Tycoon contract");
        console.log("");

        // 6. Mint initial TYC tokens to deployer for testing
        console.log("6. Minting initial TYC tokens...");
        uint256 initialMint = 1000000 * 10**18; // 1 million TYC
        tycToken.mint(deployer, initialMint);
        console.log("   Minted 1,000,000 TYC to deployer");
        console.log("");

        vm.stopBroadcast();

        // Print summary
        console.log("==============================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("==============================================");
        console.log("");
        console.log("Contract Addresses:");
        console.log("-------------------");
        console.log("TYC_TOKEN_ADDRESS=", address(tycToken));
        console.log("USDC_TOKEN_ADDRESS=", address(usdcToken));
        console.log("REWARD_CONTRACT_ADDRESS=", address(rewardSystem));
        console.log("TYCOON_CONTRACT_ADDRESS=", address(tycoon));
        console.log("");
        console.log("Copy these addresses to your backend/.env file");
        console.log("==============================================");
    }
}
