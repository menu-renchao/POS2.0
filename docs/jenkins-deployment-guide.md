# POS 2.0 UI 自动化测试 — Jenkins 集成部署指南

## 一、环境准备

### 1. Jenkins Agent 机器前置条件

在 Jenkins Agent（即执行构建的 Windows 机器）上手动安装：

| 软件 | 版本要求 | 验证命令 |
|------|---------|---------|
| **Node.js** | 20.x LTS（推荐 v20.19.2） | `node --version` |
| **npm** | 随 Node.js 自带 | `npm --version` |
| **Chrome 浏览器** | 最新稳定版 | 双击打开验证 |

> 不需要安装 NodeJS Plugin，Jenkinsfile 直接通过 `bat` 调用本机的 `node` / `npm`。

### 2. Jenkins 插件安装

进入 `Manage Jenkins` -> `Plugins` -> `Available plugins`，安装以下插件：

| 插件名称 | 用途 |
|---------|------|
| **Allure Jenkins Plugin** | 测试报告展示 |
| **Pipeline** | 流水线支持（通常已预装） |

### 3. Allure 工具配置

进入 `Manage Jenkins` -> `Tools` -> `Allure Commandline installations`：

- **Name**: `allure`
- 勾选 `Install automatically`
- **Version**: `2.24.0`（或最新）

### 4. Git 代理配置（如需访问 GitHub）

```powershell
git config --global http.proxy http://127.0.0.1:7897
git config --global https.proxy http://127.0.0.1:7897
```

---

## 二、Jenkins Job 创建步骤

### 1. 新建 Job

1. 进入 Jenkins 首页 -> `New Item`
2. 输入任务名称，如 `pos2.0-ui-test`
3. 选择 `Pipeline`，点击 `OK`

### 2. 配置 General 参数

勾选 `This project is parameterised`，点击 `Add Parameter`，依次添加：

| 参数类型 | Name | Default Value | Description |
|---------|------|---------------|-------------|
| String Parameter | `PLAYWRIGHT_BASE_URL` | `http://192.168.247:22080` | Target server URL |
| Choice Parameter | `TEST_SUITE` | `smoke` | Options: `all`, `smoke`, `e2e`, `py-migrate` |
| Boolean Parameter | `HEADED` | `false` | Run in headed mode (for debugging) |

### 3. 配置 Pipeline

1. **Definition**: 选择 `Pipeline script from SCM`
2. **SCM**: 选择 `Git`
3. **Repository URL**: 填入 Git 仓库地址
4. **Branches to build**: `*/main`（或目标分支）
5. **Script Path**: `Jenkinsfile`

### 4. 保存并构建

1. 点击 `Save`
2. 点击 `Build with Parameters`
3. 填写参数后点击 `Build`

---

## 三、关键文件说明

| 文件 | 作用 |
|------|------|
| `Jenkinsfile` | 流水线定义，包含参数化构建、依赖安装、测试执行、报告生成 |
| `test-data/env.ts` | 读取 `PLAYWRIGHT_BASE_URL` 环境变量，默认 `http://192.168.247:22080` |
| `playwright.config.ts` | CI 环境下自动切换 headless 模式 |

### 环境变量传递链路

```
Jenkins 参数 PLAYWRIGHT_BASE_URL
        ↓
Jenkinsfile environment 块
        ↓
系统环境变量 process.env.PLAYWRIGHT_BASE_URL
        ↓
test-data/env.ts 读取并赋值给 appConfig.baseURL
        ↓
playwright.config.ts 的 use.baseURL
```

---

## 四、流水线执行流程

```
Checkout → Check Environment → Install Dependencies → Run Tests → Generate Allure Report → Archive Artifacts
```

| 阶段 | 执行内容 |
|------|---------|
| **Checkout** | 拉取 Git 仓库代码 |
| **Check Environment** | 验证 Node.js 和 npm 是否可用 |
| **Install Dependencies** | `npm ci` 安装项目依赖 |
| **Run Tests** | 通过 `node node_modules/playwright/cli.js test` 执行测试 |
| **Generate Allure Report** | 自动生成可视化测试报告 |
| **Archive Artifacts** | 归档 `test-results` 和 `allure-results` |

> 注意：测试执行使用 `node node_modules/playwright/cli.js` 而非 `npx playwright`，因为 npx 在某些 Windows/Jenkins 环境下存在模块加载问题。

---

## 五、切换目标地址

每次构建时在参数 `PLAYWRIGHT_BASE_URL` 中填入不同地址：

| 环境 | 地址示例 |
|------|---------|
| 测试环境 | `http://192.168.247:22080` |
| 预发布环境 | `http://192.168.0.100:22080` |
| 本地开发 | `http://localhost:22080` |

---

## 六、注意事项

1. **Jenkins Agent 系统**：Jenkinsfile 使用 `bat` 命令，Agent 必须是 Windows 机器。如为 Linux Agent，需将 `bat` 改为 `sh`。

2. **Chrome 浏览器**：Jenkins Agent 机器上需安装 Chrome。如无法安装，可修改 `playwright.config.ts` 移除 `channel: 'chrome'`，改用 Playwright 自带的 Chromium。

3. **查看 Allure 报告**：构建完成后，在 Job 页面点击 `Allure Report` 查看可视化测试报告。

4. **headless 模式**：`playwright.config.ts` 已配置在 CI 环境下自动使用 headless 模式，无需额外处理。

5. **构建日志排查**：构建失败时，点击构建编号 -> `Console Output` 查看详细日志。

---

## 七、常见问题

### 1. 插件安装报错 `另一个程序正在使用此文件`

Windows 上 Jenkins 安装/更新插件时，JAR 文件可能被 JVM 锁定。解决步骤：

```powershell
net stop Jenkins
Remove-Item -Recurse -Force "C:\Users\administrator\Jenkins\.jenkins\plugins\config-file-provider"
Remove-Item -Recurse -Force "C:\Users\administrator\Jenkins\.jenkins\plugins\nodejs"
net start Jenkins
```

### 2. `node` 或 `npm` 命令找不到

Jenkins 服务可能未加载最新的系统 PATH。两种解决方式：

- **方式 A**：在 Jenkinsfile 的 `environment` 块中显式添加 Node.js 路径（已默认配置）：
  ```groovy
  PATH = "C:\\Program Files\\nodejs;${env.PATH}"
  ```

- **方式 B**：重启 Jenkins 服务，使其加载最新的系统环境变量。

### 3. Allure 报告为空

确认 `allure-playwright` 依赖已安装，且 `playwright.config.ts` 中 reporter 配置了 `allure-playwright`。

### 4. `npx playwright` 报错 `test.describe() to be called here`

在某些 Windows + Jenkins 环境下，`npx` 会导致 Playwright 模块加载异常。Jenkinsfile 已使用 `node node_modules/playwright/cli.js` 替代 `npx playwright`，避免此问题。如在其他环境遇到同样问题，同样使用 `node node_modules/playwright/cli.js test` 替代 `npx playwright test`。

### 5. Jenkins 中文乱码

在 `C:\Program Files\Jenkins\Jenkins.xml` 的 `<arguments>` 中添加 `-Dfile.encoding=UTF-8`，然后重启 Jenkins：
```powershell
net stop Jenkins
net start Jenkins
```

### 6. Git 连接 GitHub 失败

配置代理：
```powershell
git config --global http.proxy http://127.0.0.1:7897
git config --global https.proxy http://127.0.0.1:7897
```
