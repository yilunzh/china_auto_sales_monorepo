from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import scraper
from .routers import sql  # Import our new SQL router
from .jobs import router as jobs_router  # Updated import

app = FastAPI(title="China Auto Sales Scraper API")

# Add CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the scraper router
app.include_router(scraper.router, prefix="/scraper", tags=["scraper"])
app.include_router(jobs_router, prefix="/api")  # Add the jobs router
app.include_router(sql.router, prefix="/sql", tags=["sql"])  # Add the SQL router

def run_server():
    """Entry point for the application."""
    import uvicorn
    import os
    
    # Get port from environment or use default
    port = int(os.environ.get("PORT", os.environ.get("API_PORT", 8000)))
    
    # In production, bind to 0.0.0.0
    host = "0.0.0.0"
    
    # Disable reload in production
    reload_mode = os.environ.get("PYTHON_ENV", "development") != "production"
    
    print(f"Starting FastAPI server on {host}:{port} (reload: {reload_mode})...")
    uvicorn.run("src.api.main:app", host=host, port=port, reload=reload_mode)

if __name__ == "__main__":
    run_server() 