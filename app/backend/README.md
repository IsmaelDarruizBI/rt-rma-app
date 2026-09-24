# Backend MVP - Rosario Tecno RMA App

Backend FastAPI del MVP. Convive con el tooling de modelado funcional de
la raiz del repositorio (`business/`, `scripts/`, `generated/`) sin
reemplazarlo: la fuente de verdad funcional sigue siendo `business/`.

Estado actual: **scaffold**. Solo existe `GET /health`. Todavia no hay
modelos de dominio, casos de uso, persistencia ni logica del Happy Path
`HP-REP-001`.

## Stack

- Python >= 3.11
- FastAPI
- Pydantic v2 (+ pydantic-settings para la configuracion)
- Uvicorn

## Estructura

```text
app/
  main.py         Construccion de la app FastAPI y registro de routers
  api/            Routers/endpoints FastAPI (unica capa que conoce HTTP)
  domain/         Modelos y conceptos de negocio (sin FastAPI ni persistencia)
    models/       Entidades del dominio (vacio en esta iteracion)
  services/       Casos de uso y logica de aplicacion
  repositories/   Contratos/interfaces de acceso a datos (QUE, no COMO)
  storage/        Implementaciones concretas de persistencia (JSON/file-based)
  core/           Configuracion tecnica transversal
data/
  ordenes/        Datos locales temporales del MVP (sin datos reales)
  catalogs/       Catalogos locales del MVP (sin datos reales)
tests/            Tests del backend
```

Regla de dependencia: `api -> services -> repositories <- storage`, y
`domain` no depende de ninguna de las otras. `storage` debe poder
reemplazarse (por una base de datos, por ejemplo) sin tocar `domain` ni
`services`.

## Instalacion

Desde `app/backend/`:

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Linux / macOS
pip install -e .
```

## Ejecucion

```bash
uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000
- Health: http://localhost:8000/health
- Docs: http://localhost:8000/docs

## Configuracion

Variables de entorno con prefijo `RMA_` (ver `app/core/config.py`):

| Variable | Default |
|---|---|
| `RMA_APP_NAME` | `Rosario Tecno RMA API` |
| `RMA_APP_VERSION` | `0.1.0` |
| `RMA_CORS_ALLOW_ORIGINS` | `["http://localhost:5173","http://127.0.0.1:5173"]` |

## Datos

`data/` contiene unicamente datos locales temporales del MVP. No debe
contener datos reales, credenciales ni informacion sensible.
