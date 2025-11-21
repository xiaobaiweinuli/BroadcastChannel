# 频道筛选功能说明

## 新增功能

已成功添加多频道筛选功能，支持在多频道模式下独立浏览每个频道的内容。

## 功能特点

### 1. 主页优化

- 主页只显示 CHANNELS 配置中的第一个频道内容
- 保持主页简洁，突出主频道

### 2. 频道页面

- 侧边栏新增"频道"导航链接（配置多频道时自动显示）
- 点击"频道"查看所有频道列表
- 每个频道显示头像、标题和用户名
- 点击频道卡片进入该频道的内容页面

### 3. 单频道浏览

- 每个频道有独立的内容页面
- 支持分页、搜索等所有功能

## 配置示例

```env
CHANNELS=xingshuang_blog,tvb_ys
```

## 访问路径

- 主页: `/` - 显示第一个频道内容
- 频道列表: `/channels` - 显示所有频道
- 单个频道: `/channels/xingshuang_blog` - 显示指定频道内容

## 技术实现

### 新增文件

- `src/pages/channels.astro` - 频道列表页面
- `src/pages/channels/[channel].astro` - 单个频道详情页面

### 修改文件

- `src/pages/index.astro` - 主页只显示第一个频道
- `src/layouts/base.astro` - 侧边栏添加频道导航
- `src/lib/telegram/index.js` - 支持单频道查询参数
- `.env.example` - 更新配置说明
- `MULTI_CHANNEL_GUIDE.md` - 更新多频道指南
