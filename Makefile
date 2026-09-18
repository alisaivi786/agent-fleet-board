.PHONY: backend frontend install dev build configure

# Runs the .NET API on http://localhost:5299
backend:
	cd backend && dotnet run --urls http://localhost:5299

# Runs the Vite dev server on http://localhost:5173
frontend:
	cd frontend && npm run dev

# Installs frontend dependencies (run once, or after pulling new deps)
install:
	cd frontend && npm install

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

# Creates backend/appsettings.Local.json from the example if it doesn't exist yet
configure:
	@if [ -f backend/appsettings.Local.json ]; then \
		echo "backend/appsettings.Local.json already exists - edit it directly to add/change agents."; \
	else \
		cp backend/appsettings.Local.json.example backend/appsettings.Local.json; \
		echo "Created backend/appsettings.Local.json - edit it to point at your agent repos."; \
	fi
