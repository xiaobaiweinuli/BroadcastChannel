# RSS 标题和内容显示修复说明

## 问题描述

在 RSS 美化视图中，前两个条目没有显示标题和内容，只显示 "Read More" 按钮。但点击链接后内容是正常的。

从 XML 源码可以看到，缺少 `<title>` 和 `<description>` 标签：

```xml
<item>
  <link>https://tg.xingshuang.xyz/posts/18</link>
  <guid>...</guid>
  <pubDate>Wed, 19 Nov 2025 18:59:01 GMT</pubDate>
  <!-- 缺少 <title> 标签 -->
  <!-- 缺少 <description> 标签 -->
  <content:encoded>...</content:encoded>
</item>
```

## 问题原因

1. `item.title` 可能为空或 undefined，导致 RSS 库不生成 `<title>` 标签
2. `item.description` 字段不存在，导致 RSS 库不生成 `<description>` 标签

### Post 对象的实际字段

```javascript
{
  id: '18',
  title: '',  // ← 可能为空
  text: 'BCR是一款简单的Android通话录音应用...',  // ← 实际内容在这里
  content: '<div>HTML内容</div>',
  datetime: '2025-11-19T18:59:01Z',
  tags: [],
  channel: 'xingshuang_blog'
}
```

## 解决方案

修改 `src/pages/rss.xml.js`，确保 `title` 和 `description` 都有有效值：

```javascript
items: posts.map((item) => ({
  link: item.channel ? `posts/${item.channel}/${item.id}` : `posts/${item.id}`,
  // 确保 title 有值
  title: item.title || item.text?.substring(0, 100) || `Post ${item.id}`,
  // 确保 description 有值
  description: item.text || item.title || '',
  pubDate: new Date(item.datetime),
  content: sanitizeHtml(item.content, { ... }),
}))
```

### 逻辑说明

**title 字段**：
1. 优先使用 `item.title`（如果存在）
2. 如果为空，使用 `item.text` 的前100个字符
3. 如果还是为空，使用 `Post {id}` 作为后备

**description 字段**：
1. 优先使用 `item.text`（完整的纯文本内容）
2. 如果为空，使用 `item.title`
3. 如果还是为空，使用空字符串

## 修复后的 XML 格式

```xml
<item>
  <title>BCR是一款简单的Android通话录音应用，适用于已root的设备或运行自定义固件的设备。一旦启用，它就会保持静默，并在后台自动记录接进来的和打出去的通话。</title>
  <link>https://tg.xingshuang.xyz/posts/xingshuang_blog/18</link>
  <guid>...</guid>
  <description>BCR是一款简单的Android通话录音应用...</description>
  <pubDate>Wed, 19 Nov 2025 18:59:01 GMT</pubDate>
  <content:encoded>...</content:encoded>
</item>
```

## 效果

现在 RSS 美化视图会正确显示：
- ✅ 标题（title）
- ✅ 描述内容（description）
- ✅ 完整内容（content）
- ✅ Read More 链接

## 测试建议

1. 重启开发服务器
2. 访问 `http://localhost:4321/rss.xml`
3. 检查 RSS 美化视图是否显示标题和内容
4. 查看 XML 源码，确认有 `<title>` 和 `<description>` 标签
