export const inventoryMenu = {
  group: 'Group 001',
  category: 'Category 001',
} as const;

export const inventoryDishes = {
  supermanItem4: {
    name: 'superman item4',
    menu: inventoryMenu,
    price: 8,
  },
} as const;

export function inventoryStockLabel(remaining: number): string {
  return `Stock: ${remaining}`;
}

export function inventoryInsufficientStockAlert(itemName: string, remaining: number): string {
  return `Insufficient stock, please modify the order.\n${itemName}: ${remaining} remaining.`;
}
