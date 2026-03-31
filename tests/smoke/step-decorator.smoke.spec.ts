import { expect, test } from '@playwright/test';
import { step } from '../../utils/step';

class StepDecoratorProbe {
  @step((value: string) => `测试步骤：返回 ${value}`)
  async echo(value: string): Promise<string> {
    return value;
  }
}

test.describe('步骤装饰器冒烟', () => {
  test(
    '步骤装饰器不应改变原始返回值',
    {
      tag: ['@smoke'],
      annotation: [
        {
          type: 'issue',
          description: 'https://devtickets.atlassian.net/browse/POS-46668',
        },
      ],
    },
    async ({}) => {
      const probe = new StepDecoratorProbe();

      await expect(probe.echo('11')).resolves.toBe('11');
    },
  );
});
