
const { ethers, upgrades } = require("hardhat");

async function main() {
    const proxyAddress = "0xb89734D0D1FEde49d2aed37cdAC90808C0F11635";

    console.log(upgrades);

    const BELDEXV2 = await ethers.getContractFactory("BELDEXV2");

    await upgrades.validateUpgrade(
        proxyAddress,
        BELDEXV2
    );

    console.log("✅ Upgrade is storage compatible");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});