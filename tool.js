import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { RecallClient } from '@recallnet/sdk/client';
import { testnet } from '@recallnet/chains';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Blob } from 'buffer';

globalThis.Blob = Blob; // Fix cho lỗi File trong Node.js
globalThis.File = class File extends Blob {
  constructor(chunks, filename, options = {}) {
    super(chunks, options);
    this.name = filename;
    this.lastModified = options.lastModified || Date.now();
  }
};

// Setup đường dẫn hiện tại
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Delay và Random
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const randInRange = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(randInRange(min, max));
const randKey = () => Array.from({ length: 6 }, () => String.fromCharCode(randInt(97, 123))).join('');

// Đọc ảnh ngẫu nhiên từ thư mục /image
const getRandomImage = () => {
  const dir = path.join(__dirname, 'image');
  const files = fs.readdirSync(dir).filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));
  if (files.length === 0) throw new Error('Không tìm thấy ảnh trong thư mục /image');
  const randomFile = files[randInt(0, files.length)];
  const buffer = fs.readFileSync(path.join(dir, randomFile));
  return { buffer, name: randomFile };
};

// Chạy tác vụ cho 1 ví
const runTaskForWallet = async (privateKey, index) => {
  console.log(`\n🔑 Ví ${index + 1}: Bắt đầu xử lý...`);

  const walletClient = createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: testnet,
    transport: http(), // ✅ Sử dụng http()
  });
  

  const client = new RecallClient({ walletClient });

  // 1. Mua credit
  const creditAmount = parseEther(randInRange(0.5, 1.25).toFixed(3));
  const creditManager = client.creditManager();
  const { meta: creditMeta } = await creditManager.buy(creditAmount);
  console.log(`✅ Ví ${index + 1}: Mua credit (${creditAmount}) thành công. TX: ${creditMeta?.tx?.transactionHash}`);
  await delay(randInt(20000, 60000));

  // 2. Tạo bucket
  const bucketManager = client.bucketManager();
  const { result: { bucket } } = await bucketManager.create();
  console.log(`✅ Ví ${index + 1}: Tạo bucket thành công. Bucket ID: ${bucket}`);
  await delay(randInt(20000, 60000));

  // 3. Truy vấn object
  const { result: { objects } } = await bucketManager.query(bucket, { prefix: '' });
  console.log(`✅ Ví ${index + 1}: Truy vấn bucket thành công, hiện có ${objects.length} object.`);
  await delay(randInt(20000, 60000));

  // 4. Thêm object
  const { buffer, name } = getRandomImage();
  const file = new File([buffer], name);
  const key = randKey();
  const { meta: addMeta } = await bucketManager.add(bucket, key, file);
  console.log(`✅ Ví ${index + 1}: Thêm object (${key}) vào bucket thành công. TX: ${addMeta?.tx?.transactionHash}`);

  // Delay giữa ví
  const rest = randInt(30000, 150000);
  console.log(`🎉 Ví ${index + 1} hoàn thành. Nghỉ ${Math.floor(rest / 1000)}s trước khi xử lý ví tiếp theo.`);
  await delay(rest);
};

// Hàm chính
const main = async () => {
  const privateKeys = fs.readFileSync(path.join(__dirname, 'private_key.txt'), 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  for (let i = 0; i < privateKeys.length; i++) {
    try {
      await runTaskForWallet(privateKeys[i], i);
    } catch (err) {
      console.error(`❌ Ví ${i + 1}: Lỗi - ${err.message}`);
    }
  }

  console.log('\n✅ Tất cả ví đã xử lý xong.');
};

main();
