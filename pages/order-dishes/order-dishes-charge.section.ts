import { expect, type Locator } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';
import { waitUntil } from '../../utils/wait';
import {
  CANCEL_BUTTON_NAMES,
  CONFIRM_BUTTON_NAMES,
  CUSTOM_FIXED_BUTTON_NAMES,
  CUSTOM_PERCENTAGE_BUTTON_NAMES,
  CUSTOM_TAXED_LABELS,
  type ChargeCustomType,
  type ChargeOptionDraft,
  type ChargeScope,
  type ChargeState,
  type ItemChargeInfo,
  type OrderChargeSnapshot,
  type WholeOrderChargeInfo,
  WHOLE_ORDER_BUTTON_NAMES,
  ITEM_CHARGE_BUTTON_NAMES,
} from './order-dishes.types';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes-page-host';
import type { OrderDishesLocators } from './order-dishes-locators';

export class OrderDishesChargeSection {
  constructor(
    private readonly ctx: OrderDishesPageContext,
    private readonly host: OrderDishesPageHost,
  ) {}

  private get page() {
    return this.ctx.page;
  }

  private get locators(): OrderDishesLocators {
    return this.ctx.locators;
  }

  private persistedChargeState: ChargeState = this.createEmptyChargeState();
  private draftChargeState: ChargeState | null = null;
  private customChargeDraft: {
    taxed: boolean;
    type: ChargeCustomType;
    value: number | null;
  } = {
    taxed: false,
    type: 'percentage',
    value: null,
  };

    @step('页面操作：点击 Charge 并打开加收弹窗')
    async clickCharge(): Promise<void> {
      await this.host.expectLoaded();
      this.openChargeDraft();
      await (await this.resolveChargeButton()).click();
      await this.expectChargeDialogVisible();
    }

    @step('页面操作：确认加收弹窗可见')
    async expectChargeDialogVisible(): Promise<void> {
      await expect(this.locators.chargeDialog).toBeVisible();
    }

    @step('页面操作：检查加收弹窗是否可见')
    async isChargeDialogVisible(): Promise<boolean> {
      return await this.locators.chargeDialog.isVisible().catch(() => false);
    }

    @step((scope: ChargeScope) => `页面操作：切换加收模式为 ${scope === 'whole' ? '整单加收' : '菜品加收'}`)
    async switchChargeScope(scope: ChargeScope): Promise<void> {
      await this.expectChargeDialogVisible();
      await (await this.resolveChargeScopeLocator(scope)).click();
      this.ensureChargeDraft().scope = scope;
      this.ensureChargeDraft().selectedDishNames = [];
    }

    @step((dishName: string) => `页面操作：在加收弹窗中切换菜品 ${dishName}`)
    async toggleChargeDish(dishName: string): Promise<void> {
      await this.expectChargeDialogVisible();
      const dishLocator = await this.resolveChargeDishLocator(dishName);
      await dishLocator.click();

      const draft = this.ensureChargeDraft();
      if (draft.selectedDishNames.includes(dishName)) {
        draft.selectedDishNames = draft.selectedDishNames.filter(
          (currentDishName) => currentDishName !== dishName,
        );
        return;
      }

      draft.selectedDishNames = [...draft.selectedDishNames, dishName];
    }

    @step((dishName: string) => `页面断言：加收弹窗展示菜品 ${dishName}`)
    async expectChargeDishVisible(dishName: string): Promise<void> {
      await this.expectChargeDialogVisible();
      await this.resolveChargeDishLocator(dishName);
    }

    @step((optionName: string) => `页面操作：在加收弹窗中切换预置加收项 ${optionName}`)
    async toggleChargeOption(optionName: string): Promise<void> {
      await this.expectChargeDialogVisible();
      const optionLocator = await this.resolveChargeOptionLocator(optionName);
      await optionLocator.click();
      await expect(optionLocator).toHaveAttribute('aria-pressed', 'true');
      this.applyDraftChargeOption({
        kind: 'fixed',
        name: optionName,
      });
    }

    @step('页面操作：点击 Custom Charge')
    async clickCustomCharge(): Promise<void> {
      await this.expectChargeDialogVisible();
      const customChargeButton = await this.resolveCustomChargeButton();
      await customChargeButton.click();
      await expect(this.locators.customChargeDialog).toBeVisible();
    }

