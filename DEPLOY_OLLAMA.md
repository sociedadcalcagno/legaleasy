# Despliegue con Ollama

Para que el agente converse de verdad en producción, `legaleasy.cl` debe apuntar a un servidor que ejecute Node y Ollama. Un hosting estático no sirve para `/api/chat`.

## Requisitos

- VPS Linux con Docker y Docker Compose.
- Dominio `legaleasy.cl` apuntando al servidor.
- Proxy HTTPS como Nginx, Caddy o Traefik hacia `http://127.0.0.1:3001`.

## Levantar LegalEasy + Ollama

```bash
docker compose up -d --build
```

El compose levanta:

- `app`: LegalEasy en `3001`.
- `ollama`: servidor local de modelos.
- `ollama-model`: descarga `llama3.2:1b`.

## Verificar

```bash
curl http://localhost:3001/
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"service":"consultas-legales","message":"Hola, necesito ayuda con un contrato"}'
```

## Variables importantes

- `OLLAMA_URL=http://ollama:11434/api/generate`
- `OLLAMA_MODEL=llama3.2:1b`
- `ADMIN_TOKEN=...` si quieres consultar `/api/leads?token=...`

## Punto crítico

Si `https://legaleasy.cl/api/chat` devuelve `404`, el dominio todavía no está llegando al servidor Node. En ese caso el agente solo puede usar fallback del frontend, no IA real.
