# DC02 — Sincronización de la definición funcional entre repositorios

**Decisión confirmada (23/10/2026).**

- `rt-rma-app` es la fuente única de verdad funcional.
- `rt-rma-mvp/business` es una **copia generada** que identifica el commit exacto de origen, con verificación automática de sincronización y sin modificaciones manuales.

**Estado: implementada.** La copia se aplicó el 24/10/2026 y se publicó el 26/10/2026 (ver «Aplicación»). Las secciones «Comprobación hecha en esta consolidación» y «Cómo se aplicará» describen el plan del 23/10/2026.

## Aplicación (24 a 26/10/2026)

| Ítem | Valor |
|---|---|
| Fuente | `rt-rma-app`, etiqueta `v1.4-baseline`, commit `e99b28386695df537aabd02d7068c0102de09eae`, publicada el 26/10/2026 |
| Producto | `rt-rma-mvp` `mvp-v2` en `fe560dd` (rama de trabajo `sync/functional-v1.4`), por avance directo desde `f270a84`, publicado el 26/10/2026 |
| Verificación | `npm run verify:functional-copy` corre en `validate:all`. `verify:functional-copy:source` verifica contra un clon de `rt-rma-app`; se comprobó con el clon público |
| Fines de línea | `.gitattributes`: `business/** text eol=lf` |
| Herramientas | Los validadores y pruebas compartidos son copias idénticas de esta fuente |
| Discrepancias | `rt-rma-mvp/traceability/discrepancias-baseline-v1.4.md` |

El producto no cambió de comportamiento: pytest, las pruebas y el build del frontend dieron lo mismo antes y después.

La resincronización por cambios administrativos se pospuso: el manifiesto del MVP sigue apuntando a `e99b283`. Por eso el estado de implementación se mantiene fuera de `business/` (`traceability/estado-implementacion-v1.4.yaml`).

## Piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| Generador | `scripts/export-functional-copy.ts` (`npm run export:functional-copy -- --to <repo>`) | Copia `business/` **tal como está en un commit**, nunca desde el árbol de trabajo. Escribe `business/FUNCTIONAL_SOURCE.json`. Borra del destino lo que el commit no tiene. Se niega a exportar si `business/` tiene cambios sin commitear, salvo con `--allow-dirty`, que existe para las pruebas. |
| Manifiesto | `business/FUNCTIONAL_SOURCE.json` en la copia | Repositorio de origen, **commit de origen (SHA completo)**, referencia usada, fecha de generación, aviso de "no editar a mano" y la lista de archivos con tamaño y SHA-256. |
| Verificador | `scripts/verify-functional-copy.mjs` (Node 18+, sin dependencias) | En el repositorio del producto: `node verify-functional-copy.mjs . [--source-repo <clon de rt-rma-app>] [--expect-commit <sha>]`. |
| Pruebas | `scripts/test-functional-copy.ts` (`npm run test:functional-copy`, incluido en `validate:v1.4`) | Exportación, verificación y detección de ediciones, altas, bajas, commit equivocado, commit inexistente y falta de manifiesto. Trabaja solo en directorios temporales. |

## Qué verifica

1. Existe el manifiesto y está bien formado: el commit es un SHA de 40 caracteres y la lista de archivos no está vacía.
2. Cada archivo listado existe y su SHA-256 coincide. Antes de calcularlo los fines de línea se normalizan a LF, así que un checkout de Windows con `autocrlf` no cuenta como edición. Cualquier cambio de contenido, sí.
3. En `business/` no hay archivos que el manifiesto no liste: no se admiten agregados a mano.
4. Con `--expect-commit`, la copia es la del commit esperado.
5. Con `--source-repo`:
   - el commit existe en el repositorio de origen;
   - cada archivo coincide con su contenido en ese commit;
   - la copia no omite ningún archivo del commit.

   Así se prueba la procedencia, además de la integridad.

El verificador termina con código 1 y la lista de problemas si algo no coincide.

## Comprobación hecha en esta consolidación (solo lectura)

`node scripts/verify-functional-copy.mjs ../rt-rma-mvp` informa "falta business/FUNCTIONAL_SOURCE.json: la carpeta no es una copia generada". Es el resultado esperado: la carpeta de `rt-rma-mvp` es hoy una copia manual de V1.3 con cuatro cambios propios, que ya están incorporados en la baseline candidata.

## Cómo se aplicará, después de aprobar la baseline (DC01)

Plan original del 23/10/2026. Se aplicó con la etiqueta `v1.4-baseline` en lugar de `v1.4`; el resultado está en «Aplicación».

1. Etiquetar en `rt-rma-app` el commit aprobado (por ejemplo `v1.4`) y publicarlo.
2. En `rt-rma-mvp`, en una rama:
   - correr `npm run export:functional-copy -- --to ../rt-rma-mvp --commit v1.4` desde `rt-rma-app`;
   - revisar el diff: cambia la versión funcional que usa el producto;
   - copiar `scripts/verify-functional-copy.mjs`;
   - agregar a `.gitattributes` la línea `business/** text eol=lf`.
3. Agregar la verificación al CI de `rt-rma-mvp`. Como mínimo, `node scripts/verify-functional-copy.mjs .`. Con el remote `functional` que ya apunta a `rt-rma-app` (`git fetch functional`), también se puede verificar la procedencia con `--source-repo .`, porque el commit queda disponible en ese clon.
4. Desde entonces, todo cambio funcional se hace en `rt-rma-app` y llega al producto solo regenerando la copia.

Los tests y validadores propios de `rt-rma-mvp` que leen `business/` (por ejemplo `test-traceability-global.ts`) deberán adaptarse a la versión V1.4. Eso es trabajo de la iteración que aplique DC02, no de esta consolidación.

## Alternativas descartadas

- **Submódulo de git.** Complica las exportaciones de despliegue y el trabajo diario en Windows.
- **Copia manual.** Es lo que produjo la divergencia de V1.3 que esta consolidación resolvió.
