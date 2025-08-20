class QRCodeWorkshop {
    constructor() {
        this.currentType = 'text';
        this.logoData = null;
        this.publicKey = null;
        this.turnstileToken = null;
        this.init();
        this.loadPublicKey(); // 加载RSA公钥
    }

    init() {
        this.bindEvents();
        this.setupTypeSelector();
        this.setupFileUpload();
    }

    bindEvents() {
        // 类型切换
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchType(e.target.dataset.type);
            });
        });

        // 生成按钮
        const generateBtn = document.getElementById('generate-btn');
        if (generateBtn) generateBtn.addEventListener('click', () => this.generateQRCode());

        // 下载按钮
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) downloadBtn.addEventListener('click', () => this.downloadQRCode());

        // 重置按钮
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetForm());

        // 导出格式切换
        const exportFormat = document.getElementById('export-format');
        if (exportFormat) exportFormat.addEventListener('change', (e) => this.handleExportFormatChange(e));

        // 回车键生成
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.generateQRCode();
            }
        });

        // 导出按钮
        const downloadPng = document.getElementById('download-png');
        const downloadSvg = document.getElementById('download-svg');
        const downloadPdf = document.getElementById('download-pdf');
        if (downloadPng) downloadPng.addEventListener('click', () => this.downloadQRCode());
        if (downloadSvg) downloadSvg.addEventListener('click', () => this.downloadSVG());
        if (downloadPdf) downloadPdf.addEventListener('click', () => this.downloadPDF());

        // 全局Turnstile回调函数
        window.onTurnstileSuccess = (token) => {
            this.turnstileToken = token;
            document.getElementById('generate-btn').disabled = false;
        };

        window.onTurnstileError = (errorCode) => {
            console.error('Turnstile验证错误:', errorCode);
            this.turnstileToken = null;
            document.getElementById('generate-btn').disabled = true;
        };

        window.onTurnstileExpired = () => {
            console.warn('Turnstile验证已过期');
            this.turnstileToken = null;
            document.getElementById('generate-btn').disabled = true;
        };
    }

    setupTypeSelector() {
        // 默认激活文本类型
        this.switchType('text');
    }

    switchType(type) {
        this.currentType = type;
        
        // 更新按钮状态
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-type="${type}"]`).classList.add('active');

        // 切换输入区域
        document.querySelectorAll('.input-group').forEach(group => {
            group.classList.remove('active');
        });
        document.getElementById(`${type}-input`).classList.add('active');
    }

    setupFileUpload() {
        const logoUpload = document.getElementById('logo-upload');
        logoUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.logoData = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    async loadPublicKey() {
        try {
            const response = await fetch('/api/public-key');
            const data = await response.json();
            if (data.success) {
                this.publicKey = data.publicKey;
                console.log('✅ RSA公钥已加载');
            } else {
                console.error('加载公钥失败:', data.error);
            }
        } catch (error) {
            console.error('获取公钥失败:', error);
        }
    }

    async encryptData(data) {
        if (!this.publicKey) {
            throw new Error('RSA公钥未加载');
        }

        try {
            // 生成AES密钥
            const aesKey = await window.crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: 256
                },
                true,
                ['encrypt', 'decrypt']
            );

            // 生成随机IV
            const iv = window.crypto.getRandomValues(new Uint8Array(12));

            // 加密数据
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(JSON.stringify(data));
            
            // 使用AES-GCM加密，获取加密数据和认证标签
            const encryptedData = await window.crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                aesKey,
                dataBuffer
            );

            // 导出AES密钥
            const exportedKey = await window.crypto.subtle.exportKey('raw', aesKey);

            // 使用RSA公钥加密AES密钥
            const publicKey = await window.crypto.subtle.importKey(
                'spki',
                this.pemToArrayBuffer(this.publicKey),
                {
                    name: 'RSA-OAEP',
                    hash: 'SHA-256'
                },
                false,
                ['encrypt']
            );

            const encryptedKey = await window.crypto.subtle.encrypt(
                { name: 'RSA-OAEP' },
                publicKey,
                exportedKey
            );

            // 组合加密结果：加密密钥 + IV + 加密数据 + 认证标签
            const result = {
                key: this.arrayBufferToBase64(encryptedKey),
                iv: this.arrayBufferToBase64(iv),
                data: this.arrayBufferToBase64(encryptedData)
            };

            return JSON.stringify(result);
        } catch (error) {
            throw new Error('加密失败: ' + error.message);
        }
    }

    pemToArrayBuffer(pem) {
        const b64Lines = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
        const byteString = atob(b64Lines);
        const byteArray = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            byteArray[i] = byteString.charCodeAt(i);
        }
        return byteArray.buffer;
    }

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    async generateQRCode() {
        const content = this.getContent();
        if (!content) {
            this.showError('请输入有效内容');
            return;
        }

        if (!this.publicKey) {
            this.showError('RSA公钥未加载，请刷新页面重试');
            return;
        }

        if (!this.turnstileToken) {
            this.showError('请完成人机验证');
            return;
        }

        this.setLoading(true);

        try {
            const requestData = {
                text: content,
                color: document.getElementById('qr-color').value,
                bgColor: document.getElementById('qr-bg-color').value,
                size: parseInt(document.getElementById('qr-size').value),
                type: this.currentType,
                turnstileToken: this.turnstileToken
            };

            const encryptedData = await this.encryptData(requestData);

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    encrypted: encryptedData
                })
            });

            const result = await response.json();

            if (result.success) {
                await this.displayQRCodeWithLogo(result.data);
                // 重置验证状态
                this.turnstileToken = null;
                if (window.turnstile) {
                    window.turnstile.reset();
                }
            } else {
                this.showError(result.error || '生成失败');
            }
        } catch (error) {
            console.error('生成二维码失败:', error);
            this.showError('网络错误，请稍后重试');
        } finally {
            this.setLoading(false);
        }
    }

    getContent() {
        switch (this.currentType) {
            case 'text':
                return document.getElementById('text-content').value.trim();
            case 'url':
                const url = document.getElementById('url-content').value.trim();
                return url ? (url.startsWith('http') ? url : `https://${url}`) : '';
            case 'wifi':
                const ssid = document.getElementById('wifi-ssid').value.trim();
                const password = document.getElementById('wifi-password').value;
                const security = document.getElementById('wifi-security').value;
                
                if (!ssid) return '';
                return {
                    ssid,
                    password,
                    security
                };
            default:
                return '';
        }
    }

    async displayQRCodeWithLogo(qrDataUrl) {
        const qrImage = document.getElementById('qr-image');
        const placeholder = document.getElementById('qr-placeholder');
        const actions = document.getElementById('result-actions');
        
        if (!this.logoData) {
            // 没有Logo，直接显示二维码
            qrImage.src = qrDataUrl;
            qrImage.style.display = 'block';
            placeholder.style.display = 'none';
            actions.style.display = 'flex';

            // 添加生成动画
            qrImage.style.opacity = '0';
            setTimeout(() => {
                qrImage.style.transition = 'opacity 0.5s ease';
                qrImage.style.opacity = '1';
            }, 100);
            return;
        }

        try {
            // 创建Canvas来合并二维码和Logo
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const size = parseInt(document.getElementById('qr-size').value);
            canvas.width = size;
            canvas.height = size;

            // 加载二维码图片
            const qrImg = new Image();
            qrImg.onload = () => {
                // 绘制二维码
                ctx.drawImage(qrImg, 0, 0, size, size);

                // 加载并绘制Logo
                const logoImg = new Image();
                logoImg.onload = () => {
                    // 计算Logo大小（二维码的20%，最小20px，最大80px）
                    const logoSize = Math.max(20, Math.min(size * 0.2, 80));
                    const logoX = (size - logoSize) / 2;
                    const logoY = (size - logoSize) / 2;

                    // 绘制白色背景（处理透明Logo）
                    ctx.fillStyle = document.getElementById('qr-bg-color').value;
                    ctx.fillRect(logoX - 5, logoY - 5, logoSize + 10, logoSize + 10);

                    // 绘制Logo
                    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);

                    // 转换为图片URL
                    const finalDataUrl = canvas.toDataURL('image/png');
                    qrImage.src = finalDataUrl;
                    qrImage.style.display = 'block';
                    placeholder.style.display = 'none';
                    actions.style.display = 'flex';

                    // 添加生成动画
                    qrImage.style.opacity = '0';
                    setTimeout(() => {
                        qrImage.style.transition = 'opacity 0.5s ease';
                        qrImage.style.opacity = '1';
                    }, 100);
                };
                logoImg.onerror = () => {
                    // Logo加载失败，显示原二维码
                    qrImage.src = qrDataUrl;
                    qrImage.style.display = 'block';
                    placeholder.style.display = 'none';
                    actions.style.display = 'flex';

                    // 添加生成动画
                    qrImage.style.opacity = '0';
                    setTimeout(() => {
                        qrImage.style.transition = 'opacity 0.5s ease';
                        qrImage.style.opacity = '1';
                    }, 100);
                };
                logoImg.src = this.logoData;
            };
            qrImg.onerror = () => {
                this.showError('二维码图片加载失败');
            };
            qrImg.src = qrDataUrl;
        } catch (error) {
            console.error('合并Logo失败:', error);
            // 出错时显示原二维码
            qrImage.src = qrDataUrl;
            qrImage.style.display = 'block';
            placeholder.style.display = 'none';
            actions.style.display = 'flex';

            // 添加生成动画
            qrImage.style.opacity = '0';
            setTimeout(() => {
                qrImage.style.transition = 'opacity 0.5s ease';
                qrImage.style.opacity = '1';
            }, 100);
        }
    }

    downloadQRCode() {
        const qrImage = document.getElementById('qr-image');
        if (qrImage.src && qrImage.style.display !== 'none') {
            const link = document.createElement('a');
            link.download = `qrcode-${Date.now()}.png`;
            link.href = qrImage.src;
            link.click();
        }
    }

    resetForm() {
        // 重置输入
        document.getElementById('text-content').value = '';
        document.getElementById('url-content').value = '';
        document.getElementById('wifi-ssid').value = '';
        document.getElementById('wifi-password').value = '';
        document.getElementById('wifi-security').value = 'WPA';
        document.getElementById('qr-color').value = '#000000';
        document.getElementById('logo-upload').value = '';

        // 重置显示
        document.getElementById('qr-image').style.display = 'none';
        document.getElementById('qr-placeholder').style.display = 'flex';
        document.getElementById('result-actions').style.display = 'none';

        this.logoData = null;
        
        // 重置导出格式
        document.getElementById('export-format').value = 'png';
        this.handleExportFormatChange({ target: { value: 'png' } });
    }

    handleExportFormatChange(event) {
        const format = event.target.value;
        const pngBtn = document.getElementById('download-png');
        const svgBtn = document.getElementById('download-svg');
        const pdfBtn = document.getElementById('download-pdf');
        
        pngBtn.style.display = format === 'png' ? 'inline-block' : 'none';
        svgBtn.style.display = format === 'svg' ? 'inline-block' : 'none';
        pdfBtn.style.display = format === 'pdf' ? 'inline-block' : 'none';
    }

    async downloadPDF() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = parseInt(document.getElementById('qr-size').value);
        canvas.width = size;
        canvas.height = size;
        
        const qrImage = document.getElementById('qr-image');
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, size, size);
                
                // 创建PDF
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: [size * 0.264583, size * 0.264583] // 像素转毫米
                });
                
                // 添加二维码到PDF
                pdf.addImage(
                    canvas.toDataURL('image/png'),
                    'PNG',
                    0,
                    0,
                    size * 0.264583,
                    size * 0.264583
                );
                
                // 下载PDF
                pdf.save('qrcode.pdf');
                resolve();
            };
            img.onerror = reject;
            img.src = qrImage.src;
        });
    }

    async downloadSVG() {
        const format = document.getElementById('export-format').value;
        if (format !== 'svg') return;

        if (!this.publicKey) {
            this.showError('RSA公钥未加载，请刷新页面重试');
            return;
        }

        try {
            const content = this.getContent();
            if (!content) {
                this.showError('请输入有效内容');
                return;
            }

            const requestData = {
                text: content,
                color: document.getElementById('qr-color').value,
                bgColor: document.getElementById('qr-bg-color').value,
                size: parseInt(document.getElementById('qr-size').value),
                type: this.currentType,
                format: 'svg',
                turnstileToken: this.turnstileToken
            };

            // 使用RSA加密请求数据
            const encryptedData = await this.encryptData(requestData);

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    encrypted: encryptedData
                })
            });

            const result = await response.json();

            if (result.success && result.format === 'svg') {
                // 创建SVG文件下载
                const blob = new Blob([result.raw], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'qrcode.svg';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else {
                this.showError(result.error || 'SVG生成失败');
            }
        } catch (error) {
            console.error('下载SVG失败:', error);
            this.showError('网络错误，请稍后重试');
        }
    }

    setLoading(isLoading) {
        const btn = document.getElementById('generate-btn');
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.loading-spinner');

        if (isLoading) {
            btn.disabled = true;
            btnText.style.display = 'none';
            spinner.style.display = 'inline';
            btnText.textContent = '⏳ 生成中...';
        } else {
            btn.disabled = false;
            btnText.style.display = 'inline';
            spinner.style.display = 'none';
            btnText.textContent = '🚀 生成二维码';
        }
    }

    showError(message) {
        // 创建错误提示
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => errorDiv.remove(), 300);
        }, 3000);
    }
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new QRCodeWorkshop();
    console.log('🎯 二维码工坊已启动！');
});