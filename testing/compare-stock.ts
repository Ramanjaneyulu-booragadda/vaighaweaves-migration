/**
 * Parallel API Comparison Test: Stock/Inventory
 *
 * Verifies stock levels match between old and new systems.
 * This is CRITICAL - stock discrepancies = revenue loss.
 */

import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const OLD_API = process.env.OLD_API_URL || 'http://localhost:5001/api';
const NEW_API = process.env.NEW_API_URL || 'http://localhost:9000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

interface StockComparison {
  productId: string;
  variantId: string;
  oldStock: number;
  newStock: number;
  diff: number;
  match: boolean;
}

/**
 * Get all products with stock from old API
 */
async function getOldStock(): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();

  try {
    const response = await axios.get(`${OLD_API}/products?limit=1000`);
    const products = response.data.products;

    for (const product of products) {
      // Old system has dual stock (Product.stockQty + ProductImage.stockQty)
      // We'll use Product.stockQty as the source of truth for comparison
      stockMap.set(product.id, product.stockQty || 0);

      // Also track variant/size-specific stock if available
      if (product.images && Array.isArray(product.images)) {
        for (const image of product.images) {
          if (image.sizes && Array.isArray(image.sizes)) {
            for (const size of image.sizes) {
              const key = `${product.id}-${image.id}-${size.size}`;
              stockMap.set(key, size.stockQty || 0);
            }
          }
        }
      }
    }

    console.log(chalk.gray(`  Loaded ${stockMap.size} stock entries from old API`));
    return stockMap;
  } catch (error: any) {
    console.error(chalk.red('  ❌ Failed to fetch old stock:'), error.message);
    throw error;
  }
}

/**
 * Get all products with stock from new Medusa API
 */
async function getNewStock(): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();

  try {
    const response = await axios.get(`${NEW_API}/store/products?limit=1000`);
    const products = response.data.products;

    for (const product of products) {
      // Medusa single source of truth: product_variant.inventory_quantity
      if (product.variants && Array.isArray(product.variants)) {
        for (const variant of product.variants) {
          stockMap.set(variant.id, variant.inventory_quantity || 0);

          // Also map by product ID for comparison
          stockMap.set(product.id, variant.inventory_quantity || 0);
        }
      }
    }

    console.log(chalk.gray(`  Loaded ${stockMap.size} stock entries from new API`));
    return stockMap;
  } catch (error: any) {
    console.error(chalk.red('  ❌ Failed to fetch new stock:'), error.message);
    throw error;
  }
}

/**
 * Compare stock levels
 */
async function compareStock(): Promise<StockComparison[]> {
  console.log(chalk.blue('\n📊 Comparing stock levels...'));

  const [oldStock, newStock] = await Promise.all([
    getOldStock(),
    getNewStock()
  ]);

  const comparisons: StockComparison[] = [];
  let matches = 0;
  let discrepancies = 0;

  // Compare each product
  for (const [productId, oldQty] of oldStock.entries()) {
    const newQty = newStock.get(productId) || 0;
    const diff = Math.abs(oldQty - newQty);
    const match = diff === 0;

    if (match) {
      matches++;
    } else {
      discrepancies++;
    }

    comparisons.push({
      productId,
      variantId: productId,
      oldStock: oldQty,
      newStock: newQty,
      diff,
      match
    });
  }

  // Report summary
  console.log(chalk.cyan(`\n  Total products checked: ${comparisons.length}`));
  console.log(chalk.green(`  ✅ Matching: ${matches} (${((matches / comparisons.length) * 100).toFixed(1)}%)`));
  console.log(chalk.red(`  ❌ Discrepancies: ${discrepancies} (${((discrepancies / comparisons.length) * 100).toFixed(1)}%)`));

  // Show top 10 discrepancies
  if (discrepancies > 0) {
    console.log(chalk.yellow(`\n  Top 10 stock discrepancies:`));
    const topDiscrepancies = comparisons
      .filter(c => !c.match)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 10);

    topDiscrepancies.forEach((c, i) => {
      console.log(chalk.yellow(`    ${i + 1}. Product ${c.productId}: Old=${c.oldStock}, New=${c.newStock}, Diff=${c.diff}`));
    });
  }

  return comparisons;
}

