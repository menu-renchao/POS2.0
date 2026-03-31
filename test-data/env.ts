export const appConfig = {
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://192.168.0.89:22080',
  homePath: '/kpos/front2/myhome.html',
  homeTitle: '8Pos',
} as const;