    @step((value: number) => `页面操作：添加当前作用域自定义百分比折扣 ${value}%`)
    async applyCustomPercentageDiscount(value: number): Promise<void> {
      await this.expectChargeDialogVisible();
      const customDiscountButton = this.page.getByTestId('pos-ui-option-__custom_discount__');
      await expect(customDiscountButton).toBeVisible();
      await customDiscountButton.click();

      const customDiscountDialog = this.resolveCustomDiscountDialog();
      await expect(customDiscountDialog).toBeVisible();

      for (const digit of String(value)) {
        await customDiscountDialog.getByTestId(`number-button-${digit}`).click();
      }

      await customDiscountDialog.getByTestId('pos-ui-segmented-option-PERCENTAGE').click();
      await waitForInputSettled(customDiscountDialog.locator('input').first());
      await customDiscountDialog.getByTestId('button-default').last().click();
      await expect(customDiscountDialog).toBeHidden();

      this.applyDraftChargeOption({
        kind: 'percentage',
        name: `Charge(${value}%)`,
        value,
      });
    }

    @step((value: number) => `页面操作：添加当前菜品固定金额折扣 $${value.toFixed(2)}`)
    async applyCustomFixedDiscount(value: number): Promise<void> {
      await this.expectChargeDialogVisible();
      const customDiscountButton = this.page.getByTestId('pos-ui-option-__custom_discount__');
      await expect(customDiscountButton).toBeVisible();
      await customDiscountButton.click();

      const customDiscountDialog = this.resolveCustomDiscountDialog();
      await expect(customDiscountDialog).toBeVisible();
      await customDiscountDialog.getByTestId('pos-ui-segmented-option-FIXED').click();

      const [wholeAmount, centAmount] = value.toFixed(2).split('.');
      for (const digit of wholeAmount) {
        await customDiscountDialog.getByTestId(`number-button-${digit}`).click();
      }

      if (centAmount === '00') {
        await customDiscountDialog.getByTestId('number-button-00').click();
      } else {
        for (const digit of centAmount) {
          await customDiscountDialog.getByTestId(`number-button-${digit}`).click();
        }
      }

      await waitForInputSettled(customDiscountDialog.locator('input').first());
      await customDiscountDialog.getByTestId('button-default').last().click();
      await expect(customDiscountDialog).toBeHidden();

      const optionName = `Charge($${value.toFixed(2)})`;
      for (const dishName of this.ensureChargeDraft().selectedDishNames) {
        const dishLocator = await this.resolveChargeDishLocator(dishName);
        await expect(dishLocator).toContainText(optionName);
        await expect(dishLocator).toContainText(`$${value.toFixed(2)}`);
      }

      this.applyDraftChargeOption({
        kind: 'fixed',
        name: optionName,
        value,
      });
    }

    @step((type: ChargeCustomType) => `页面操作：切换自定义加收类型为 ${type === 'percentage' ? '百分比' : '固定金额'}`)
    async selectCustomChargeType(type: ChargeCustomType): Promise<void> {
      await expect(this.locators.customChargeDialog).toBeVisible();
      await (await this.resolveCustomChargeTypeLocator(type)).click();
      this.customChargeDraft.type = type;
    }

    @step((value: number) => `页面操作：输入自定义加收值 ${value}`)
    async fillCustomChargeValue(value: number): Promise<void> {
      await expect(this.locators.customChargeDialog).toBeVisible();
      await this.enterCustomChargeValueByKeypad(value);

      await waitUntil(
        async () => {
          const confirmEnabled = !(await this.locators.customChargeConfirmButton.isDisabled().catch(() => true));
          return confirmEnabled;
        },
        (confirmEnabled) => confirmEnabled,
        {
          timeout: 5_000,
          message: `Custom charge value ${value} did not enable the confirm button.`,
        },
      );

      this.customChargeDraft.value = value;
    }

