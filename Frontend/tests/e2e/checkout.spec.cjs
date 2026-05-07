const { test, expect } = require('@playwright/test');

test.describe('Checkout Flow', () => {
  test('Prevents checkout if cart total is below minimum', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Wait for products to load
    await page.waitForSelector('.product-card');

    // Add a cheap item to cart (e.g. under £5 item)
    // We'll mock the API response to guarantee a cheap item exists
    await page.route('**/api/products*', async (route) => {
      const json = {
        products: [
          {
            _id: 'test_product',
            sku: 'TEST01',
            name: 'Cheap Socks',
            salePrice: 4.99,
            quantity: 100,
            category: 'CLOTHING',
            sizes: [{ size: 'ONE SIZE', quantity: 100 }],
            imageUrl: 'https://placehold.co/100x100',
            isActive: true,
          }
        ],
        totalPages: 1,
        currentPage: 1
      };
      await route.fulfill({ json });
    });

    await page.goto('/all-products');
    
    // Add to cart
    await page.click('button:has-text("Add to Cart")');
    
    // Verify drawer opens
    await expect(page.locator('.cart-drawer')).toHaveClass(/open/);
    
    // Verify minimum order error shows
    await expect(page.locator('text=Minimum order is £300.00')).toBeVisible();
    
    // Verify checkout button is disabled
    const checkoutBtn = page.locator('button:has-text("Checkout")');
    await expect(checkoutBtn).toBeDisabled();
  });

  test('Validates MOQ quantity limits (must buy all if <= 24)', async ({ page }) => {
    await page.route('**/api/products*', async (route) => {
      const json = {
        products: [
          {
            _id: 'test_product2',
            sku: 'TEST02',
            name: 'Low Stock Shoes',
            salePrice: 50.00,
            quantity: 10, // Below 24 threshold
            category: 'FOOTWEAR',
            sizes: [{ size: '8', quantity: 10 }],
            imageUrl: 'https://placehold.co/100x100',
            isActive: true,
          }
        ],
        totalPages: 1,
        currentPage: 1
      };
      await route.fulfill({ json });
    });

    await page.route('**/api/products/config', async (route) => {
      await route.fulfill({
        json: {
          FOOTWEAR_THRESHOLD: 24,
          DEFAULT_THRESHOLD: 100,
          LOT_CATEGORIES: ["JOB LOTS", "UNDER £5"],
          MIN_ORDER_TOTAL: 300,
        }
      });
    });

    await page.goto('/all-products');
    
    // Open product modal
    await page.click('button:has-text("Add to Cart")');
    
    // Verify the quantity is locked and shows warning
    await expect(page.locator('text=Stock level (10) is below minimum order quantity (24). You must purchase all remaining stock.')).toBeVisible();
    
    // Ensure quantity input is disabled or readonly
    const qtyInput = page.locator('input[type="number"]');
    await expect(qtyInput).toHaveValue('10');
    
    // Add to cart
    await page.click('button.add-to-cart-btn');
    
    // Verify cart drawer has locked quantity
    await expect(page.locator('.cart-drawer-item-qty-input')).toHaveValue('10');
    // Ensure it's disabled
    await expect(page.locator('.cart-drawer-item-qty-input')).toBeDisabled();
  });
});
