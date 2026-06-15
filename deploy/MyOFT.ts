import assert from 'assert'

import { type DeployFunction } from 'hardhat-deploy/types'

const contractName = 'BELDEX'

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre

    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')

    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)

    // This is an external deployment pulled in from @layerzerolabs/lz-evm-sdk-v2
    //
    // @layerzerolabs/toolbox-hardhat takes care of plugging in the external deployments
    // from @layerzerolabs packages based on the configuration in your hardhat config
    //
    // For this to work correctly, your network config must define an eid property
    // set to `EndpointId` as defined in @layerzerolabs/lz-definitions
    //
    // For example:
    //
    // networks: {
    //   fuji: {
    //     ...
    //     eid: EndpointId.AVALANCHE_V2_TESTNET
    //   }
    // }
    const endpointV2Deployment = await hre.deployments.get('EndpointV2')

    // If the oftAdapter configuration is defined on a network that is deploying an OFT,
    // the deployment will log a warning and skip the deployment
    if (hre.network.config.oftAdapter != null) {
        console.warn(`oftAdapter configuration found on OFT deployment, skipping OFT deployment`)
        return
    }

    // BELDEX (V1) is a UUPS-upgradeable OFT. hardhat-deploy deploys the implementation
    // (constructor takes only the immutable LZ endpoint) behind an ERC1967 proxy and
    // calls `initialize` through it. The proxy is tracked under the deployment name
    // `BELDEX`, so LayerZero wiring (peers, config) targets the proxy address.
    //
    // To upgrade this proxy to V2, run the separate deploy/MyOFTV2.ts script.
    const result = await deploy(contractName, {
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
            },
        },
    })

    // result.address       -> the proxy (the contract everyone interacts with)
    // result.implementation -> the actual BELDEX logic contract (saved as `${contractName}_Implementation`)
    console.log(`Proxy address:          ${result.address}`)
    console.log(`Implementation address: ${result.implementation}`)
}

deploy.tags = [contractName]

export default deploy
