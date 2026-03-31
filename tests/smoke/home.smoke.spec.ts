import { openHome } from '../../flows/home.flow';
import { test } from '../../fixtures/test.fixture';

test.describe('首页冒烟', () => {
  test(
    '应能成功打开首页壳',
    {
      tag: ['@smoke'],
      annotation: [
        {
          type: 'issue',
          description: 'https://devtickets.atlassian.net/browse/POS-46667',
        },
      ],
    },
    async ({ homePage }) => {
      await openHome(homePage);
    },
  );
});