    @step((taxed: boolean) => `页面操作：将自定义加收含税设置为 ${taxed ? '是' : '否'}`)
    async setCustomChargeTaxed(taxed: boolean): Promise<void> {
      await expect(this.locators.customChargeDialog).toBeVisible();
      const taxedLocator = await this.resolveCustomTaxedLocator();

      if (!taxedLocator) {
        this.customChargeDraft.taxed = taxed;
        return;
      }

      const isChecked = await taxedLocator.evaluate((element) => {
        if (element instanceof HTMLInputElement) {
          return element.checked;
        }

        const ariaChecked = element.getAttribute('aria-checked');
        if (ariaChecked === 'true' || ariaChecked === 'false') {
          return ariaChecked === 'true';
        }

        return element.getAttribute('aria-pressed') === 'true';
      });

      if (isChecked !== taxed) {
        await taxedLocator.click();
      }

      this.customChargeDraft.taxed = taxed;
    }

    @step('页面操作：确认自定义加收弹窗')
    async confirmCustomChargeDialog(): Promise<void> {
      await expect(this.locators.customChargeDialog).toBeVisible();
      await waitForInputSettled(this.locators.customChargeValueInput);
      await this.locators.customChargeConfirmButton.click();
      await expect(this.locators.customChargeDialog).toBeHidden();

      const customValue = this.customChargeDraft.value ?? 0;
      this.applyDraftChargeOption({
        kind: this.customChargeDraft.type,
        name: this.formatCustomChargeName(this.customChargeDraft.type, customValue),
        taxed: this.customChargeDraft.taxed,
        value: customValue,
      });
      this.resetCustomChargeDraft();
    }

    @step('页面操作：关闭自定义加收弹窗')
    async closeCustomChargeDialog(): Promise<void> {
      if (!(await this.locators.customChargeDialog.isVisible().catch(() => false))) {
        return;
      }

      if (await this.locators.customChargeCancelButton.isVisible().catch(() => false)) {
        await this.locators.customChargeCancelButton.click();
        await expect(this.locators.customChargeDialog).toBeHidden();
        this.resetCustomChargeDraft();
        return;
      }

      await this.page.keyboard.press('Escape').catch(() => {});
      if (await this.locators.customChargeDialog.isVisible().catch(() => false)) {
        this.resetCustomChargeDraft();
        return;
      }

      this.resetCustomChargeDraft();
    }

    @step('页面操作：清除当前已选加收')
    async clearSelectedChargeEntries(): Promise<void> {
      await this.expectChargeDialogVisible();
      await this.locators.clearSelectedChargeButton.click();
      this.clearDraftSelectedChargeEntries();
    }

    @step('页面操作：清空全部加收')
    async clearAllCharges(): Promise<void> {
      await this.expectChargeDialogVisible();
      await this.locators.clearAllChargesButton.click();
      this.draftChargeState = this.createEmptyChargeState(this.ensureChargeDraft().scope);
    }

    @step('页面操作：确认加收并关闭弹窗')
    async confirmChargeDialog(): Promise<void> {
      await this.expectChargeDialogVisible();
      await this.locators.confirmChargeButton.click();
      await expect(this.locators.chargeDialog).toBeHidden();
      this.persistedChargeState = this.cloneChargeState(this.ensureChargeDraft());
      this.persistedChargeState.selectedDishNames = [];
      this.draftChargeState = null;
    }

    @step('页面操作：关闭加收弹窗并返回纯净点单页')
    async closeChargeDialog(): Promise<void> {
      if (!(await this.isChargeDialogVisible())) {
        this.draftChargeState = null;
        return;
      }

      if (await this.locators.cancelChargeButton.isVisible().catch(() => false)) {
        await this.locators.cancelChargeButton.click();
        await expect(this.locators.chargeDialog).toBeHidden();
        this.draftChargeState = null;
        return;
      }

      await this.page.keyboard.press('Escape').catch(() => {});
      if (await this.isChargeDialogVisible()) {
        this.draftChargeState = null;
        return;
      }

      this.draftChargeState = null;
    }

    @step('页面读取：读取当前加收快照')
    async readChargeSnapshot(): Promise<OrderChargeSnapshot> {
      await this.expectChargeDialogVisible();
      const activeState = this.getActiveChargeState();

      return {
        itemCharges: this.buildItemChargeSnapshot(activeState),
        scope: await this.readChargeScopeFromDom(activeState.scope),
        selectedDishNames: await this.readSelectedDishNamesFromDom(activeState.selectedDishNames),
        wholeOrderCharges: await this.readWholeOrderChargesFromDom(activeState.wholeOrderCharges),
      };
    }

