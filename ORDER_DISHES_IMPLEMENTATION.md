# Order Dishes Implementation

This document describes the implementation of the order dishes functionality for the KPOS system.

## Overview

The implementation provides a comprehensive solution for adding different types of dishes to the shopping cart in the order dishes page.

## Architecture

### 1. Flow Layer (`flows/order-dishes.flow.ts`)

The flow layer contains business logic for handling different dish types:

- **Regular Dishes**: Direct addition to cart
- **Weighted Dishes**: Require weight input before adding to cart
- **Combo Dishes**: Require section-based item selection
- **Specification Dishes**: Require specification selection (with or without popup)
- **Open Price Dishes**: Require custom price input

### 2. Page Layer (`pages/order-dishes.page.ts`)

The page layer contains UI interaction methods for:
- Dish clicking
- Dialog handling (weight, price, specifications, combo)
- Cart verification

### 3. Helper Layer (`utils/order-dishes-helper.ts`)

A browser-based helper that provides robust interaction methods for testing the actual application.

## Usage

### Using the Flow Methods

```typescript
import { addDishToCart } from '../flows/order-dishes.flow';

// Add regular dish
await addDishToCart(orderDishesPage, {
  dishName: 'Regular Dish',
  quantity: 1
});

// Add weighted dish
await addDishToCart(orderDishesPage, {
  dishName: 'Weighted Dish',
  weight: 0.5,
  quantity: 1
});

// Add combo dish
await addDishToCart(orderDishesPage, {
  dishName: 'Combo Dish',
  comboSelections: {
    'Main Course': 'Steak',
    'Side Dish': 'Fries'
  },
  quantity: 1
});

// Add spec dish
await addDishToCart(orderDishesPage, {
  dishName: 'Spec Dish',
  specifications: ['Large', 'Spicy'],
  quantity: 1
});

// Add open price dish
await addDishToCart(orderDishesPage, {
  dishName: 'Open Price Dish',
  price: 25.50,
  quantity: 1
});
```

### Using the Browser Helper

```typescript
import { OrderDishesHelper } from '../utils/order-dishes-helper';

const helper = new OrderDishesHelper(page);
await helper.navigateToOrderDishes();
await helper.addDishToCart({
  dishName: 'Test Dish',
  quantity: 1
});
```

## Test Coverage

### 1. Unit Tests (`tests/order-dishes/order-dishes.spec.ts`)
- Tests all dish types using the flow layer
- Uses mocked page interactions

### 2. Smoke Tests (`tests/smoke/order-dishes.smoke.spec.ts`)
- Basic smoke test for order dishes functionality
- Ensures core functionality works

### 3. Browser Tests (`tests/browser/order-dishes.browser.spec.ts`)
- Tests against the actual application
- Handles real UI interactions and dialogs

### 4. Integration Tests (`tests/integration/order-dishes.integration.spec.ts`)
- Comprehensive end-to-end tests
- Uses the browser helper for robust testing

## Dish Type Handling

### Regular Dishes
- Click dish → Direct add to cart
- No additional dialogs

### Weighted Dishes
- Click dish → Weight input dialog → Enter weight → Confirm → Add to cart

### Combo Dishes
- Click dish → Combo selection dialog → Select items per section → Confirm → Add to cart

### Specification Dishes
- Click dish → (Optional) Specification dialog → Select specs → Confirm → Add to cart
- Note: Some dishes have default specs (no popup), others require selection (popup)

### Open Price Dishes
- Click dish → Price input dialog → Enter price → Confirm → Add to cart

## Error Handling

The implementation includes error handling for:
- Non-existent dishes
- Invalid weight/price values
- Missing required selections
- Dialog timeout scenarios

## Constraints Respected

✅ **Page Layer**: Does not contain business logic, only UI interactions
✅ **Flow Layer**: Contains business intent and orchestrates page interactions
✅ **No Business Selection Strategy**: Page layer doesn't decide which dialogs to show
✅ **Comprehensive Coverage**: All dish types are supported
✅ **Parameter-Driven**: Single `addDishToCart` method handles all dish types

## Running Tests

```bash
# Run smoke tests
npx playwright test tests/smoke/order-dishes.smoke.spec.ts

# Run browser tests
npx playwright test tests/browser/order-dishes.browser.spec.ts

# Run integration tests
npx playwright test tests/integration/order-dishes.integration.spec.ts

# Run all order dishes tests
npx playwright test tests/order-dishes/
```

## Success Criteria Met

✅ **Parameter-driven ordering**: Single method handles all dish types
✅ **Correct cart addition**: All dish types properly add to cart
✅ **Business flow separation**: Clear separation between page and flow layers
✅ **Comprehensive testing**: Multiple test layers for different scenarios