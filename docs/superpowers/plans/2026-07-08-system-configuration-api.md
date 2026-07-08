# System Configuration API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable Playwright API setup entry that updates POS system configuration by configuration name.

**Architecture:** Add a low-level API client for `/api/system/configuration/*`, then add a setup service that reads the admin configuration list as the runtime name/id/type index. Tests call the setup service instead of hard-coding cookies or IDs.

**Tech Stack:** Playwright Test, TypeScript, existing `APIRequestContext`, existing API fixture and setup service patterns.

## Global Constraints

- 回复和新增测试标题、步骤保持中文。
- API 调用继续使用现有 `apiRequest` 登录体系，不保存浏览器 Cookie。
- 配置 ID 从 `list?fetchDetails=true&adminRequest=true` 运行时解析。
- 更新响应必须检查 `failedSystemConfigurationIds`。
- 生产代码先有失败测试，再实现。

---

### Task 1: Add System Configuration Client

**Files:**
- Create: `api/clients/system-configuration-api.client.ts`
- Modify: `fixtures/api.fixture.ts`
- Modify: `tests/api/unit/api-fixture.unit.spec.ts`

**Interfaces:**
- Produces: `SystemConfigurationApiClient`
- Methods:
  - `listSystemConfigurations(params?: ApiQueryParams): Promise<APIResponse>`
  - `fetchSystemConfiguration(params: ApiQueryParams): Promise<APIResponse>`
  - `updateSystemConfigurations(data: ApiRequestData): Promise<APIResponse>`

- [ ] Write a failing fixture/client test that expects `systemConfigurationApi` injection.
- [ ] Run the targeted fixture test and confirm it fails because the client is missing.
- [ ] Implement the client and fixture injection.
- [ ] Re-run the targeted fixture test and confirm it passes.

### Task 2: Add Setup Service For Name-Based Updates

**Files:**
- Create: `api/setup/system-configuration.setup.ts`
- Modify: `api/setup/api-setup.ts`
- Modify: `tests/api/unit/api-setup-service.unit.spec.ts`

**Interfaces:**
- Produces: `SystemConfigurationSetupService`
- Methods:
  - `listIndex(): Promise<Map<string, SystemConfigurationIndexEntry>>`
  - `updateManyByName(values: Record<string, SystemConfigurationInputValue>, options?: SystemConfigurationUpdateOptions): Promise<SystemConfigurationRestore>`
  - `updateByName(name: string, value: SystemConfigurationInputValue, options?: SystemConfigurationUpdateOptions): Promise<SystemConfigurationRestore>`

- [ ] Write a failing setup-service test for batch update by name.
- [ ] Write a failing setup-service test for restore behavior.
- [ ] Write a failing setup-service test for failed update IDs.
- [ ] Implement index loading, type conversion, update payload construction, verification, and restore.
- [ ] Re-run the setup-service tests and confirm they pass.

### Task 3: Final Verification

**Files:**
- Test-only verification across changed API unit tests.

- [ ] Run `npx playwright test tests/api/unit/api-fixture.unit.spec.ts tests/api/unit/api-setup-service.unit.spec.ts`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Fix any failures within the system configuration implementation scope.
