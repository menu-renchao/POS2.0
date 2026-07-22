import { expect, test } from '@playwright/test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { htmlToText, PrintOutputReader, readTicketKind } from '../../../utils/print-output';

test.describe('打印文件读取工具', () => {
  test('应能识别票据类型并提取 HTML 文本', async () => {
    expect(readTicketKind('20260722-108-RECEIPT.html')).toBe('RECEIPT');
    expect(readTicketKind('20260722-108-RECEIPT-2.html')).toBe('RECEIPT');
    expect(readTicketKind('20260722-108-KITCHEN.html')).toBe('KITCHEN');
    expect(htmlToText('<span>TO GO</span><br/>普通菜1 &amp; A')).toBe('TO GO\n普通菜1 & A');
  });

  test('应能忽略目录快照中已有文件并读取新票据', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'pos-print-output-'));
    const reader = new PrintOutputReader(directory);

    try {
      await writeFile(path.join(directory, 'old-RECEIPT.html'), '<span>old</span>', 'utf8');
      const snapshot = await reader.snapshot();
      await writeFile(path.join(directory, 'new-KITCHEN.html'), '<b>普通菜1</b>', 'utf8');

      const tickets = await reader.waitForTickets({
        after: snapshot,
        kinds: ['KITCHEN'],
      });

      expect(tickets).toHaveLength(1);
      expect(tickets[0]).toMatchObject({ kind: 'KITCHEN', text: '普通菜1' });

      await mkdir(path.join(directory, 'asset.html_files'));
      await reader.clear();
      expect((await reader.snapshot()).files.size).toBe(0);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
