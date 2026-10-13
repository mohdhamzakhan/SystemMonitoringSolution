# SystemMonitoringSolution — Monitoring Architecture

## Purpose
Multi-component monitoring platform containing an ASP.NET Core API, Windows background collector, inventory/system-detail deployment projects and React frontends.

## Architecture
Client machine -> SystemMonitorWorker -> SystemMonitorAPI -> database/services/jobs -> React monitoring UI.

## Components
- SystemMonitorAPI/ — controllers, DTOs, services, jobs, models, migrations and configuration.
- SystemMonitorWorker/ — long-running Windows collector; includes Worker.cs and UserImpersonation.cs.
- MEAI_InventoryCollector/ — deployment project.
- MEAI_SystemDetails/ — deployment project.
- my-react-frontend/ — React frontend.
- systemmonitorfrontend/ — React/Vite frontend.

## Rules
Trace worker -> API -> persistence/service -> frontend before changing contracts. Preserve DTO/API compatibility. Do not expose credentials. Avoid changing collection intervals, permissions or background-service behavior without checking operational impact.

## Validation
Build API and worker separately, validate endpoints, then verify a worker cycle and frontend integration.