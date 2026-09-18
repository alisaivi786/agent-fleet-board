.PHONY: help install db db-down migrate backend frontend dev build

.DEFAULT_GOAL := help

help:
	@echo "Available commands:"
	@echo "  make install     Install frontend dependencies (npm install)"
	@echo "  make db          Start Postgres via docker compose (http://localhost:5434)"
	@echo "  make db-down     Stop the Postgres container"
	@echo "  make migrate     Run FluentMigrator migrations against that Postgres instance"
	@echo "  make backend     Run the .NET API in dev mode (http://localhost:5299, Swagger at /swagger)"
	@echo "  make frontend    Run the Vite dev server (http://localhost:5173)"
	@echo "  make dev         Run backend and frontend together (Ctrl+C stops both)"
	@echo "  make build       Production build for backend and frontend"
	@echo ""
	@echo "First time: cp .env.example .env (edit POSTGRES_PASSWORD), then db -> migrate -> backend."
	@echo "Repos and agents are registered through the API (POST /api/repos, POST /api/agents)."

# Installs frontend dependencies (run once, or after pulling new deps)
install:
	cd frontend && npm install

# Starts the Postgres container used by the backend
db:
	docker compose up -d postgres

# Stops the Postgres container
db-down:
	docker compose down

# Runs pending FluentMigrator migrations against the Postgres instance started by `make db`.
# Reads connection details from .env (copy .env.example first) rather than hardcoding them here.
migrate:
	@set -a; . ./.env; set +a; \
	AGENTFLEETBOARD_MIGRATION_CONNECTION="Host=localhost;Port=$${POSTGRES_PORT:-5434};Database=$${POSTGRES_DB:-agentfleetboard};Username=$${POSTGRES_USER:-agentfleetboard};Password=$$POSTGRES_PASSWORD" \
	dotnet run --project backend/src/AgentFleetBoard.Migrations

# Runs the .NET API on http://localhost:5299
backend:
	cd backend/src/AgentFleetBoard.Api && dotnet run --urls http://localhost:5299

# Runs the Vite dev server on http://localhost:5173
frontend:
	cd frontend && npm run dev

# Runs backend and frontend together (Ctrl+C stops both)
dev:
	@echo "Starting backend on :5299 and frontend on :5173 - Ctrl+C stops both"
	"$(MAKE)" -j2 backend frontend

# Production builds for both projects
build:
	cd backend && dotnet build AgentFleetBoard.slnx -c Release
	cd frontend && npm run build
