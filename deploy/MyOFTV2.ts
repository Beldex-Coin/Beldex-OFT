import assert from 'assert'

import { type DeployFunction } from 'hardhat-deploy/types'

// The proxy is tracked under the same deployment name as V1 (`BELDEX`). Deploying
// the BELDEXV2 implementation against this name upgrades the existing proxy in place,
// preserving its address, balances, owner and paused state.
const deploymentName = 'BELDEX'
const implementationContract = 'BELDEXV2'

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre
    console.log(`Running ${deploymentName} deployment script for LayerZero OFT upgrade to V2...`)

    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')

    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)

    const endpointV2Deployment = await hre.deployments.get('EndpointV2')

    if (hre.network.config.oftAdapter != null) {
        console.warn(`oftAdapter configuration found on OFT deployment, skipping OFT upgrade`)
        return
    }

    // The mint authority is the only address allowed to call mint() on V2. Seeded
    // once via initializeV2 on upgrade. Override with MINT_AUTHORITY=0x... to hand
    // minting to a dedicated bridge/minter address instead of the deployer.
    const initialMintAuthority = process.env.MINT_AUTHORITY ?? deployer
    console.log(`Initial mint authority: ${initialMintAuthority}`)

    // Upgrades the existing BELDEX proxy to the BELDEXV2 implementation.
    //
    // hardhat-deploy deploys the new implementation and, because the proxy already
    // exists, performs `upgradeToAndCall(newImpl, initializeV2(initialMintAuthority))`
    // (execute.onUpgrade). `init` is kept so this script can also bootstrap a
    // brand-new proxy directly on V2 if V1 was never deployed on this network.
    const result = await deploy(deploymentName, {
        contract: implementationContract,
        from: deployer,
        args: [
            endpointV2Deployment.address, // LayerZero's EndpointV2 address (immutable, implementation constructor)
        ],
        log: true,
        skipIfAlreadyDeployed: false,
        proxy: {
            proxyContract: 'UUPS',
            execute: {
                init: {
                    methodName: 'initialize',
                    args: [
                        'BELDEX', // name
                        'BDX', // symbol
                        deployer, // delegate / owner
                    ],
                },
                onUpgrade: {
                    methodName: 'initializeV2',
                    args: [initialMintAuthority],
                },
            },
        },
    })

    // The proxy address (result.address) is UNCHANGED by the upgrade — only the
    // implementation behind it changes. result.implementation is the new BELDEXV2
    // logic contract (saved as `${deploymentName}_Implementation`).
    console.log(`Upgraded proxy: ${deploymentName} -> ${implementationContract}, network: ${hre.network.name}`)
    console.log(`Proxy address (unchanged):  ${result.address}`)
    console.log(`New implementation address: ${result.implementation}`)
}

// Only runs when its tag is explicitly selected (e.g. `--tags BELDEXV2`), so a plain
// `hardhat deploy` of V1 does not accidentally upgrade the proxy to V2.
deploy.tags = [implementationContract]
deploy.skip = async () => process.env.UPGRADE_TO_V2 !== 'true'

export default deploy
