const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 生成RSA密钥对
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// 创建.env文件内容
const envContent = `# RSA密钥配置
RSA_PUBLIC_KEY="${publicKey.replace(/\n/g, '\\n')}"
RSA_PRIVATE_KEY="${privateKey.replace(/\n/g, '\\n')}"

# 服务器配置
PORT=3010
NODE_ENV=development
`;

// 写入.env文件
fs.writeFileSync(path.join(__dirname, '.env'), envContent);

console.log('✅ RSA密钥对已生成并保存到.env文件');
console.log('🔐 公钥已配置给前端使用');
console.log('🔑 私钥已配置给后端使用');
console.log('\n⚠️  请确保.env文件已添加到.gitignore中');