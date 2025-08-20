# 🎯 二维码工坊 - QRCode Workshop

一个功能强大的在线二维码生成器，支持文本、URL、Wi-Fi信息转换为二维码，并提供自定义前景色和Logo嵌入功能。

## 🌟 功能特性

- **多种二维码类型**: 支持文本、网址、Wi-Fi网络等多种二维码格式
- **丰富导出格式**: 支持PNG、SVG格式导出
- **自定义样式**: 可自定义二维码前景色、Logo
- **响应式设计**: 完美适配手机、平板、电脑
- **一键下载**: 生成的二维码可直接下载保存
- **实时预览**: 即时查看生成效果

## 🚀 快速开始

### 环境要求
- Node.js 14.0 或更高版本
- npm 或 yarn 包管理器

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 生产环境启动
```bash
npm start
```

访问 http://localhost:3000 即可使用

## 🛠️ 技术栈

- **后端**: Node.js + Express
- **二维码生成**: qrcode.js
- **图像处理**: Canvas API
- **前端**: 原生JavaScript + CSS3
- **响应式**: CSS Grid + Flexbox

## 📱 使用说明

### 1. 选择二维码类型
- **文本**: 输入任意文本内容
- **网址**: 输入URL链接（自动补全https://）
- **Wi-Fi**: 输入网络名称、密码和安全类型

### 2. 自定义选项
- **前景色**: 点击颜色选择器更改二维码颜色
- **Logo**: 上传图片文件作为二维码中心Logo

### 3. 生成与下载
- 点击"生成二维码"按钮
- 预览生成的二维码
- 点击"下载"保存到本地

## 🔧 API接口

### 生成二维码
```http
POST /api/generate
Content-Type: application/json

{
  "text": "内容",
  "color": "#000000",
  "type": "text|url|wifi",
  "logo": "base64图片数据"
}
```

### 响应格式
```json
{
  "success": true,
  "data": "data:image/png;base64,...",
  "content": "实际生成的内容"
}
```

## 🎨 界面预览

| 功能 | 预览 |
|------|------|
| 文本二维码 | ![文本二维码](https://via.placeholder.com/300x300/007acc/ffffff?text=Text+QR) |
| 网址二维码 | ![网址二维码](https://via.placeholder.com/300x300/007acc/ffffff?text=URL+QR) |
| Wi-Fi二维码 | ![Wi-Fi二维码](https://via.placeholder.com/300x300/007acc/ffffff?text=WiFi+QR) |

## 📁 项目结构

```
qrcode-workshop/
├── server.js          # Express服务器
├── package.json       # 项目配置
├── public/            # 静态文件
│   ├── index.html     # 主页面
│   ├── css/
│   │   └── style.css  # 样式文件
│   ├── js/
│   │   └── app.js     # 前端逻辑
│   └── images/        # 图片资源
└── README.md          # 项目说明
```

## 🚀 部署指南

### Docker部署
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### 云平台部署
支持一键部署到：
- Vercel
- Netlify
- Heroku
- Railway

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进项目！

### 开发规范
1. 使用ES6+语法
2. 添加适当的注释
3. 保持代码风格一致
4. 测试所有功能

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 💬 联系我们

- 📧 邮箱: contact@qrcode-workshop.com
- 🐛 问题反馈: [GitHub Issues](https://github.com/your-repo/issues)

---

⭐ 如果这个项目对你有帮助，请给个Star！