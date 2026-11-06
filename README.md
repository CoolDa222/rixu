# 日序

日序是一款面向个人使用的本地 / 多用户工作生活管理工具，用来记录计划、安排日历、管理不同生活场景，并在设定时间发送提醒。

项目同时包含：

- Windows 桌面应用
- Windows 电脑本地版
- Cloudflare 多用户公开网站
- Android 手机版
- 游客模式
- 意见箱

## 1. 项目解决了什么问题

日常计划经常分散在待办清单、日历、笔记和聊天记录里，学习、健身、饮食和工作安排之间也缺少统一视图。

日序解决以下问题：

- 把今天要做的事情集中到一个时间线中。
- 用月历直接查看每天有什么安排。
- 为学习、健身、饮食和游戏娱乐提供不同的记录方式，而不是简单复用任务列表。
- 在计划到达设定时间时发送系统通知。
- 支持没有账号的用户先以游客模式使用。
- 支持注册用户在不同设备之间同步计划、日历和备忘。
- 提供意见箱，让用户提交建议，管理员统一查看和处理。

## 2. 主要功能

### 首页总览

- 今日计划和预计投入时间。
- 下一项计划。
- 今日时间线。
- 自动保存的快速备忘。
- 学习、健身、饮食、游戏娱乐摘要。
- 快速添加计划入口。

### Windows 桌面版

- 独立桌面窗口，不依赖浏览器手动打开。
- 使用与网页版相同的完整功能。
- 关闭主窗口后继续驻留系统托盘。
- 托盘菜单支持重新打开、打开数据目录和完全退出。
- 桌面版可自行启动本地后台，也可复用已经运行的本地服务。
- 支持登录网站账号，并同步本地与云端计划、日历和备忘。
- 使用独立应用图标和 Windows 安装程序。

### 今日计划

- 自动汇总四个业务模块当天生效的计划。
- 按上午、下午、晚上分组。
- 按模块筛选。
- 显示各模块的计划数量、时长和今日构成。

### 日历

- 7 × 6 月视图。
- 每天日期方块下显示当天计划。
- 不同模块使用不同颜色。
- 单日超过三项时显示剩余数量。
- 点击计划可直接编辑。
- 点击日期查看右侧当天完整安排。
- 切换月份、回到今天、向指定日期添加计划。

### 学习计划

- 课程或领域。
- 具体学习内容。
- 日期、星期、开始时间和预计时长。
- 单次计划和每周重复。
- 按星期展示学习课程表。

### 健身计划

- 训练主题或部位。
- 动作名称、组数、次数或持续时长。
- 每周训练日和提醒时间。
- 按每周训练分部展示。
- 只记录计划，不记录实际完成量。

### 饮食计划

- 早餐、午餐、晚餐和加餐。
- 菜单、份量、用餐时间。
- 每天或指定星期重复。
- 按星期和餐次展示周菜单。
- 不计算热量，不记录实际摄入。

### 游戏娱乐

- 游戏或活动名称。
- 本次目标。
- 日期、时间、预计时长和每周重复。
- 展示本周娱乐安排和时间线。
- 不记录实际游玩时长。

### 意见箱

- 游客和登录用户都可提交建议。
- 类型包括功能建议、问题反馈、界面体验和其他想法。
- 登录用户自动附带账号邮箱。
- 游客可以匿名提交，也可以选填联系方式。
- 管理员可以查看、标记已查看、标记已处理或删除建议。

管理员账号通过 Cloudflare 环境变量 `ADMIN_EMAIL` 单独配置，不写入源码或文档。

### 数据与设置

- 导出 JSON 备份。
- 导入 JSON 备份。
- 清空数据。
- 桌面通知测试。
- Windows 后台开机自启动。
- Android 云端账号登录和手动同步。
- 游客数据说明。
- 桌面局域网同步接口和管理员配对码。

### 通知

- Windows 本地版通过 Node.js 后台发送系统通知。
- Android 通过系统本地通知调度。
- Android App 进程被系统结束后，已安排的通知仍可触发。
- Android“强行停止”会撤销闹钟，重新打开 App 后会重新安排。
- 公开网页第一版暂不提供关闭浏览器后的 Web Push 提醒。

### 账号与数据隔离

公开网站支持：

- 邮箱和密码注册。
- 邮箱和密码登录。
- HttpOnly 会话 Cookie。
- 密码 PBKDF2 哈希存储。
- 登录与意见箱限流只保存带密钥的 IP 摘要，不保存原始 IP。
- 每个账号独立的计划、备忘和设置数据。
- 游客无需账号使用。

第一版暂不提供：

- 邮箱验证码。
- 自助找回密码。
- 手机号登录。
- 微信登录。

## 3. 安装方法

### Windows 桌面版

安装版：

```text
release-desktop\日序-Desktop-Setup-0.3.2-x64.exe
```

便携版：

```text
release-desktop\日序-Desktop-Portable-0.3.2-x64.exe
```

