import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../utils/step';

export type LicenseRecord = {
  name: string;
  type: string;
  status: string;
};

type LicenseRow = LicenseRecord & {
  row: Locator;
};

export class LicenseSelectionPage {
  readonly licenseInput: Locator;
  private readonly enterButton: Locator;
  private readonly titleHeaders: Locator;
  private readonly licenseRows: Locator;

  constructor(private readonly page: Page) {
    this.licenseInput = this.page.getByRole('textbox', {
      name: 'Select or create a new license!',
    });
    this.enterButton = this.page.getByText('Enter', { exact: true });
    this.titleHeaders = this.page.getByText(/^(POS LICENSE|TYPE|STATUS)$/);
    this.licenseRows = this.page.locator('.selectbx .tablebx > .skOneRow');
  }

  @step('页面操作：确认 License 选择区域已经显示')
  async expectVisible(): Promise<void> {
    await expect(this.licenseInput).toBeVisible();
    await expect(this.titleHeaders).toHaveCount(3);
    await expect(this.licenseRows.first()).toBeVisible();
  }

  @step((timeoutMs = 0) => `页面操作：判断 License 选择区域在 ${timeoutMs} 毫秒内是否可见`)
  async isVisible(timeoutMs = 0): Promise<boolean> {
    try {
      await this.licenseInput.waitFor({ state: 'visible', timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  @step((type = 'PC') => `页面操作：从 License 列表中选择一个类型为 ${type} 且未占用的 License`)
  async selectAvailableLicenseByType(type = 'PC'): Promise<LicenseRecord> {
    await this.expectVisible();
    const availableRow = await this.findAvailableLicenseRow(type);

    await availableRow.row.click();
    await expect(this.licenseInput).toHaveValue(availableRow.name);

    return {
      name: availableRow.name,
      type: availableRow.type,
      status: availableRow.status,
    };
  }

  @step('页面操作：点击 Enter 按钮提交当前选中的 License')
  async clickEnter(): Promise<void> {
    await this.enterButton.click();
  }

  @step(
    (licenseName: string, type: string, status: string) =>
      `页面操作：确认 License ${licenseName} 的类型 ${type} 状态已变为 ${status}`,
  )
  async expectLicenseStatus(
    licenseName: string,
    type: string,
    status: string,
  ): Promise<void> {
    const row = this.licenseRows
      .filter({ hasText: licenseName })
      .filter({ hasText: type })
      .first();

    await expect(row.locator(':scope > div').nth(1)).toHaveText(type);
    await expect(row.locator(':scope > div').nth(2)).toHaveText(status);
  }

  @step((type: string) => `页面操作：在 License 列表中查找类型为 ${type} 且状态为 Not in use 的记录`)
  private async findAvailableLicenseRow(type: string): Promise<LicenseRow> {
    const rowCount = await this.licenseRows.count();

    for (let index = 0; index < rowCount; index += 1) {
      const row = this.licenseRows.nth(index);
      const record = await this.readLicenseRow(row);

      if (record.type === type && record.status === 'Not in use') {
        return { ...record, row };
      }
    }

    throw new Error(`No available license found for type: ${type}`);
  }

  @step('页面操作：读取一条 License 列表行中的名称、类型和状态')
  private async readLicenseRow(row: Locator): Promise<LicenseRecord> {
    const cells = row.locator(':scope > div');
    const [name, type, status] = await Promise.all([
      this.readCellText(cells.nth(0)),
      this.readCellText(cells.nth(1)),
      this.readCellText(cells.nth(2)),
    ]);

    return { name, type, status };
  }

  @step('页面操作：读取 License 列表单元格中的文本内容')
  private async readCellText(cell: Locator): Promise<string> {
    const text = (await cell.textContent())?.trim();

    if (!text) {
      throw new Error('Encountered an empty license cell while parsing the license list.');
    }

    return text;
  }
}
