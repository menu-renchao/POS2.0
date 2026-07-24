export type CleanupTask = readonly [
  name: string,
  cleanup: () => Promise<unknown> | unknown,
];

export async function runCleanupTasks(
  tasks: readonly CleanupTask[],
  scope: string,
): Promise<void> {
  const failures: Error[] = [];

  for (const [name, cleanup] of tasks) {
    try {
      await cleanup();
    } catch (error) {
      failures.push(
        new Error(`${scope}：${name}失败。`, {
          cause: error,
        }),
      );
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `${scope}共有 ${failures.length} 个清理任务失败。`,
    );
  }
}
