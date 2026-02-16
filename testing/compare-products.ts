/**
 * Parallel API Comparison Test: Products
 *
 * Compares responses from old Express API vs new Medusa API
 * to ensure data parity during migration.
 */

import axios from 'axios';
import * as diff from 'diff';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

// API URLs
const OLD_API = process.env.OLD_API_URL || 'http://localhost:5001/api';
const NEW_API = process.env.NEW_API_URL || 'http://localhost:9000/store';

interface ComparisonResult {
  endpoint: string;
  old: any;
  new: any;
  diff: any[];
  match: boolean;
}

/**
 * Deep comparison of two objects
 */
function deepCompare(obj1: any, obj2: any, path: string = 'root'): any[] {
  const differences: any[] = [];

  if (typeof obj1 !== typeof obj2) {
    differences.push({
      path,
      type: 'type_mismatch',
      old: typeof obj1,
      new: typeof obj2
    });
    return differences;
  }

  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) {
      differences.push({
        path,
        type: 'array_length',
        old: obj1.length,
        new: obj2.length
      });
    }

    const minLength = Math.min(obj1.length, obj2.length);
    for (let i = 0; i < minLength; i++) {
      differences.push(...deepCompare(obj1[i], obj2[i], `${path}[${i}]`));
    }
  } else if (typeof obj1 === 'object' && obj1 !== null && obj2 !== null) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    const allKeys = new Set([...keys1, ...keys2]);

    for (const key of allKeys) {
      if (!(key in obj1)) {
        differences.push({
          path: `${path}.${key}`,
          type: 'missing_in_old',
          new: obj2[key]
        });
      } else if (!(key in obj2)) {
        differences.push({
          path: `${path}.${key}`,
          type: 'missing_in_new',
          old: obj1[key]
        });
      } else {
        differences.push(...deepCompare(obj1[key], obj2[key], `${path}.${key}`));
      }
    }
  } else if (obj1 !== obj2) {
    differences.push({
      path,
      type: 'value_mismatch',
      old: obj1,
      new: obj2
    });
  }

  return differences;
}

/**
 * Test 1: Get all products (paginated)
 */
async function testGetProducts(): Promise<ComparisonResult> {
  console.log(chalk.blue('\n📦 Testing: GET /products'));

  try {
    const [oldResponse, newResponse] = await Promise.all([
      axios.get(`${OLD_API}/products?page=1&limit=20`),
      axios.get(`${NEW_API}/products?limit=20&offset=0`)
    ]);

    const oldProducts = oldResponse.data.products;
    const newProducts = newResponse.data.products;

    // Compare counts
    console.log(`  Old API: ${oldProducts.length} products`);
    console.log(`  New API: ${newProducts.length} products`);

    // Deep compare first product
    if (oldProducts.length > 0 && newProducts.length > 0) {
      const differences = deepCompare(oldProducts[0], newProducts[0]);

      if (differences.length === 0) {
        console.log(chalk.green('  ✅ Products match!'));
        return {
          endpoint: 'GET /products',
          old: oldProducts,
          new: newProducts,
          diff: [],
          match: true
        };
      } else {
        console.log(chalk.red(`  ❌ Found ${differences.length} differences:`));
        differences.slice(0, 5).forEach(d => {
          console.log(chalk.yellow(`    ${d.path}: ${d.type}`));
        });
        return {
          endpoint: 'GET /products',
          old: oldProducts,
          new: newProducts,
          diff: differences,
          match: false
        };
      }
    }

    return {
      endpoint: 'GET /products',
      old: oldProducts,
      new: newProducts,
      diff: [],
      match: true
    };
  } catch (error: any) {
    console.log(chalk.red('  ❌ API call failed:'), error.message);
    return {
      endpoint: 'GET /products',
      old: null,
      new: null,
      diff: [{ error: error.message }],
      match: false
    };
  }
}

/**
 * Test 2: Get single product by ID
 */
async function testGetProductById(productId: string): Promise<ComparisonResult> {
  console.log(chalk.blue(`\n🔍 Testing: GET /products/${productId}`));

  try {
    const [oldResponse, newResponse] = await Promise.all([
      axios.get(`${OLD_API}/products/${productId}`),
      axios.get(`${NEW_API}/products/${productId}`)
    ]);

    const oldProduct = oldResponse.data.product;
    const newProduct = newResponse.data.product;

    const differences = deepCompare(oldProduct, newProduct);

    if (differences.length === 0) {
      console.log(chalk.green('  ✅ Product details match!'));
      return {
        endpoint: `GET /products/${productId}`,
        old: oldProduct,
        new: newProduct,
        diff: [],
        match: true
      };
    } else {
      console.log(chalk.red(`  ❌ Found ${differences.length} differences:`));
      differences.forEach(d => {
        console.log(chalk.yellow(`    ${d.path}: ${d.type}`));
        if (d.old !== undefined) console.log(`      Old: ${JSON.stringify(d.old)}`);
        if (d.new !== undefined) console.log(`      New: ${JSON.stringify(d.new)}`);
      });
      return {
        endpoint: `GET /products/${productId}`,
        old: oldProduct,
        new: newProduct,
        diff: differences,
        match: false
      };
    }
  } catch (error: any) {
    console.log(chalk.red('  ❌ API call failed:'), error.message);
    return {
      endpoint: `GET /products/${productId}`,
      old: null,
      new: null,
      diff: [{ error: error.message }],
      match: false
    };
  }
}

/**
 * Test 3: Search products
 */
