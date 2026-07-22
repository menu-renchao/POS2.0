# POS API 固定菜单数据清理设计

## 目标

将以下固定菜单数据纳入现有 POS API 数据库硬删除流程：

```sql
DELETE FROM `menu` where `NAME` = 'AT_MENU_MENU';
```

## 设计

- 在 `tests/api/support/menu-hard-delete-cleanup.ts` 的 `MENU_HARD_DELETE_SQL` 中追加该语句。
- 语句放在现有固定菜单名称清理之后、`COMMIT` 之前，与其他菜单清理共享同一事务。
- 不新增数据库连接、清理入口或环境配置；现有流程后清理、session 清理和 maintenance 清理都会复用更新后的 SQL。

## 测试

采用测试驱动方式修改 `tests/api/unit/api-menu-hard-delete-cleanup.unit.spec.ts`：

1. 先在 SQL 顺序期望列表中加入新语句，运行测试并确认因生产 SQL 缺少该语句而失败。
2. 再更新 `MENU_HARD_DELETE_SQL`，运行同一测试并确认通过。
3. 运行 TypeScript 校验，确认没有类型回归。

## 范围

本次只增加指定固定名称的菜单清理，不重构现有 SQL，也不连接真实数据库执行删除。