/**
 * Test stock reservation (race condition test)
 */
async function testStockReservation() {
  console.log(chalk.blue('\n🔒 Testing stock reservation (race condition)...'));

  try {
    // Get first available product
    const response = await axios.get(`${NEW_API}/store/products?limit=1`);
    const product = response.data.products[0];
    const variantId = product.variants[0].id;
    const initialStock = product.variants[0].inventory_quantity;

    console.log(chalk.gray(`  Product: ${product.title}`));
    console.log(chalk.gray(`  Initial stock: ${initialStock}`));

    // Create 2 carts simultaneously
    const [cart1, cart2] = await Promise.all([
      axios.post(`${NEW_API}/store/carts`),
      axios.post(`${NEW_API}/store/carts`)
    ]);

    // Try to add same item to both carts simultaneously (simulates race condition)
    const [result1, result2] = await Promise.allSettled([
      axios.post(`${NEW_API}/store/carts/${cart1.data.cart.id}/line-items`, {
        variant_id: variantId,
        quantity: initialStock  // Try to reserve ALL stock
      }),
      axios.post(`${NEW_API}/store/carts/${cart2.data.cart.id}/line-items`, {
        variant_id: variantId,
        quantity: 1
      })
    ]);

    // One should succeed, one should fail (or both should get partial)
    const successes = [result1, result2].filter(r => r.status === 'fulfilled').length;
    const failures = [result1, result2].filter(r => r.status === 'rejected').length;

    console.log(chalk.gray(`  Cart 1: ${result1.status === 'fulfilled' ? '✅ Added' : '❌ Failed'}`));
    console.log(chalk.gray(`  Cart 2: ${result2.status === 'fulfilled' ? '✅ Added' : '❌ Failed'}`));

    // Verify stock after reservation
    const afterResponse = await axios.get(`${NEW_API}/store/products/${product.id}`);
    const afterStock = afterResponse.data.product.variants[0].inventory_quantity;

    console.log(chalk.gray(`  Stock after: ${afterStock}`));

    if (successes === 2 && afterStock < 0) {
      console.log(chalk.red('  ❌ CRITICAL: Overselling detected! Stock went negative!'));
      return false;
    } else if (successes === 1 || (successes === 2 && afterStock >= 0)) {
      console.log(chalk.green('  ✅ Race condition handled correctly!'));
      return true;
    } else {
      console.log(chalk.yellow('  ⚠️  Unexpected result'));
      return false;
    }
  } catch (error: any) {
    console.error(chalk.red('  ❌ Test failed:'), error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log(chalk.bold.cyan('\n========================================'));
  console.log(chalk.bold.cyan('  VaighaWeaves Migration: Stock Comparison'));
  console.log(chalk.bold.cyan('========================================\n'));

  let allPassed = true;

  // Test 1: Stock level comparison
  const comparisons = await compareStock();
  const stockMatch = comparisons.every(c => c.match);

  if (!stockMatch) {
    console.log(chalk.red('\n❌ Stock levels do not match between systems!'));
    allPassed = false;
  } else {
    console.log(chalk.green('\n✅ All stock levels match!'));
  }

  // Test 2: Race condition test
  const raceConditionPassed = await testStockReservation();
  if (!raceConditionPassed) {
    allPassed = false;
  }

  // Save results
  const fs = require('fs');
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filename = `./results/stock-comparison-${timestamp}.json`;

  if (!fs.existsSync('./results')) {
    fs.mkdirSync('./results');
  }

  fs.writeFileSync(filename, JSON.stringify({
    timestamp,
    stockComparisons: comparisons,
    raceConditionTest: raceConditionPassed,
    summary: {
      total: comparisons.length,
      matches: comparisons.filter(c => c.match).length,
      discrepancies: comparisons.filter(c => !c.match).length,
      allPassed
    }
  }, null, 2));

  console.log(chalk.gray(`\nResults saved to: ${filename}\n`));

  // Exit
  if (allPassed) {
    console.log(chalk.bold.green('✅ All stock tests passed!\n'));
    process.exit(0);
  } else {
    console.log(chalk.bold.red('❌ Some stock tests failed!\n'));
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error(chalk.red('\n❌ Fatal error:'), error);
  process.exit(1);
});