    private createEmptyChargeState(scope: ChargeScope = 'whole'): ChargeState {
      return {
        itemCharges: {},
        scope,
        selectedDishNames: [],
        wholeOrderCharges: [],
      };
    }

    private cloneChargeState(state: ChargeState): ChargeState {
      return {
        itemCharges: Object.fromEntries(
          Object.entries(state.itemCharges).map(([dishName, option]) => [dishName, { ...option }]),
        ),
        scope: state.scope,
        selectedDishNames: [...state.selectedDishNames],
        wholeOrderCharges: state.wholeOrderCharges.map((option) => ({ ...option })),
      };
    }

    private openChargeDraft(): void {
      this.draftChargeState = this.cloneChargeState(this.persistedChargeState);
    }

    private ensureChargeDraft(): ChargeState {
      if (!this.draftChargeState) {
        this.openChargeDraft();
      }

      return this.draftChargeState as ChargeState;
    }

    private getActiveChargeState(): ChargeState {
      return this.cloneChargeState(this.draftChargeState ?? this.persistedChargeState);
    }

    private resetCustomChargeDraft(): void {
      this.customChargeDraft = {
        taxed: false,
        type: 'percentage',
        value: null,
      };
    }

    private applyDraftChargeOption(option: ChargeOptionDraft): void {
      const draft = this.ensureChargeDraft();

      if (draft.scope === 'whole') {
        const alreadySelected = draft.wholeOrderCharges.some(
          (currentOption) => currentOption.name === option.name,
        );

        draft.wholeOrderCharges = alreadySelected
          ? draft.wholeOrderCharges.filter((currentOption) => currentOption.name !== option.name)
          : [...draft.wholeOrderCharges, option];

        return;
      }

      if (draft.selectedDishNames.length === 0) {
        return;
      }

      for (const dishName of draft.selectedDishNames) {
        draft.itemCharges[dishName] = { ...option };
      }

      draft.selectedDishNames = [];
    }

    private clearDraftSelectedChargeEntries(): void {
      const draft = this.ensureChargeDraft();

      if (draft.scope === 'whole') {
        draft.wholeOrderCharges = [];
        return;
      }

      for (const dishName of draft.selectedDishNames) {
        delete draft.itemCharges[dishName];
      }

      draft.selectedDishNames = [];
    }

    private async readChargeScopeFromDom(fallbackScope: ChargeScope): Promise<ChargeScope> {
      const wholeButton = await this.resolveChargeScopeLocator('whole');
      const itemButton = await this.resolveChargeScopeLocator('item');

      if (await wholeButton.isVisible().catch(() => false)) {
        const wholePressed = await this.readPressedState(wholeButton);

        if (wholePressed !== null) {
          return wholePressed ? 'whole' : 'item';
        }
      }

      if (await itemButton.isVisible().catch(() => false)) {
        const itemPressed = await this.readPressedState(itemButton);

        if (itemPressed !== null) {
          return itemPressed ? 'item' : 'whole';
        }
      }

      return fallbackScope;
    }

    private async readSelectedDishNamesFromDom(
      fallbackDishNames: string[],
    ): Promise<string[]> {
      const selectedDishButtons = this.locators.chargeDialog.locator(
        '[data-dish-name][aria-pressed="true"]',
      );
      const selectedCount = await selectedDishButtons.count().catch(() => 0);

      if (selectedCount === 0) {
        return [...fallbackDishNames];
      }

      const selectedDishNames: string[] = [];

      for (let index = 0; index < selectedCount; index += 1) {
        const dishName = await selectedDishButtons.nth(index).getAttribute('data-dish-name');

        if (dishName?.trim()) {
          selectedDishNames.push(dishName.trim());
        }
      }

      return selectedDishNames;
    }

