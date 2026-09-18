.PHONY: help install backend frontend dev build

.DEFAULT_GOAL := help

help:
	@echo "Available commands:"
	@echo "  make install     Install frontend dependencies (npm install)"
	@echo "  make backend     Run the .NET API in dev mode (http://localhost:5299)"
	@echo "  make frontend    Run the Vite dev server (http://localhost:5173)"
	@echo "  make dev         Run backend and frontend together (Ctrl+C stops both)"
	@echo "  make build       Production build for backend and frontend"
	@echo ""
	@echo "Repos and agents are registered through the API (POST /api/repos, POST /api/agents)"
	@echo "instead of a config file - see README.md."

# Installs frontend dependencies (run once, or after pulling new deps)
install:
	cd frontend && npm install

# Runs the .NET API on http://localhost:5299
backend:
	cd backend && dotnet run --urls http://localhost:5299

# Runs the Vite dev server on http://localhost:5173
frontend:
	cd frontend && npm run dev

# Runs backend and frontend together (Ctrl+C stops both)
dev:
	@echo "Starting backend on :5299 and frontend on :5173 - Ctrl+C stops both"
	"$(MAKE)" -j2 backend frontend

# Production builds for both projects
build:
	cd backend && dotnet build -c Release
	cd frontend && npm run build