async function testSearchProducts(query: string): Promise<ComparisonResult> {
  console.log(chalk.blue(`\n🔎 Testing: POST /products/search?q=${query}`));

  try {
    const [oldResponse, newResponse] = await Promise.all([
      axios.get(`${OLD_API}/products/search?q=${query}`),
      axios.post(`${NEW_API}/products/search`, { q: query })
    ]);

    const oldResults = oldResponse.data.products;
    const newResults = newResponse.data.products;

    console.log(`  Old API: ${oldResults.length} results`);
    console.log(`  New API: ${newResults.length} results`);

    // Compare result counts (allow ±5% variance due to search algo differences)
    const variance = Math.abs(oldResults.length - newResults.length) / oldResults.length;

    if (variance < 0.05) {
      console.log(chalk.green('  ✅ Search results match (within 5% variance)!'));
      return {
        endpoint: `POST /products/search?q=${query}`,
        old: oldResults,
        new: newResults,
        diff: [],
        match: true
      };
    } else {
      console.log(chalk.red(`  ❌ Result count variance: ${(variance * 100).toFixed(1)}%`));
      return {
        endpoint: `POST /products/search?q=${query}`,
        old: oldResults,
        new: newResults,
        diff: [{ type: 'count_variance', variance }],
        match: false
      };
    }
  } catch (error: any) {
    console.log(chalk.red('  ❌ API call failed:'), error.message);
    return {
      endpoint: `POST /products/search?q=${query}`,
      old: null,
      new: null,
      diff: [{ error: error.message }],
      match: false
    };
  }
}

/**
 * Test 4: Get products by category
 */
async function testGetProductsByCategory(categoryId: string): Promise<ComparisonResult> {
  console.log(chalk.blue(`\n📁 Testing: GET /categories/${categoryId}/products`));

  try {
    const [oldResponse, newResponse] = await Promise.all([
      axios.get(`${OLD_API}/categories/${categoryId}/products`),
      axios.get(`${NEW_API}/products?category_id[]=${categoryId}`)
    ]);

    const oldProducts = oldResponse.data.products;
    const newProducts = newResponse.data.products;

    console.log(`  Old API: ${oldProducts.length} products`);
    console.log(`  New API: ${newProducts.length} products`);

    if (oldProducts.length === newProducts.length) {
      console.log(chalk.green('  ✅ Product counts match!'));
      return {
        endpoint: `GET /categories/${categoryId}/products`,
        old: oldProducts,
        new: newProducts,
        diff: [],
        match: true
      };
    } else {
      console.log(chalk.red('  ❌ Product counts differ!'));
      return {
        endpoint: `GET /categories/${categoryId}/products`,
        old: oldProducts,
        new: newProducts,
        diff: [{ type: 'count_mismatch', old: oldProducts.length, new: newProducts.length }],
        match: false
      };
    }
  } catch (error: any) {
    console.log(chalk.red('  ❌ API call failed:'), error.message);
    return {
      endpoint: `GET /categories/${categoryId}/products`,
      old: null,
      new: null,
      diff: [{ error: error.message }],
      match: false
    };
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log(chalk.bold.cyan('\n========================================'));
  console.log(chalk.bold.cyan('  VaighaWeaves Migration: Product API Comparison'));
  console.log(chalk.bold.cyan('========================================\n'));

  console.log(chalk.gray(`Old API: ${OLD_API}`));
  console.log(chalk.gray(`New API: ${NEW_API}`));

  const results: ComparisonResult[] = [];

  // Run all tests
  results.push(await testGetProducts());

  // Get first product ID from the results for detailed testing
  const firstProductId = results[0].old?.[0]?.id || results[0].new?.[0]?.id;
  if (firstProductId) {
    results.push(await testGetProductById(firstProductId));
  }

  results.push(await testSearchProducts('saree'));
  results.push(await testSearchProducts('silk'));

  // Get first category ID for testing
  try {
    const categoriesResponse = await axios.get(`${OLD_API}/categories`);
    const firstCategoryId = categoriesResponse.data.categories[0]?.id;
    if (firstCategoryId) {
      results.push(await testGetProductsByCategory(firstCategoryId));
    }
  } catch (error) {
    console.log(chalk.yellow('\n⚠️  Could not test category products (categories not available)'));
  }

  // Summary
  console.log(chalk.bold.cyan('\n========================================'));
  console.log(chalk.bold.cyan('  Test Summary'));
  console.log(chalk.bold.cyan('========================================\n'));

  const passed = results.filter(r => r.match).length;
  const failed = results.length - passed;

  console.log(`Total tests: ${results.length}`);
  console.log(chalk.green(`✅ Passed: ${passed}`));
  console.log(chalk.red(`❌ Failed: ${failed}`));
  console.log(`Success rate: ${((passed / results.length) * 100).toFixed(1)}%\n`);

  // Export results to JSON
  const fs = require('fs');
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filename = `./results/product-comparison-${timestamp}.json`;

  if (!fs.existsSync('./results')) {
    fs.mkdirSync('./results');
  }

  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(chalk.gray(`Results saved to: ${filename}\n`));

  // Exit with error code if any test failed
  if (failed > 0) {
    console.log(chalk.bold.red('❌ Some tests failed. Review the results above.\n'));
    process.exit(1);
  } else {
    console.log(chalk.bold.green('✅ All tests passed!\n'));
    process.exit(0);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error(chalk.red('\n❌ Fatal error:'), error);
  process.exit(1);
});
