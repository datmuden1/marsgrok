const web3 = new Web3(window.ethereum);
const usdtContract = '0x55d398326f99059fF775485246999027B3197955';
const ABI = [
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "_to", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [{ "name": "success", "type": "bool" }],
    "type": "function"
  }
];

let connectedWallet = null;

// Hamburger Menu Toggle
document.addEventListener('DOMContentLoaded', () => {
  const hamburgerIcon = document.querySelector('.hamburger-icon');
  const navMenu = document.querySelector('#nav-menu');
  hamburgerIcon.addEventListener('click', () => {
    navMenu.classList.toggle('active');
  });
});

// Connect Wallet
document.getElementById('connectButton').addEventListener('click', async () => {
  console.log("Connect Wallet clicked");
  try {
    // Check for MetaMask
    if (typeof window.ethereum === 'undefined') {
      document.getElementById('resultText').innerText = 'MetaMask is not installed. Please install MetaMask.';
      console.log("MetaMask not installed");
      return;
    }

    // Request wallet connection
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    connectedWallet = accounts[0];
    document.getElementById('walletText').innerText = `Connected: ${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}`;
    document.getElementById('connectButton').style.display = 'none';
    document.getElementById('disconnectButton').style.display = 'block';
    console.log("Wallet connected:", connectedWallet);

    // Check and switch to BSC mainnet
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    console.log("Chain ID:", chainId);
    if (chainId !== '0x38') {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x38' }],
        });
        console.log("Switched to BSC mainnet");
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x38',
              chainName: 'Binance Smart Chain',
              rpcUrls: ['https://bsc-dataseed.binance.org/'],
              nativeCurrency: {
                name: 'BNB',
                symbol: 'BNB',
                decimals: 18
              },
              blockExplorerUrls: ['https://bscscan.com']
            }],
          });
          console.log("Added BSC mainnet");
        } else {
          document.getElementById('resultText').innerText = 'Failed to switch to BSC mainnet: ' + switchError.message;
          console.error("Switch network error:", switchError);
          return;
        }
      }
    }

    // Check USDT and BNB balance
    const contract = new web3.eth.Contract(ABI, usdtContract);
    const balanceUSDT = await contract.methods.balanceOf(connectedWallet).call();
    const balanceBNB = await web3.eth.getBalance(connectedWallet);
    const usdtValue = Number(web3.utils.fromWei(balanceUSDT, 'mwei')); // USDT on BSC uses 6 decimals
    const bnbValue = Number(web3.utils.fromWei(balanceBNB, 'ether'));
    console.log("USDT Balance:", usdtValue);
    console.log("BNB Balance:", bnbValue);

    // Check whitelist eligibility
    const isEligible = usdtValue > 0 || bnbValue > 0;
    document.getElementById('resultText').innerText = isEligible ? 'Eligible' : 'Not eligible';

    // Always show whitelist form
    document.getElementById('whitelistForm').style.display = 'block';
    if (isEligible) {
      document.getElementById('payButton').style.display = 'block';
      document.getElementById('notEligibleText').style.display = 'none';
      document.getElementById('exclusiveMessage').style.display = 'block';
      console.log("Wallet eligible for whitelist");
    } else {
      document.getElementById('payButton').style.display = 'none';
      document.getElementById('notEligibleText').style.display = 'block';
      document.getElementById('exclusiveMessage').style.display = 'none';
      console.log("Wallet not eligible for whitelist");
    }
  } catch (error) {
    document.getElementById('resultText').innerText = 'Error connecting wallet: ' + error.message;
    console.error("Error connecting wallet:", error);
  }
});

// Disconnect Wallet
document.getElementById('disconnectButton').addEventListener('click', () => {
  connectedWallet = null;
  document.getElementById('walletText').innerText = '';
  document.getElementById('resultText').innerText = '';
  document.getElementById('whitelistForm').style.display = 'none';
  document.getElementById('connectButton').style.display = 'block';
  document.getElementById('disconnectButton').style.display = 'none';
  console.log("Wallet disconnected");
});

// Buy Whitelist
document.getElementById('payButton').addEventListener('click', async (e) => {
  e.preventDefault();
  if (!connectedWallet) {
    document.getElementById('resultText').innerText = 'Wallet not connected';
    console.log("Wallet not connected");
    return;
  }
  const [amount, currency] = document.getElementById('amountDropdown').value.split('|');
  const receiver = '0x871526acf5345BA48487dc177C83C453e9B998F5';
  try {
    if (currency === 'USDT') {
      // Pay with USDT
      const contract = new web3.eth.Contract(ABI, usdtContract);
      const amountWei = web3.utils.toWei(amount, 'mwei'); // USDT on BSC uses 6 decimals
      await contract.methods.transfer(receiver, amountWei).send({ from: connectedWallet });
      document.getElementById('resultText').innerText = 'USDT payment successful!';
      console.log("USDT payment successful");
    } else if (currency === 'BNB') {
      // Pay with BNB
      const amountWei = web3.utils.toWei(amount, 'ether'); // BNB uses 18 decimals
      await web3.eth.sendTransaction({
        from: connectedWallet,
        to: receiver,
        value: amountWei
      });
      document.getElementById('resultText').innerText = 'BNB payment successful!';
      console.log("BNB payment successful");
    }
    document.getElementById('payButton').style.display = 'none';
    document.getElementById('connectButton').style.display = 'none';
    document.getElementById('disconnectButton').style.display = 'block';
  } catch (error) {
    document.getElementById('resultText').innerText = 'Payment failed: ' + error.message;
    console.error("Payment failed:", error);
  }
});

// Fixed slots
const currentSlots = 394; // Fixed at 394/500, update manually if needed
const maxSlots = 500;
const resetDate = new Date('2025-04-28').getTime();
function updateSlots() {
  document.getElementById('slotsText').innerText = `${currentSlots}/500 slots sold!`;
}
function updateCountdown() {
  const now = new Date().getTime();
  const timeLeft = (resetDate - now) / (1000 * 60 * 60 * 24);
  document.getElementById('countdownText').innerText = `${Math.ceil(timeLeft)} days left!`;
}
updateSlots();
updateCountdown();
setInterval(() => { updateCountdown(); }, 10000); // Update countdown only, not slots

particlesJS('particles-js', { particles: { number: { value: 20 }, color: { value: '#FF4500' }, shape: { type: 'star' }, opacity: { value: 0.7, random: true }, size: { value: 2, random: true }, move: { speed: 0.5, direction: 'bottom' } } });