    private async readWholeOrderChargesFromDom(
      fallbackWholeOrderCharges: ChargeOptionDraft[],
    ): Promise<WholeOrderChargeInfo[]> {
      const rows = this.locators.chargeDialog.locator('[class*="_wholeOrderDiscountRow_"]');
      const rowCount = await rows.count().catch(() => 0);

      if (rowCount === 0) {
        return fallbackWholeOrderCharges.map((option) => ({
          amountText: this.resolveDraftAmountText(option),
          name: option.name,
        }));
      }

      const charges: WholeOrderChargeInfo[] = [];

      for (let index = 0; index < rowCount; index += 1) {
        const row = rows.nth(index);
        const nameText = await row
          .locator('[class*="_wholeOrderDiscountName_"]')
          .innerText()
          .catch(async () => await row.textContent());
        const amountText = await row
          .locator('[class*="_wholeOrderDiscountAmount_"]')
          .innerText()
          .catch(async () => await row.textContent());

        charges.push({
          amountText: this.normalizeAmountText(amountText),
          name: this.normalizeVisibleText(nameText),
        });
      }

      return charges.filter((charge) => charge.name);
    }

    private buildItemChargeSnapshot(state: ChargeState): ItemChargeInfo[] {
      return Object.entries(state.itemCharges)
        .map(([dishName, option]) => ({
          dishName,
          optionName: option.name,
        }))
        .sort((left, right) => left.dishName.localeCompare(right.dishName));
    }

    private resolveDraftAmountText(option: ChargeOptionDraft): string | null {
      if (option.kind === 'fixed' && typeof option.value === 'number') {
        return `$${option.value.toFixed(2)}`;
      }

      return null;
    }

    private formatCustomChargeName(type: ChargeCustomType, value: number): string {
      return type === 'percentage' ? `Add ${value}%` : `Add $${value.toFixed(2)}`;
    }

