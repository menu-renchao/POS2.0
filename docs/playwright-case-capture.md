# Playwright 用例证据采集器

当 Codex 缺少真实 DOM、iframe 或网络契约时，不必再完整录制并手工复制 Codegen 脚本。采集器会打开固定 POS 首页，记录人工操作，并把可继续整理的证据自动保存到本地。

## 使用方法

在项目根目录运行：

```powershell
npm.cmd run capture:case -- POS-16324
```

也可以先只检查输出目录，不打开浏览器：

```powershell
npm.cmd run capture:case -- POS-16324 --dry-run
```

浏览器和 Playwright Inspector 打开后：

1. 只操作当前用例缺失的业务步骤，不必重复录制已有登录、员工上下文或公共导航。
2. 在目标结果页面停下，保留最终状态。
3. 在 Playwright Inspector 中点击 `Resume`。采集器随后保存证据并关闭浏览器。
4. 把终端显示的采集目录路径和主要校验点发给 Codex。

直接关闭浏览器也会尽量保存已经收到的操作，但 Trace 和 HAR 可能不完整，因此推荐使用 `Resume` 正常结束。

## 自动生成内容

每次运行都会创建独立目录：

```text
playwright-captures/<用例编号>/<UTC 时间>/
├─ evidence.md               证据说明和完成状态
├─ recorded.spec.ts          根据真实操作生成的 Playwright 草稿
├─ actions.json              原始操作和 iframe 路径
├─ trace.zip                 页面快照、截图和源码 Trace
├─ network.har               最小 HAR，不包含响应正文
├─ network-summary.json      XHR、fetch、失败请求和异常状态摘要
├─ visible-dom.json          最终页面可见的 data-testid 契约
├─ final.png                 最终页面截图
├─ console.log               控制台和页面异常
└─ metadata.json             用例编号、入口和采集状态
```

采集脚本优先生成 `getByTestId`，其次使用 label、role 和可见文本；iframe 会尽量记录为 `#容器 iframe`。`recorded.spec.ts` 是证据草稿，Codex 仍会按仓库规则把定位放入 Page、业务编排放入 Flow，并补充正式断言。

## 隐私和提交规则

- `playwright-captures/` 已加入 `.gitignore`，不会被普通 Git 提交带入仓库。
- HAR 默认使用 `minimal + omit`，不保存响应正文。
- Trace、截图、输入值和控制台仍可能包含测试环境中的客户信息。只在本机和获准范围内传递整个采集目录。
- 密码输入会在操作草稿中替换为 `<MASKED>`。
- 如需分析真实请求正文，应针对单个接口另行授权和采集，不应把完整生产数据加入仓库。

## 适用边界

优先使用采集器处理稳定 DOM、iframe、配置开关、请求状态和最终页面回显。只有动画、拖拽、遮挡或短暂自动关闭等必须观察时间过程的问题，才补充一段短视频。
