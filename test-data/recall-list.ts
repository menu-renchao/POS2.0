export const RecallDatePresets = {
  today: 'today',
  yesterday: 'yesterday',
  thisWeek: 'this-week',
  lastWeek: 'last-week',
  thisMonth: 'this-month',
  lastMonth: 'last-month',
} as const;

export type RecallDatePreset = (typeof RecallDatePresets)[keyof typeof RecallDatePresets];

export const RecallSortableColumns = {
  orderNumber: 'orderNo',
  type: 'type',
  total: 'total',
  time: 'time',
} as const;

export type RecallSortableColumn =
  (typeof RecallSortableColumns)[keyof typeof RecallSortableColumns];

export type RecallSortDirection = 'ascending' | 'descending';

export type RecallDateRange = {
  start: string;
  end: string;
};

export const recallDeliveryDriverCase = {
  customer: {
    address: 'wqeyt',
    phoneNumber: '9342219952',
  },
  initialDriver: 'driver1',
  targetDriver: 'driver2',
  expectedFormattedPhone: '(934)221-9952',
} as const;

function formatRecallDate(date: Date): string {
  return [
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    date.getFullYear(),
  ].join('/');
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function buildExpectedRecallPresetRange(
  preset: RecallDatePreset,
  now = new Date(),
): RecallDateRange {
  const today = startOfDay(now);
  let start = today;
  let end = today;

  switch (preset) {
    case RecallDatePresets.today:
      break;
    case RecallDatePresets.yesterday:
      start = addDays(today, -1);
      end = start;
      break;
    case RecallDatePresets.thisWeek:
      start = addDays(today, -today.getDay());
      break;
    case RecallDatePresets.lastWeek:
      end = addDays(today, -today.getDay() - 1);
      start = addDays(end, -6);
      break;
    case RecallDatePresets.thisMonth:
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case RecallDatePresets.lastMonth:
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
  }

  return {
    start: formatRecallDate(start),
    end: formatRecallDate(end),
  };
}