    private normalizeVisibleText(value: string | null | undefined): string {
      return String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    private normalizeAmountText(value: string | null | undefined): string | null {
      const normalizedText = this.normalizeVisibleText(value);
      const matchedAmount = normalizedText.match(/\$[\d,.]+/);
      return matchedAmount?.[0] ?? null;
    }

    private async readPressedState(locator: Locator): Promise<boolean | null> {
      const ariaPressed = await locator.getAttribute('aria-pressed').catch(() => null);

      if (ariaPressed === 'true' || ariaPressed === 'false') {
        return ariaPressed === 'true';
      }

      const ariaSelected = await locator.getAttribute('aria-selected').catch(() => null);

      if (ariaSelected === 'true' || ariaSelected === 'false') {
        return ariaSelected === 'true';
      }

      const ariaChecked = await locator.getAttribute('aria-checked').catch(() => null);

      if (ariaChecked === 'true' || ariaChecked === 'false') {
        return ariaChecked === 'true';
      }

      return null;
    }

    private async resolveChargeScopeLocator(scope: ChargeScope): Promise<Locator> {
      if (scope === 'item') {
        const itemScope = this.locators.chargeDialog.getByTestId(
          'pos-ui-segmented-option-item',
        );
        await expect(itemScope).toBeVisible();
        return itemScope;
      }

      const buttonNames =
        scope === 'whole' ? WHOLE_ORDER_BUTTON_NAMES : ITEM_CHARGE_BUTTON_NAMES;
      const scopeKey = scope === 'whole' ? 'whole' : 'item';

      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.chargeDialog
            .locator(
              `[data-testid="charge-scope-${scopeKey}"], [data-test-id="charge-scope-${scopeKey}"]`,
            )
            .first(),
          this.locators.chargeDialog.getByRole('radio', { name: buttonNames }).first(),
          this.locators.chargeDialog.getByRole('button', { name: buttonNames }).first(),
        ],
        `Unable to find the ${scopeKey} charge scope control.`,
      );
    }

    private async resolveChargeDishLocator(dishName: string): Promise<Locator> {
      const dishLocator = this.locators.chargeDialog
        .getByTestId('pos-ui-dish-item')
        .filter({ hasText: dishName })
        .first();
      await expect(dishLocator).toBeVisible();
      return dishLocator;
    }

    private async resolveChargeButton(): Promise<Locator> {
      const candidates = [
        this.locators.appFrame
          .locator(
            '[data-testid="icon-button-charge"], [data-test-id="icon-button-charge"], [data-testid="charge-button"], [data-test-id="charge-button"]',
          )
          .first(),
        this.locators.appFrame.getByTestId('bottom-more-action-addprc'),
        this.locators.chargeButton,
        this.ctx.page.getByRole('button', { name: /^(Charge|加收)$/ }).first(),
        this.ctx.page.getByRole('menuitem', { name: /^(Charge|加收)$/ }).first(),
        this.locators.appFrame.getByRole('menuitem', { name: /^(Charge|加收)$/ }).first(),
      ];

      const directChargeButton = await this.ctx.findVisibleLocator(candidates);
      if (directChargeButton) {
        return directChargeButton;
      }

      const moreActionButton = await this.ctx.findVisibleLocator([
        this.locators.moreActionButton,
        this.ctx.page.getByRole('button', { name: /^(More|更多)$/ }).first(),
      ]);

      if (moreActionButton) {
        await moreActionButton.click();
        const chargeButtonAfterMore = await waitUntil(
          async () => await this.ctx.findVisibleLocator(candidates),
          (chargeButton): chargeButton is Locator => chargeButton !== null,
          {
            timeout: 3_000,
            message: 'Charge button did not appear after opening More menu.',
          },
        ).catch(() => null);

        if (chargeButtonAfterMore) {
          return chargeButtonAfterMore;
        }
      }

      throw new Error('Unable to find the charge button on the order page.');
    }

    private resolveCustomDiscountDialog(): Locator {
      return this.page
        .locator('[role="dialog"]')
        .filter({
          has: this.page.getByTestId('pos-ui-segmented-option-PERCENTAGE'),
        })
        .last();
    }

    private async resolveChargeOptionLocator(optionName: string): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.chargeDialog.getByRole('button', { name: optionName, exact: true }).first(),
          this.locators.chargeDialog.locator(`[data-option-name="${optionName}"]`).first(),
        ],
        `Unable to find charge option button: ${optionName}.`,
      );
    }

    private async resolveCustomChargeButton(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.chargeDialog.getByRole('button', {
            name: /^(Custom Charge|自定义加费|自定义加收)$/,
          }).first(),
          this.locators.chargeDialog.locator('[data-action="custom-charge"]').first(),
        ],
        'Unable to find the custom charge button.',
      );
    }

    private async resolveCustomTaxedLocator(): Promise<Locator | null> {
      const candidates = [
        this.locators.customChargeDialog.getByLabel(CUSTOM_TAXED_LABELS).first(),
        this.locators.customChargeDialog.getByRole('button', { name: CUSTOM_TAXED_LABELS }).first(),
        this.locators.customChargeDialog.locator('[data-action="taxed"]').first(),
      ];

      for (const candidate of candidates) {
        if (await candidate.isVisible().catch(() => false)) {
          return candidate;
        }
      }

      return null;
    }

    private async resolveCustomChargeTypeLocator(type: ChargeCustomType): Promise<Locator> {
      const buttonNames =
        type === 'percentage' ? CUSTOM_PERCENTAGE_BUTTON_NAMES : CUSTOM_FIXED_BUTTON_NAMES;
      const typeKey = type === 'percentage' ? 'percentage' : 'fixed';

      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.customChargeDialog
            .locator(
              `[data-testid="custom-charge-type-${typeKey}"], [data-test-id="custom-charge-type-${typeKey}"]`,
            )
            .first(),
          this.locators.customChargeDialog.getByRole('radio', { name: buttonNames }).first(),
          this.locators.customChargeDialog.getByRole('button', { name: buttonNames }).first(),
        ],
        `Unable to find the ${typeKey} custom charge type control.`,
      );
    }

    private async enterCustomChargeValueByKeypad(value: number): Promise<void> {
      const keypadValueText =
        this.customChargeDraft.type === 'fixed'
          ? Number(value)
              .toFixed(2)
              .replace('.', '')
              .replace(/^0+(?=\d)/, '')
          : String(value);
      const clearButton = this.locators.customChargeDialog
        .getByRole('button', { name: 'C', exact: true })
        .first();
      if (await clearButton.isVisible().catch(() => false)) {
        await clearButton.click();
      }

      for (const char of keypadValueText) {
        await this.locators.customChargeDialog
          .getByRole('button', { name: char, exact: true })
          .first()
          .click();
      }
    }
}
