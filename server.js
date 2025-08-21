const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const crypto = require('crypto');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 获取RSA私钥
const privateKey = process.env.RSA_PRIVATE_KEY ?
    process.env.RSA_PRIVATE_KEY.replace(/\\n/g, '\n') : null;

// 获取Turnstile密钥
const turnstileSecretKey = process.env.CLOUDFLARE_TURNSITE_SECRET_KEY;

// 解密函数 - 使用AES+RSA混合加密
function decryptData(encryptedData) {
    if (!privateKey) {
        throw new Error('RSA私钥未配置');
    }

    try {
        // 解析加密数据格式
        const { key, iv, data } = JSON.parse(encryptedData);

        if (!key || !iv || !data) {
            throw new Error('无效的加密数据格式');
        }

        // 使用RSA私钥解密AES密钥
        const encryptedKeyBuffer = Buffer.from(key, 'base64');
        const aesKeyBuffer = crypto.privateDecrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            encryptedKeyBuffer
        );

        // 导入AES密钥
        const aesKey = crypto.createSecretKey(aesKeyBuffer);

        // 使用AES密钥解密数据
        const ivBuffer = Buffer.from(iv, 'base64');
        const encryptedDataBuffer = Buffer.from(data, 'base64');

        // 分离密文和认证标签（最后16字节是认证标签）
        const authTag = encryptedDataBuffer.slice(-16);
        const ciphertext = encryptedDataBuffer.slice(0, -16);

        const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, ivBuffer);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final()
        ]);

        return JSON.parse(decrypted.toString());
    } catch (error) {
        throw new Error('解密失败: ' + error.message);
    }
}

// 验证Turnstile token
async function validateTurnstileToken(token, remoteip) {
    if (!turnstileSecretKey) {
        throw new Error('Turnstile密钥未配置');
    }

    if (!token) {
        throw new Error('缺少验证token');
    }

    const formData = new URLSearchParams();
    formData.append('secret', turnstileSecretKey);
    formData.append('response', token);
    if (remoteip) {
        formData.append('remoteip', remoteip);
    }

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });

        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error('Turnstile验证失败:', error);
        return false;
    }
}



// API路由 - 生成二维码（需要RSA加密验证和Turnstile验证）
app.post('/api/generate', async (req, res) => {
    try {
        const { encrypted } = req.body;

        if (!encrypted) {
            return res.status(400).json({
                success: false,
                error: '缺少加密数据'
            });
        }

        // 解密请求数据
        let decryptedData,hello,qwq;
        try {
            decryptedData = decryptData(encrypted);
        } catch (error) {
            return res.status(403).json({
                success: false,
                error: error.message
            });
        }

        const { text, color = '#000000', bgColor = '#FFFFFF', size = 300, type = 'text', format = 'png', turnstileToken } = decryptedData;

        // 验证Turnstile token（从解密后的数据中获取）
        if (!turnstileToken) {
            return res.status(400).json({ error: '缺少人机验证token' });
        }

        const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
        const isValid = await validateTurnstileToken(turnstileToken, clientIP);

        if (!isValid) {
            return res.status(403).json({ error: '人机验证失败' });
        }

        if (!text) {
            return res.status(400).json({ error: '文本内容不能为空' });
        }

        // 根据类型处理内容
        let content = text;
        if (type === 'wifi') {
            const { ssid, password, security = 'WPA' } = text;
            content = `WIFI:T:${security};S:${ssid};P:${password};;`;
        } else if (type === 'url') {
            content = text.startsWith('http') ? text : `https://${text}`;
        }

        // 生成二维码配置
        const options = {
            width: size,
            height: size,
            margin: 2,
            color: {
                dark: color,
                light: bgColor
            },
            errorCorrectionLevel: 'H' // 高容错率，支持Logo
        };

        let result;
        if (format === 'svg') {
            // 生成SVG格式
            const svgString = await QRCode.toString(content, {
                ...options,
                type: 'svg'
            });

            // 将SVG转换为data URL
            const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`;
            result = {
                success: true,
                data: svgDataUrl,
                format: 'svg',
                raw: svgString,
                content: content
            };
        } else {
            // 生成PNG格式
            const qrDataURL = await QRCode.toDataURL(content, options);
            result = {
                success: true,
                data: qrDataURL,
                format: 'png',
                content: content
            };
        }

        res.json(result);

    } catch (error) {
        console.error('生成二维码失败:', error);
        res.status(500).json({ error: '生成二维码失败' });
    }
});

// 获取RSA公钥（供前端使用）
app.get('/api/public-key', (req, res) => {
    const publicKey = process.env.RSA_PUBLIC_KEY ?
        process.env.RSA_PUBLIC_KEY.replace(/\\n/g, '\n') : null;

    if (!publicKey) {
        return res.status(500).json({
            success: false,
            error: 'RSA公钥未配置'
        });
    }

    res.json({
        success: true,
        publicKey: publicKey
    });
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 二维码工坊运行在 http://localhost:${PORT}`);
    console.log(`📁 静态文件目录: ${path.join(__dirname, 'public')}`);
});
