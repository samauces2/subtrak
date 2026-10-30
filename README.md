# SubTrack

Aplicación web adaptable para gestionar suscripciones, sin registro ni backend. React, TypeScript, Vite y Tailwind CSS. Los datos se guardan exclusivamente en el navegador actual; la primera visita comienza vacía.

## Desarrollo local

Usa Node.js 22.12 o posterior.

```sh
npm ci
npm run dev
```

Abre la dirección local que imprime Vite. Mantén el mismo origen (protocolo, host y puerto) para acceder a los mismos datos de LocalStorage.

```sh
npm test
npm run build
npm run preview
```

La compilación estática se genera en `dist/`. No hay servicios ni variables de entorno que configurar.

## Funciones

- Dashboard con equivalentes mensuales y anuales por moneda y cobros programados en los próximos 30 días.
- Alta, edición, eliminación con confirmación, pausa y reactivación.
- Gasto real pagado durante el año calendario, por moneda, con pagos confirmados e historial.
- Categorías, búsqueda por nombre y filtros de estado/categoría.
- Respaldo JSON versionado: exportación e importación con validación completa, vista previa y confirmación de reemplazo.
- Formularios accesibles con diálogo nativo, navegación por teclado y presentación adaptable.

## Estructura y reglas

- `src/types/subscription.ts`: contratos del dominio.
- `src/utils/billing.ts`: calendario, recurrencias y totales, sin dependencias de React.
- `src/utils/currency.ts`: importes enteros en unidades menores y formato según moneda.
- `src/services/storage.ts`: interfaz de repositorio, adaptador LocalStorage y validación de respaldos.
- `src/components/`: formulario y diálogo reutilizables.

`billingAnchorDate` conserva la fecha original y la fase de recurrencia. `nextBillingDate` conserva la fecha ingresada; la próxima ocurrencia visible se calcula, sin registrar pagos. El 31 se ajusta al último día del mes y se recupera cuando existe; el 29 de febrero se recupera en años bisiestos. Pausar conserva el calendario. Editar fecha o frecuencia inicia uno nuevo.

No se suman monedas distintas. Los equivalentes son promedios de presupuesto, no cobros reales de un mes concreto. Las suscripciones pausadas se excluyen de los totales y próximos cargos. Los semanales pueden aparecer varias veces en la ventana de 30 días.

LocalStorage usa `subtrack:data:v1` (clave conservada para continuidad; esquema interno versión 2). Datos desconocidos o dañados bloquean las escrituras para no perder el original; el panel Respaldos permite descargarlo y restaurar un respaldo válido. La importación reemplaza todo el documento solo después de validar y confirmar. Cambios detectados en otra pestaña requieren recargar antes de editar.

## Verificación

Vitest cubre las cuatro frecuencias, fin de mes, años bisiestos, pausas, monedas separadas, monedas sin decimales o con tres decimales, persistencia, importación/exportación, datos dañados y fallos de almacenamiento.

Antes de publicar: comprobar en dispositivos reales, revisar accesibilidad con lector de pantalla y elegir alojamiento estático. No se incluye autenticación, sincronización, conversión de monedas ni pagos bancarios automáticos.

## Registrar lo realmente pagado

En **Mis suscripciones → Pagos**, ingresa el importe y la fecha, y pulsa **Confirmar pago realizado**. Puedes registrar meses anteriores uno por uno. **Pagado este año** suma solo los pagos del año calendario actual hasta hoy, por moneda. El gasto anual equivalente sigue siendo una proyección independiente.

**Ver pagos** en el Dashboard muestra el historial de todos los años. Permite eliminar, con confirmación, registros incorrectos. Renombrar, pausar o eliminar una suscripción conserva sus pagos históricos y el importe que se confirmó en cada fecha.

Los respaldos nuevos incluyen pagos; los respaldos de versión 1 se abren con historial vacío. No se convierten cobros programados en pagos confirmados. Importar un respaldo sin pagos reemplaza también el historial existente después de la advertencia y confirmación.
# subtrak
