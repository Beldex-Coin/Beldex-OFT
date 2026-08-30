// Get the environment configuration from .env file
//
// To make use of automatic environment setup:
// - Duplicate .env.example file and name it .env
// - Fill in the environment variables
import 'dotenv/config'

import 'hardhat-deploy'
import 'hardhat-contract-sizer'
import '@nomiclabs/hardhat-ethers'
import '@layerzerolabs/toolbox-hardhat'
import "@nomicfoundation/hardhat-verify";

import { HardhatUserConfig, HttpNetworkAccountsUserConfig } from 'hardhat/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'

import './type-extensions'
import './tasks/sendOFT'

// Set your preferred authentication method
//
// If you prefer using a mnemonic, set a MNEMONIC environment variable
// to a valid mnemonic
const MNEMONIC = process.env.MNEMONIC

// If you prefer to be authenticated using a private key, set a PRIVATE_KEY environment variable
const PRIVATE_KEY = process.env.PRIVATE_KEY

const PRIVATE_KEY_BASE = process.env.PRIVATE_KEY_BASE

const accounts: HttpNetworkAccountsUserConfig | undefined = MNEMONIC
    ? { mnemonic: MNEMONIC }
    : PRIVATE_KEY
      ? [PRIVATE_KEY]
      : undefined

const baseaccounts: HttpNetworkAccountsUserConfig | undefined = MNEMONIC
    ? { mnemonic: MNEMONIC }
    : PRIVATE_KEY_BASE
      ? [PRIVATE_KEY_BASE]
      : undefined

// SECURITY: never serialize `accounts` into the log. This object holds the raw
// deployer mnemonic (or private key) read from .env, so the previous
// `JSON.stringify(accounts)` printed live signing material to stdout on *every*
// hardhat invocation — including `compile` and `test`. That put the key into CI job
// logs (typically retained and readable by anyone with repository read access),
// terminal scrollback, and any `script`/tee capture, none of which are secret stores
// and none of which can be retroactively scrubbed with confidence.
//
// Log only which authentication method resolved, which is the sole piece of
// information this line was ever useful for when diagnosing a misconfigured .env.
const accountsSource = MNEMONIC ? 'MNEMONIC' : PRIVATE_KEY ? 'PRIVATE_KEY' : 'none'
console.log(`Using accounts config: ${accountsSource}`)

if (accounts == null) {
    console.warn(
        'Could not find MNEMONIC or PRIVATE_KEY environment variables. It will not be possible to execute transactions in your example.'
    )
}

const config: HardhatUserConfig = {
    paths: {
        cache: 'cache/hardhat',
    },
    solidity: {
        compilers: [
            {
                version: '0.8.22',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    networks: {
        'base-sepolia-testnet': {
            eid: EndpointId.BASESEP_V2_TESTNET,
            url: process.env.RPC_URL_BASE_SEPOLIA || 'https://sepolia.base.org',
            // CORRECTNESS: the shorthand `baseaccounts` produced a network entry with a
            // key hardhat does not recognise, so this network silently had *no* signer
            // configured while `PRIVATE_KEY_BASE` appeared to be wired up. Every
            // deployment or transaction against base-sepolia-testnet failed for a reason
            // that pointed at the environment rather than at this file. The intent is
            // clearly to use the Base-specific account list.
            accounts: baseaccounts,
        },
        'sepolia-testnet': {
            eid: EndpointId.SEPOLIA_V2_TESTNET,
            url: process.env.RPC_URL_BASE_SEPOLIA || 'https://1rpc.io/sepolia',
            accounts,
        },
        'bsc-testnet': {
            eid: EndpointId.BSC_V2_TESTNET,
            url: process.env.RPC_URL_BSC || 'https://bsc-testnet-rpc.publicnode.com',
            accounts,
        },
        'polygonAmoy': {
            eid: EndpointId.AMOY_V2_TESTNET,
            url: process.env.RPC_URL_AMOY || 'https://polygon-amoy.drpc.org',
            accounts,
        },
        hardhat: {
            // Need this for testing because TestHelperOz5.sol is exceeding the compiled contract size limit
            allowUnlimitedContractSize: true,
        },
    },
    namedAccounts: {
        deployer: {
            default: 0, // wallet address of index[0], of the mnemonic in .env
        },
    },
    sourcify: {
        enabled: true
    },
    etherscan: {
        apiKey: {
            bscTestnet: process.env.API_KEY || '', // your key from polygonscan.com
        },
        customChains: [
            {
            network: "bsc-testnet",       // must match your --network name
            chainId: 97,               // ✅ REQUIRED for V2 API
            urls: {
                apiURL: "https://api.etherscan.io/v2/api?chainid=97", // Polygon Amoy V2 API endpoint
                browserURL: "https://amoy.polygonscan.com"      // Explorer base URL
            },
            },
        ],
    },

}

export default config