安装版支持选择安装目录、桌面快捷方式和开始菜单快捷方式。便携版无需安装，双击后首次解压可能需要几秒钟。

当前桌面版未购买代码签名证书，Windows 可能显示“未知发布者”或 SmartScreen 提示。请仅运行本项目生成的文件。

重新构建桌面版：

```powershell
npm run desktop:build
```

桌面版数据与浏览器本地版共用：

```text
%LOCALAPPDATA%\WorkLifeManager\data.json
```

### 电脑本地版

环境要求：

- Windows 10 或 Windows 11
- Node.js 22 或更高版本
- npm

安装依赖：

```powershell
cd <项目目录>
npm install
```

构建并启动：

```powershell
npm start
```

启动后浏览器访问：

```text
http://127.0.0.1:4318
```

`npm start` 会：

1. 检查前端构建产物，缺失时自动构建。
2. 启动本地 Node.js 后台。
3. 打开默认浏览器。
4. 后台继续运行，关闭浏览器不会停止提醒。

### Android 版

最新 APK：

```text
release\日序-Android-0.3.2-debug.apk
```

安装步骤：

1. 将 APK 传到 Android 手机。
2. 在文件管理器中点击 APK。
3. 允许文件管理器“安装未知应用”。
4. 安装并打开日序。
5. 允许通知、自启动和精确闹钟权限。

这是个人调试签名 APK，不是应用商店版本。

重新构建 Android APK：

```powershell
npm run android:build
```

### 公开网站

无需本地安装，直接访问：

```text
https://rixu-app.pages.dev
```

当前中国大陆网络可能需要代理才能稳定访问。

Cloudflare 免费项目：

```text
Pages 项目：rixu-app
D1 数据库：rixu-db
```

本地开发前，将 `.dev.vars.example` 复制为 `.dev.vars` 并填写管理员邮箱和随机限流密钥。线上环境通过 Cloudflare Secrets 配置，不提交到项目：

```powershell
node .\node_modules\wrangler\bin\wrangler.js login
node .\node_modules\wrangler\bin\wrangler.js pages secret put ADMIN_EMAIL --project-name rixu-app
node .\node_modules\wrangler\bin\wrangler.js pages secret put RATE_LIMIT_SALT --project-name rixu-app
```

重新部署网站：

```powershell
npm run cloud:deploy
```

## 4. 使用方法

### Windows 桌面版

1. 双击安装版或便携版。
2. 等待日序窗口打开。
3. 像网页版一样管理计划、日历、备忘和意见箱。
4. 点击窗口右上角关闭按钮时，应用会隐藏到系统托盘。
5. 双击托盘图标可重新打开。
6. 从托盘菜单选择“退出日序”才会完全停止桌面程序。
7. 如需账号同步，进入“数据与设置 → 云端账号”，输入网站账号后点击“登录并同步”。

如果本地后台已经由 `npm start` 启动，桌面版会直接连接现有服务，不会重复启动端口。

### 电脑本地版

1. 运行 `npm start`。
2. 打开 `http://127.0.0.1:4318`。
3. 点击右上角“新建计划”。
4. 选择学习、健身、饮食或游戏娱乐。
5. 填写对应内容和时间。
6. 设置单次日期或按星期重复。
7. 开启系统通知。
8. 保存后，计划会自动进入首页、今日计划和日历。

### 网页游客模式

1. 打开 `https://rixu-app.pages.dev`。
2. 点击“不登录，先以游客模式使用”。
3. 游客数据仅保存在当前浏览器。
4. 刷新、关闭浏览器后仍会保留。
5. 清除浏览器数据会删除游客内容。
6. 游客模式不会与其他设备同步。

如需注册账号，请先在游客设置中导出备份，再登录并导入。

### 网页账号

1. 点击“创建账号”。
2. 输入邮箱和至少 8 位密码。
3. 同意使用条款和隐私政策。
4. 创建完成后自动登录。
5. 每个账号只能访问自己的计划、备忘和设置。

### 手机云端同步

1. 先在网站注册账号。
2. 打开 Android App 的“数据与设置”。
3. 找到“本机游客模式”或“云端账号”。
4. 输入同一个邮箱和密码。
5. 点击“登录并同步”。
6. 手机本地数据与云端数据会双向合并。
7. 打开 App、回到前台或点击“立即同步”时会再次同步。

同一计划在两端同时修改时，会生成名称带“手机冲突副本”的计划，不会直接覆盖。

### 意见箱

普通用户：

1. 打开“意见箱”。
2. 选择建议类型。
3. 填写至少 5 个字。
4. 可选填联系方式。
5. 点击“发送建议”。

管理员使用 `ADMIN_EMAIL` 指定的账号登录后：

1. 打开“意见箱”。
2. 点击“查看建议”。
3. 查看新建议。
4. 标记为已查看或已处理。
5. 删除不需要的建议。

### 数据备份

