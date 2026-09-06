# Trazabilidad (futuro)

Este documento describe la convencion de IDs que sostendra la trazabilidad
end-to-end del proyecto. **No hay todavia ninguna implementacion**: ni
generacion automatica de matrices, ni validacion cruzada, ni herramientas.
Es solo la convencion de nombres que los artefactos futuros deberan
respetar para que la trazabilidad sea posible mas adelante.

## Convencion de IDs

```text
PROC-REP-XXX   Business Process Node
EVT-REP-XXX    Event
BR-REP-XXX     Business Rule
EPIC-REP-XXX   Epic
US-REP-XXX     User Story
FR-REP-XXX     Functional Requirement
TR-REP-XXX     Technical Requirement
TEST-REP-XXX   Internal Test
UAT-REP-XXX    User Acceptance Test
BUG-REP-XXX    Bug / Issue
```

`REP` identifica el proceso de negocio (Reparaciones). Si en el futuro se
modelan otros procesos, se reemplazara por el prefijo correspondiente.

## Objetivo futuro

Poder navegar desde cualquier elemento hasta todos sus relacionados, en
ambas direcciones. Ejemplo:

```text
PROC-REP-020
→ US-REP-012
→ FR-REP-018
→ TR-REP-031
→ TEST-REP-031
→ UAT-REP-031
→ BUG-REP-004
→ FIX
→ RETEST
→ APPROVED
```

## Estado actual

No implementado. Esta convencion existe unicamente para que los IDs creados
desde ahora (por ejemplo, en `business/processes/repair-management.yaml`)
sean estables y reutilizables cuando se construya el sistema de
trazabilidad.
