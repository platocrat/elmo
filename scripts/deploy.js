const ethers = require('ethers');
const { Watcher } = require('@eth-optimism/watcher');
const { getContractFactory } = require('@eth-optimism/contracts');


// Set up some contract factories. You can ignore this stuff.
const factory = (name, ovm = true) => {
  const artifact = require(`../artifacts${ovm ? '-ovm' : ''}/contracts/${name}.sol/${name}.json`)
  return new ethers.ContractFactory(artifact.abi, artifact.bytecode)
}
const factory__L1_ERC20 = factory('ERC20')
const factory__L2_ERC20 = factory('L2DepositedERC20', true)
const factory__L1_ERC20Gateway = getContractFactory('OVM_L1ERC20Gateway')

// This is a script for deploying your contracts. You can adapt it to deploy
// yours, or create new ones.
async function main() {

  // This is just a convenience check
  if (network.name === "hardhat") {
    console.warn(
      "You are trying to deploy a contract to the Hardhat Network, which" +
      "gets automatically created and destroyed every time. Use the Hardhat" +
      " option '--network localhost'"
    );
  }

  // Set up our RPC provider connections.
  const l1RpcProvider = new ethers.providers.JsonRpcProvider('http://localhost:9545')
  const l2RpcProvider = new ethers.providers.JsonRpcProvider('http://localhost:8545')

  // Set up our wallets (using a default private key with 10k ETH allocated to it).
  // Need two wallets objects, one for interacting with L1 and one for interacting with L2.
  // Both will use the same private key.
  const key = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  const l1Wallet = new ethers.Wallet(key, l1RpcProvider)
  const l2Wallet = new ethers.Wallet(key, l2RpcProvider)

  // L1 messenger address depends on the deployment, this is default for our local deployment.
  const l1MessengerAddress = '0x59b670e9fA9D0A427751Af201D676719a970857b'
  // L2 messenger address is always the same.
  const l2MessengerAddress = '0x4200000000000000000000000000000000000007'

  // Tool that helps watches and waits for messages to be relayed between L1 and L2.
  const watcher = new Watcher({
    l1: {
      provider: l1RpcProvider,
      messengerAddress: l1MessengerAddress
    },
    l2: {
      provider: l2RpcProvider,
      messengerAddress: l2MessengerAddress
    }
  })

  // Deploy an ERC20 token on L1.
  console.log('Deploying L1 ERC20...')
  const L1_ERC20 = await factory__L1_ERC20.connect(l1Wallet).deploy(
    1234, //initialSupply
    'L1 ERC20' //name
  )
  await L1_ERC20.deployTransaction.wait()

  // Deploy the paired ERC20 token to L2.
  console.log('Deploying L2 ERC20...')
  const L2_ERC20 = await factory__L2_ERC20.connect(l2Wallet).deploy(
    l2MessengerAddress,
    'L2 ERC20', //name
    {
      gasPrice: 0
    }
  )
  await L2_ERC20.deployTransaction.wait()

  // Create a gateway that connects the two contracts.
  console.log('Deploying L1 ERC20 Gateway...')
  const L1_ERC20Gateway = await factory__L1_ERC20Gateway.connect(l1Wallet).deploy(
    L1_ERC20.address,
    L2_ERC20.address,
    l1MessengerAddress
  )
  await L1_ERC20Gateway.deployTransaction.wait()

  // Make the L2 ERC20 aware of the gateway contract.
  console.log('Initializing L2 ERC20...')
  const tx0 = await L2_ERC20.init(
    L1_ERC20Gateway.address,
    {
      gasPrice: 0
    }
  )
  await tx0.wait()

  console.log("All contracts deployed!")
  console.log("L1 ERC20 Address: " + L1_ERC20.address)
  console.log("L2 ERC20 Address: " + L2_ERC20.address)
  console.log("L1 ERC20 Gateway Address: " + L1_ERC20Gateway.address)


}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
