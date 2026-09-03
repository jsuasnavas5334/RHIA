# Benchmark RHIA de modelos (v1)

Corrida con respuestas guionadas via FakeTransport (sin proveedores reales ni secretos). Ver docs/progress/PH05-T004.md.

| Candidato | Tier | Quality | Costo prom. USD | Latencia p95 ms |
|---|---|---|---|---|
| openai:gpt-5 | premium | 1.000 | 0.000436 | 41 |
| anthropic:claude-mini-2026 | standard | 0.929 | 0.000587 | 26 |
| openai:gpt-5-mini | economy | 0.738 | 0.000386 | 13 |
| ollama:llama3.1-8b | economy | 0.643 | 0.000000 | 4 |

## Detalle por task class

### openai:gpt-5

| Task class | n | Quality | Costo prom. USD | Latencia prom. ms |
|---|---|---|---|---|
| classification | 3 | 1.000 | 0.000343 | 40.3 |
| drafting | 3 | 1.000 | 0.000639 | 40.3 |
| entity_resolution | 4 | 1.000 | 0.000565 | 40.3 |
| tool_selection | 4 | 1.000 | 0.000227 | 40.3 |

### anthropic:claude-mini-2026

| Task class | n | Quality | Costo prom. USD | Latencia prom. ms |
|---|---|---|---|---|
| classification | 3 | 1.000 | 0.000470 | 26.0 |
| drafting | 3 | 1.000 | 0.000921 | 25.3 |
| entity_resolution | 4 | 0.750 | 0.000725 | 26.0 |
| tool_selection | 4 | 1.000 | 0.000286 | 25.0 |

### openai:gpt-5-mini

| Task class | n | Quality | Costo prom. USD | Latencia prom. ms |
|---|---|---|---|---|
| classification | 3 | 1.000 | 0.000343 | 12.3 |
| drafting | 3 | 0.778 | 0.000559 | 12.3 |
| entity_resolution | 4 | 0.500 | 0.000449 | 12.3 |
| tool_selection | 4 | 0.750 | 0.000227 | 12.8 |

### ollama:llama3.1-8b

| Task class | n | Quality | Costo prom. USD | Latencia prom. ms |
|---|---|---|---|---|
| classification | 3 | 0.667 | 0.000000 | 3.7 |
| drafting | 3 | 1.000 | 0.000000 | 3.3 |
| entity_resolution | 4 | 0.250 | 0.000000 | 3.5 |
| tool_selection | 4 | 0.750 | 0.000000 | 3.5 |
