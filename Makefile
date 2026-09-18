.PHONY: help install configure backend frontend dev build

.DEFAULT_GOAL := help

help:
	@echo "Available commands:"
	@echo "  make install     Install frontend dependencies (npm install)"
	@echo "  make configure   First-time setup: create backend/appsettings.Local.json from the example"
	@echo "  make backend     Run the .NET API in dev mode (http://localhost:5299)"
	@echo "  make frontend    Run the Vite dev server (http://localhost:5173)"
	@echo "  make dev         Run backend and frontend together (Ctrl+C stops both)"
	@echo "  make build       Production build for backend and frontend"

# Installs frontend dependencies (run once, or after pulling new deps)
install:
	cd frontend && npm install

# Creates backend/appsettings.Local.json from the example if it doesn't exist yet
configure:
	@if [ -f backend/appsettings.Local.json ]; then \
		echo "backend/appsettings.Local.json already exists - edit it directly to add/change agents."; \
	else \
		cp backend/appsettings.Local.json.example backend/appsettings.Local.json; \
		echo "Created backend/appsettings.Local.json - edit it to point at your agent repos."; \
	fi

# Runs the .NET API on http://localhost:5299
backend:
	cd backend && dotnet run --urls http://localhost:5299

# Runs the Vite dev server on http://localhost:5173
frontend:
	cd frontend && npm run dev

# Runs backend and frontend together (Ctrl+C stops both)
dev:
	@echo "Starting backend on :5299 and frontend on :5173 - Ctrl+C stops both"
	@( cd backend && dotnet run --urls http://localhost:5299 ) & \
	( cd frontend && npm run dev ) & \
	wait

# Production builds for both projects
build:
	cd backend && dotnet build -c Release
	cd frontend && npm run build
