# Catálogo independiente Familia Fort

Catálogo estático con carrito persistente y finalización de pedidos por WhatsApp. Los productos fueron migrados desde el catálogo autorizado de PROTOOL y las imágenes se sirven localmente.

## Ejecutar

```bash
npm run validate
npm run serve
```

Abrir `http://localhost:4173`.

## Configurar WhatsApp

Editar `public/config.js` y colocar el número oficial con código de país, solo dígitos:

```js
whatsapp: "57XXXXXXXXXX"
```

Mientras el número esté vacío, el carrito funciona pero el botón de finalizar permanece deshabilitado para evitar enviar pedidos a un negocio o número incorrecto.

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
