
# @old_young_man/vision-bridge-mcp

基于 **ModelScope 多模态大模型**（Qwen/Qwen3.5-27B）的图片识别 MCP 服务。支持**本地图片、URL 图片、剪贴板图片**三种图片来源。

## 快速开始

### 前提条件

- Node.js 18+
- ModelScope API Token（[免费申请](https://modelscope.cn/my/myaccesstoken)）

---

## 接入AI编程助手

### 方式一：Cursor（项目级）

在项目根目录创建 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "vision-bridge": {
      "command": "npx",
      "args": ["-y", "@old_young_man/vision-bridge-mcp"],
      "env": {
        "MODELSCOPE_API_TOKEN": "ms-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### 方式二：Cursor（全局）

编辑用户目录下的全局配置文件 `~/.cursor/mcp.json`（Windows 路径：`C:\Users\你的用户名\.cursor\mcp.json`）：

```json
{
  "mcpServers": {
    "vision-bridge": {
      "command": "npx",
      "args": ["-y", "@old_young_man/vision-bridge-mcp"],
      "env": {
        "MODELSCOPE_API_TOKEN": "ms-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

配置后所有 Cursor 项目均可使用，无需重复配置。

### 方式三：Claude Code（全局）

```bash
claude mcp add vision-bridge -- npx -y @old_young_man/vision-bridge-mcp
```

然后在 `~/.claude.json` 的项目配置中添加环境变量：

```json
{
  "env": {
    "MODELSCOPE_API_TOKEN": "ms-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

### 方式四：Claude Code（项目级）

`claude.json` 配置参考：

```json
{
  "mcpServers": {
    "vision-bridge": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@old_young_man/vision-bridge-mcp"],
      "env": {
        "MODELSCOPE_API_TOKEN": "ms-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

---

## 图片来源

支持三种方式提供图片：

### 1. 本地路径

```bash
# 传入本地图片的绝对路径
"image_path": "D:\\screenshots\\error.png"
```

### 2. URL 地址

```bash
# 传入远程图片的 URL
"image_url": "https://example.com/screenshot.png"
```

### 3. 剪贴板

不传 `image_path` / `image_url` / `image_base64` 时，自动从系统剪贴板读取图片。

---

## 提示词示例

以下是在 AI 编程助手聊天框中可以直接使用的提示词：

### 示例 1：分析错误截图

> 我刚截了一张报错截图，帮我分析图中有什么错误信息？

### 示例 2：描述 UI 界面

> 分析这张页面的 UI 布局，描述有哪些交互元素和功能区域。

### 示例 3：识别验证码 / 图片中的文字

> 识别这张图片中的文字内容。

### 示例 4：对比多张图片（分多次调用）

> 先看这张图，描述整体布局。
> 再看另一张图，和刚才那张有什么不同？

### 示例 5：指定本地图片文件

> 分析 D:\screenshots\dashboard.png 这张图片，描述它的数据可视化图表。

### 示例 6：指定 URL 图片

> 帮我看看这张图片里是什么内容：https://example.com/photo.jpg

### 示例 7：自定义分析指令

> 请用英文描述这张图片的内容。
> 图中人物的服装是什么颜色？
> 这个界面的表单有哪些必填字段？

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MODELSCOPE_API_TOKEN` | （必填） | ModelScope 令牌 |
| `MODELSCOPE_MODEL_ID` | `Qwen/Qwen3.5-27B` | 模型 ID |
| `MODELSCOPE_API_BASE` | `https://api-inference.modelscope.cn/v1` | API 地址 |
| `IMAGE_MAX_SIZE_MB` | `10` | 图片大小限制（MB） |
| `IMAGE_MAX_DIMENSION` | `2048` | 图片最大边长（像素） |
| `API_TIMEOUT` | `60` | API 超时（秒） |
| `API_MAX_RETRIES` | `3` | 失败重试次数 |

支持通过 `.env` 文件配置（放在工作目录下）：

```
MODELSCOPE_API_TOKEN=ms-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MODELSCOPE_MODEL_ID=Qwen/Qwen3.5-27B
IMAGE_MAX_SIZE_MB=10
```

---

## 可用工具

### describe_image

识别和描述图片内容。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `image_path` | string | 否 | 本地图片绝对路径 |
| `image_url` | string | 否 | 远程图片 URL |
| `image_base64` | string | 否 | 图片 base64 数据 |
| `prompt` | string | 否 | 自定义指令，默认"请详细描述这张图片的内容" |

> 不传任何图片来源参数时，自动尝试读取系统剪贴板中的图片。
> 优先级：`image_path` > `image_url` > `image_base64` > 剪贴板
>>>>>>> 12b2eaa (feat: init vision-bridge-mcp MCP server)