1. 进入“数据与设置”。
2. 点击“导出备份”。
3. 浏览器会下载 JSON 文件。
4. 点击“导入备份”并选择 JSON 文件。
5. 点击“清空全部数据”前需要二次确认。

## 5. 输入输出示例

### 示例一：新增学习计划

输入：

```json
{
  "module": "learning",
  "title": "TypeScript 类型系统",
  "date": "2026-11-06",
  "repeatEnabled": true,
  "repeatWeekdays": [1, 3, 5],
  "startTime": "09:30",
  "durationMinutes": 90,
  "reminderEnabled": true,
  "notes": "复习泛型与条件类型",
  "details": {
    "course": "前端进阶",
    "content": "泛型与条件类型"
  }
}
```

输出：

- 首页时间线显示 `09:30 TypeScript 类型系统`。
- 今日计划显示在上午分组。
- 日历在每周一、三、五对应的日期下显示彩色计划条。
- 学习页在对应星期的课程表中显示计划。
- 到达 `09:30` 时发送系统通知。

### 示例二：新增每周健身计划

输入：

```json
{
  "module": "fitness",
  "title": "上肢力量训练",
  "date": "2026-11-06",
  "repeatEnabled": true,
  "repeatWeekdays": [1, 3, 5],
  "startTime": "18:30",
  "durationMinutes": 60,
  "reminderEnabled": true,
  "details": {
    "focus": "胸肩三头",
    "exercises": [
      {
        "name": "卧推",
        "sets": "4",
        "reps": "8",
        "duration": ""
      }
    ]
  }
}
```

输出：

- 健身页每周一、三、五显示训练卡片。
- 首页和今日计划自动出现对应安排。
- 日历对应日期下显示健身色计划条。
- 当日 `18:30` 发送提醒。

### 示例三：快速备忘

输入：

```text
周末前完成本周开发记录；买牛奶和咖啡豆；预约下周体检。
```

输出：

- 首页快速备忘自动保存。
- 刷新页面、关闭浏览器或重启后仍然保留。
- 云账号登录后参与云端同步。

### 示例四：意见箱

输入：

```json
{
  "category": "feature",
  "content": "希望日历可以显示每周计划的总时长。",
  "contact": "user@example.com",
  "pagePath": "#/calendar"
}
```

输出：

- 建议保存到云端 `feedback` 表。
- 管理员“查看建议”中出现新建议。
- 普通用户不能读取其他用户的建议。
- 管理员可将其标记为“已查看”或“已处理”。

### 示例五：备份文件

导出的备份是 JSON，主要结构如下：

```json
{
  "version": 1,
  "plans": [],
  "deletedPlans": [],
  "quickMemo": "",
  "quickMemoUpdatedAt": "2026-11-06T12:00:00.000Z",
  "settings": {
    "notificationsEnabled": true,
    "autoStart": false
  }
}
```

重新导入后，计划、备忘和设置会恢复到当前应用。

## 开发与验证

### 本地开发

```powershell
npm run dev
```

桌面版开发：

```powershell
npm run desktop:dev
```

开发界面：

```text
http://127.0.0.1:5173
```

本地 API：

```text
http://127.0.0.1:4318
```

### 验证命令

```powershell
npm test
npm run typecheck
npm run build
npm run visual-check
npm run e2e-check
npm run mobile-check
npm run guest-check
npm run cloud-auth-check
```

需要 Android 模拟器或真机时：

```powershell
npm run android-check
npm run android-cloud-check
```

## 数据位置

电脑本地版：

```text
%LOCALAPPDATA%\WorkLifeManager\data.json
```

网页游客版：

```text
浏览器 localStorage
```

Android 游客版：

```text
Android WebView localStorage
```

网页账号：

```text
Cloudflare D1 数据库 rixu-db
```

## 项目结构

```text
src/                  React 前端
server/               Windows 本地 Node.js 后台
electron/             Electron 桌面主进程和打包图标
functions/api/        Cloudflare Pages Functions API
cloud/schema.sql      Cloudflare D1 表结构
android/              Capacitor Android 工程
public/               图标、隐私政策和条款
scripts/              启动、构建、视觉和端到端验证脚本
tests/                Node.js 单元测试
release/              Android APK
release-desktop/      Windows 安装版和便携版
使用指南.md            面向使用者的详细操作说明
```

## 已知限制

- 公开网站当前使用 `pages.dev` 免费域名，中国大陆部分网络需要代理。
- 网页账号第一版不支持邮箱验证和自助找回密码。
- 网页关闭后的提醒尚未接入 Web Push。
- Android App 使用个人调试签名，不会自动更新。
- Windows 桌面版暂未进行代码签名，可能出现 SmartScreen 提示。
- Android“强行停止”会取消已安排的本地闹钟。
- 游客模式不会跨设备同步。
- 意见箱第一版只支持文本建议，不支持图片和附件。

更具体的日常操作说明见 [使用指南.md](./使用指南.md)。
