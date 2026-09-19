# Catálogo independiente Familia Fort

Catálogo estático con carrito persistente y finalización de pedidos por WhatsApp. Los productos fueron migrados desde el catálogo autorizado de PROTOOL y las imágenes se sirven localmente.

## Ejecutar

```bash
npm run validate
npm run test:pricing
npm run test:e2e
npm run test:order
npm run serve
```

Abrir `http://localhost:4173`.

## Configurar WhatsApp

El checkout está conectado al WhatsApp oficial de Familia Fort:

```js
whatsapp: "573206135128"
```

Antes de abrir WhatsApp, el cliente diligencia nombre, celular, ciudad, dirección, barrio e indicaciones. El mensaje incluye esos datos, productos, cantidades, precio unitario, subtotales, total y condición de envío.

## Reglas comerciales

- Pedido mínimo: `$80.000`.
- Envío gratis desde `$100.000`.
- Entre `$80.000` y `$99.999`, el envío se cotiza aparte.
- Cortasetos inalámbrico: `$379.900`.
- Cortasetos a gasolina: `$800.000`, únicamente pago anticipado.
- Taladros: incremento de `$30.000` sobre el precio fuente.
- Combos con taladro o pulidora: incremento de `$50.000` sobre el precio fuente, sin acumular el aumento individual del taladro.
- Pulidoras: incremento de `$20.000`.
- Pistolas y llaves de impacto: incremento de `$30.000`.
- Rotomartillos: incremento de `$30.000`.
- Demoledores: incremento de `$50.000`.
- Sierras y caladoras: incremento de `$30.000`.
- Compresores: incremento de `$40.000`.
- Lijadoras: incremento de `$20.000`.
- Ruteadoras y rebordeadoras: incremento de `$20.000`.
- Maquinaria agrícola y jardín restante: incremento de `$50.000`, conservando los precios especiales de los cortasetos.
- Los accesorios, repuestos, discos, adaptadores, bases y mangueras no reciben estos aumentos.

Las reglas están en `scripts/pricing_rules.py` y el importador las reaplica de forma idempotente.

## Actualizar productos

```bash
npm run import
npm run validate
```

El importador:

- Lee todos los productos disponibles del catálogo fuente.
- Conserva únicamente el precio final de venta (`pcia`).
- Excluye precios mayoristas.
- Descarga imágenes dentro de `public/assets/products`.
- Genera `public/data/catalog.json`.

## Publicación

La carpeta `public/` se puede desplegar como sitio estático en Cloudflare Pages, Netlify, Vercel o un servidor web convencional. Antes de publicar se debe confirmar:

1. Número oficial de WhatsApp de Familia Fort.
2. Dominio final.
3. Logo oficial, si existe.
4. Política de privacidad, cambios y condiciones de entrega.
