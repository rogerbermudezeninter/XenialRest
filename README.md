# XenialRest

TPV/Restaurante con servidor central, PostgreSQL y clientes Android.

## Arquitectura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Tablet Android │     │ Pantalla Cocina │     │   Caja / Admin   │
│  (mesas/pedidos)│     │ (comandas)      │     │   (cobros)       │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                         ┌───────▼───────┐
                         │  API REST     │
                         │  (Node.js)    │
                         └───────┬───────┘
                                 │
                         ┌───────▼───────┐
                         │  PostgreSQL   │
                         └───────────────┘
```

- **JSON** para configuración (export/import, plantillas)
- **PostgreSQL** para operación (pedidos, mesas, cobros)
- **Servidor central** coordina todo

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- PC o miniPC como servidor (Windows o Linux)

## Instalación

### 1. Base de datos

```bash
# Crear usuario y BD
sudo -u postgres createuser -P xenial
sudo -u postgres createdb -O xenial xenialrest

# Ejecutar esquema
psql -U xenial -d xenialrest -f database/schema.sql
```

### 2. API

```bash
cd api
npm install
cp ../config/config.example.json ../config/config.json
# Editar config.json con credenciales de BD
npm start
```

### 3. Configuración

- Copia `config/config.example.json` a `config/config.json`
- Ajusta `database` con tus credenciales PostgreSQL
- Configura salones, mesas e impresoras en el JSON

## Estructura del proyecto

```
XenialRest/
├── api/                 # Servidor API REST (Node.js)
│   ├── server.js
│   └── package.json
├── database/
│   └── schema.sql       # Esquema PostgreSQL
├── config/
│   ├── config.example.json
│   └── config.json      # (crear, no versionar)
├── imagenes/
│   └── productos/       # Fotos de productos (rutas en BD)
└── README.md
```

## API - Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/mesas | Lista mesas con estado |
| GET | /api/tickets/:id | Detalle ticket |
| GET | /api/tickets/:id/lineas | Líneas del ticket |
| POST | /api/tickets | Abrir mesa (crear ticket) |
| POST | /api/tickets/:id/bloquear | Bloquear mesa (device_id, user_id) |
| POST | /api/tickets/:id/desbloquear | Desbloquear mesa |
| POST | /api/tickets/:id/lineas | Añadir línea al ticket |
| POST | /api/tickets/:id/enviar-cocina | Enviar pedido a cocina |
| POST | /api/tickets/:id/pagos | Registrar pago |
| GET | /api/tickets/:id/pagos | Listar pagos del ticket |
| GET | /api/cocina/pendientes | Pedidos pendientes cocina |
| PATCH | /api/cocina/linea/:id/estado | Marcar línea (en_preparacion, servido) |
| GET | /api/productos | Lista productos |
| GET | /api/formas-pago | Formas de pago |
| GET | /api/config | Configuración activa |

## Estados

**Mesa:** libre | ocupada | en_edicion | cobrada  
**Ticket:** abierto | enviado_cocina | parcialmente_cobrado | cobrado | anulado  
**Línea:** pendiente | enviado_cocina | en_preparacion | servido | anulado  

## Control de edición concurrente

Cada ticket tiene:
- `editing_device_id` - dispositivo que edita
- `editing_user_id` - usuario
- `editing_started_at` - timestamp

Si otro dispositivo intenta editar, mostrar: "Mesa en edición por Juan desde hace X segundos".

## Próximos pasos

1. App Android (Kotlin/Java) que consuma la API
2. Pantalla cocina (web o Android)
3. Módulo caja para cobros
4. Sincronización de configuración JSON ↔ BD
