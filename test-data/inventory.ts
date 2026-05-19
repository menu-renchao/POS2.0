export const inventoryMenu = {
  group: 'Lunch',
  category: 'Chicken Lunch E',
  groupTestId: 'menu-group-card-grp_67',
  categoryTestId: 'menu-category-card-ctg_4863',
  inventoryCategoryPanelId: 'cty_4863',
  dishTestId: 'menu-item-card-dsh1_112_36627',
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
