const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const ARTIFACTS = path.resolve(__dirname, '..', 'artifacts');
fs.mkdirSync(ARTIFACTS, { recursive: true });

const executablePath = process.env.CHROME_PATH || '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('.product-card');
    const bodyText = await page.locator('body').innerText();
    assert(bodyText.includes('$80.000'), 'No se comunica el pedido mínimo de $80.000');
    assert(bodyText.includes('$100.000'), 'No se comunica el envío gratis desde $100.000');

    await page.locator('.quick-add').first().click();
    await page.locator('#cartTrigger').click();
    await page.waitForSelector('#cartDrawer.open');
    await page.waitForTimeout(400);
    assert(await page.locator('#checkoutButton').isDisabled(), 'Debe bloquear pedidos por debajo de $80.000');
    assert((await page.locator('#checkoutNote').innerText()).includes('80.000'), 'Falta explicar cuánto falta para el mínimo');
    await page.screenshot({ path: path.join(ARTIFACTS, 'mobile-cart-minimum.png'), fullPage: false });

    await page.evaluate(() => localStorage.setItem('familia-fort-cart-v1', JSON.stringify({ '73n7k6izog': 1 })));
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#cartTrigger').click();
    await page.waitForSelector('#cartDrawer.open');
    assert(!(await page.locator('#checkoutButton').isDisabled()), 'Un pedido de $85.000 debe poder continuar');
    assert(/envío.*cotiza/i.test(await page.locator('#checkoutNote').innerText()), 'Pedidos entre $80.000 y $99.999 deben indicar envío cotizado aparte');

    await page.evaluate(() => localStorage.setItem('familia-fort-cart-v1', JSON.stringify({ '7v9bc55hij': 1 })));
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#cartTrigger').click();
    await page.waitForSelector('#cartDrawer.open');
    assert((await page.locator('#cartTotal').innerText()).includes('800.000'), 'El cortasetos a gasolina debe costar $800.000');
    assert(/envío gratis/i.test(await page.locator('#checkoutNote').innerText()), 'Pedidos de $100.000 o más deben indicar envío gratis');
    await page.locator('#checkoutButton').click();
    await page.waitForSelector('#orderModal:not([hidden])');
    assert(await page.locator('#orderForm').isVisible(), 'Debe abrir el formulario antes de WhatsApp');
    assert(await page.locator('#customerDepartment').evaluate((element) => element.tagName === 'SELECT'), 'Departamento debe ser un desplegable');
    assert(await page.locator('#customerCity').evaluate((element) => element.tagName === 'SELECT'), 'Ciudad debe ser un desplegable');
    assert(await page.locator('#customerDepartment option').count() === 34, 'Debe listar los 32 departamentos y Bogotá');

    await page.locator('#orderSubmit').click();
    assert(await page.locator('#orderForm :invalid').count() >= 1, 'El formulario debe exigir datos de entrega');

    await page.locator('#customerName').fill('Cliente de Prueba');
    await page.locator('#customerPhone').fill('3001234567');
    await page.locator('#customerDepartment').selectOption({ label: 'Valle del Cauca' });
    assert(!(await page.locator('#customerCity').isDisabled()), 'Ciudad debe habilitarse después de elegir departamento');
    await page.locator('#customerCity').selectOption({ label: 'Cali' });
    await page.locator('#customerAddress').fill('Calle 1 # 2-3');
    await page.locator('#customerNeighborhood').fill('Centro');
    await page.locator('#customerNotes').fill('Entregar en portería');
    await page.screenshot({ path: path.join(ARTIFACTS, 'mobile-order-form.png'), fullPage: false });
    await page.evaluate(() => {
      window.__openedUrl = '';
      window.open = (url) => { window.__openedUrl = String(url); return null; };
    });
    await page.locator('#orderSubmit').click();
    const openedUrl = await page.evaluate(() => window.__openedUrl);
    assert(openedUrl.startsWith('https://wa.me/573206135128?text='), 'El pedido debe ir al WhatsApp oficial');
    const message = decodeURIComponent(openedUrl);
    for (const expected of ['*Nuevo pedido | Familia Fort*', 'Cliente de Prueba', '3001234567', '📍 Cali, Valle del Cauca', 'Calle 1 # 2-3', '🚚 *Envío gratis*', 'Únicamente pago anticipado', '*Total:']) {
      assert(message.includes(expected), `El mensaje no incluye: ${expected}`);
    }
    assert(!message.includes('DATOS DEL CLIENTE'), 'El mensaje no debe usar encabezados largos en mayúscula');
    assert(errors.length === 0, `Errores de consola: ${errors.join(' | ')}`);
    console.log(JSON.stringify({ minimumBlocked: true, paidShippingRange: true, freeShipping: true, formValidated: true, dependentLocationSelectors: true, formattedWhatsapp: true, whatsapp: '573206135128', consoleErrors: errors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
