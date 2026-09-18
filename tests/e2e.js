const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACTS = path.join(ROOT, 'artifacts');
fs.mkdirSync(ARTIFACTS, { recursive: true });
const executablePath = process.env.CHROME_PATH || '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const results = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
    await page.waitForSelector('.product-card');
    results.title = await page.title();
    results.productCount = await page.locator('.product-card').count();
    results.heroCount = await page.locator('#heroProductCount').textContent();
    results.categoryButtons = await page.locator('.category-chip').count();
    results.wholesaleTextOccurrences = await page.getByText(/al mayor|mayorista/i).count();
    assert(results.title.includes('Familia Fort'), 'Título incorrecto');
    assert(results.productCount === 24, `Se esperaban 24 tarjetas iniciales, hay ${results.productCount}`);
    assert(results.heroCount.trim() === '569', `Conteo total incorrecto: ${results.heroCount}`);
    assert(results.categoryButtons === 32, `Se esperaban 32 botones de categoría, hay ${results.categoryButtons}`);
    assert(results.wholesaleTextOccurrences === 0, 'Se encontró texto de precio mayorista');

    await page.screenshot({ path: path.join(ARTIFACTS, 'desktop-home.png'), fullPage: false });
    await page.locator('#productGrid').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(ARTIFACTS, 'desktop-catalog.png'), fullPage: false });

    await page.locator('.quick-add').first().click();
    assert((await page.locator('#cartCount').textContent()).trim() === '1', 'El carrito no sumó una unidad');
    await page.locator('#cartTrigger').click();
    await page.waitForSelector('#cartDrawer.open');
    assert(await page.locator('.cart-item').count() === 1, 'El carrito no muestra el producto agregado');
    assert(await page.locator('#checkoutButton').isDisabled(), 'Checkout debe esperar número oficial de WhatsApp');
    await page.locator('.item-quantity button').last().click();
    assert((await page.locator('#cartCount').textContent()).trim() === '2', 'No se pudo aumentar cantidad');
    results.cartTotal = await page.locator('#cartTotal').textContent();
    await page.screenshot({ path: path.join(ARTIFACTS, 'desktop-cart.png'), fullPage: false });
    await page.reload({ waitUntil: 'networkidle' });
    assert((await page.locator('#cartCount').textContent()).trim() === '2', 'El carrito no persistió al recargar');

    await page.locator('#searchInput').fill('NIVEL LASER 16 LINEAS');
    await page.waitForTimeout(350);
    results.searchResults = await page.locator('.product-card').count();
    assert(results.searchResults >= 1, 'La búsqueda no devolvió el nivel láser');
    await page.locator('.product-title-button').first().click();
    await page.waitForSelector('#productModal:not([hidden])');
    assert(await page.locator('#modalTitle').isVisible(), 'La ficha de producto no abrió');
    await page.screenshot({ path: path.join(ARTIFACTS, 'desktop-product.png'), fullPage: false });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const mobileErrors = [];
    mobile.on('console', (msg) => { if (msg.type() === 'error') mobileErrors.push(msg.text()); });
    mobile.on('pageerror', (error) => mobileErrors.push(error.message));
    await mobile.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
    await mobile.waitForSelector('.product-card');
    results.mobileCards = await mobile.locator('.product-card').count();
    results.mobileOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert(results.mobileCards === 24, 'El catálogo móvil no cargó 24 productos');
    assert(!results.mobileOverflow, 'La página móvil tiene desbordamiento horizontal');
    await mobile.screenshot({ path: path.join(ARTIFACTS, 'mobile-home.png'), fullPage: false });
    await mobile.locator('.quick-add').first().click();
    await mobile.locator('#cartTrigger').click();
    await mobile.waitForTimeout(400);
    assert(await mobile.locator('#cartDrawer.open').isVisible(), 'El carrito móvil no abrió');
    await mobile.screenshot({ path: path.join(ARTIFACTS, 'mobile-cart.png'), fullPage: false });

    results.consoleErrors = [...errors, ...mobileErrors];
    assert(results.consoleErrors.length === 0, `Errores de consola: ${results.consoleErrors.join(' | ')}`);
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
