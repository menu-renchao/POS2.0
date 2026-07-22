import type { PrintConfigApiClient } from '../clients/print-config-api.client';
import { expectOkEnvelope } from './setup-resource';

export type PrintTemplateType =
  | 'EXPIRATION'
  | 'KITCHEN'
  | 'KITCHEN_HIBACHI'
  | 'KITCHEN_LABEL'
  | 'PACKAGE'
  | 'PAYMENT'
  | 'RECEIPT'
  | 'RECEIPT_TEXT_ONLY';

export type PrintTemplate = {
  reportType: string;
  selected: boolean;
  value: string;
};

export type PrintingConfiguration = {
  footerPart2TemplateId: number | null;
  footerPart3TemplateId: number | null;
  footerPart4TemplateId: number | null;
  footerTemplateId: number | null;
  packageTicketFooterTemplateId: number | null;
  paymentReceiptFooterTemplateId: number | null;
  templates: PrintTemplate[];
  waitlistTicketFooterTemplateId: number | null;
};

type PrintingConfigurationSaveRequest = Omit<PrintingConfiguration, 'templates'> & {
  footerPart2TemplateId: number;
  footerPart3TemplateId: number;
  footerPart4TemplateId: number;
  footerTemplateId: number;
  packageTicketFooterTemplateId: number;
  paymentReceiptFooterTemplateId: number;
  templates: PrintTemplate[];
  waitlistTicketFooterTemplateId: number;
};

export type PrintConfigurationRestore = () => Promise<void>;

export type PrintConfigurationSetupService = {
  fetch: () => Promise<PrintingConfiguration>;
  selectReceiptFooterForAllParts: (
    templateId: number,
  ) => Promise<PrintConfigurationRestore>;
  selectTemplate: (
    reportType: PrintTemplateType,
    value: string,
  ) => Promise<PrintConfigurationRestore>;
};

export function createPrintConfigurationSetupService(
  api?: PrintConfigApiClient,
): PrintConfigurationSetupService {
  const requireApi = () => {
    if (!api) {
      throw new Error('printConfigApi 未配置，无法更新打印模板。');
    }
    return api;
  };

  const fetch = async (): Promise<PrintingConfiguration> => {
    const body = await expectOkEnvelope(await requireApi().fetch());
    return toPrintingConfiguration(body.data);
  };

  return {
    fetch,
    selectReceiptFooterForAllParts: async (templateId) => {
      const original = await fetch();
      const updated: PrintingConfiguration = {
        ...original,
        footerTemplateId: templateId,
        footerPart2TemplateId: templateId,
        footerPart3TemplateId: templateId,
        footerPart4TemplateId: templateId,
      };
      await expectOkEnvelope(await requireApi().save(toSaveRequest(updated)));
      const saved = await fetch();
      const savedFooterIds = [
        saved.footerTemplateId,
        saved.footerPart2TemplateId,
        saved.footerPart3TemplateId,
        saved.footerPart4TemplateId,
      ];
      if (savedFooterIds.some((savedTemplateId) => savedTemplateId !== templateId)) {
        throw new Error(
          `收据四段脚注未全部保存为模板 ${templateId}：${savedFooterIds.join(', ')}`,
        );
      }

      return async () => {
        await expectOkEnvelope(await requireApi().save(toSaveRequest(original)));
      };
    },
    selectTemplate: async (reportType, value) => {
      const original = await fetch();
      const matchingTemplates = original.templates.filter(
        (template) => template.reportType === reportType,
      );

      if (!matchingTemplates.some((template) => template.value === value)) {
        throw new Error(`打印模板 ${reportType}:${value} 不存在。`);
      }

      const updated: PrintingConfiguration = {
        ...original,
        templates: original.templates.map((template) =>
          template.reportType === reportType
            ? { ...template, selected: template.value === value }
            : template,
        ),
      };
      await expectOkEnvelope(await requireApi().save(toSaveRequest(updated)));
      const saved = await fetch();
      const selectedTemplate = saved.templates.find(
        (template) =>
          template.reportType === reportType && template.value === value && template.selected,
      );
      if (!selectedTemplate) {
        throw new Error(`打印模板 ${reportType}:${value} 保存后未成为选中项。`);
      }

      return async () => {
        await expectOkEnvelope(await requireApi().save(toSaveRequest(original)));
      };
    },
  };
}

function toSaveRequest(
  configuration: PrintingConfiguration,
): PrintingConfigurationSaveRequest {
  const selectedTemplates = configuration.templates.filter(
    (template) =>
      template.selected ||
      (template.reportType === 'EXPIRATION' && template.value === 'Default'),
  );

  return {
    footerTemplateId: configuration.footerTemplateId ?? -1,
    footerPart2TemplateId: configuration.footerPart2TemplateId ?? -1,
    footerPart3TemplateId: configuration.footerPart3TemplateId ?? -1,
    footerPart4TemplateId: configuration.footerPart4TemplateId ?? -1,
    paymentReceiptFooterTemplateId: configuration.paymentReceiptFooterTemplateId ?? -1,
    waitlistTicketFooterTemplateId: configuration.waitlistTicketFooterTemplateId ?? -1,
    packageTicketFooterTemplateId: configuration.packageTicketFooterTemplateId ?? -1,
    templates: selectedTemplates.map((template) => ({ ...template, selected: true })),
  };
}

function toPrintingConfiguration(value: unknown): PrintingConfiguration {
  if (!isRecord(value) || !Array.isArray(value.templates)) {
    throw new Error('打印模板接口未返回 data.templates 数组。');
  }

  const templates = value.templates.map((template) => {
    if (
      !isRecord(template) ||
      typeof template.reportType !== 'string' ||
      typeof template.value !== 'string' ||
      typeof template.selected !== 'boolean'
    ) {
      throw new Error('打印模板接口返回了无效模板记录。');
    }

    return {
      reportType: template.reportType,
      selected: template.selected,
      value: template.value,
    };
  });

  return {
    footerTemplateId: toNullableNumber(value.footerTemplateId),
    footerPart2TemplateId: toNullableNumber(value.footerPart2TemplateId),
    footerPart3TemplateId: toNullableNumber(value.footerPart3TemplateId),
    footerPart4TemplateId: toNullableNumber(value.footerPart4TemplateId),
    paymentReceiptFooterTemplateId: toNullableNumber(value.paymentReceiptFooterTemplateId),
    waitlistTicketFooterTemplateId: toNullableNumber(value.waitlistTicketFooterTemplateId),
    packageTicketFooterTemplateId: toNullableNumber(value.packageTicketFooterTemplateId),
    templates,
  };
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
