from setuptools import setup, find_packages

setup(
    name="china-auto-sales-backend",
    version="0.1.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "fastapi>=0.95.0",
        "uvicorn>=0.21.0",
        "python-dotenv>=1.0.0",
        "supabase>=1.0.3",
        "httpx>=0.24.0",
        "pydantic>=2.0.0",
        "openai>=1.0.0",
        "requests>=2.28.0",
        "asyncio>=3.4.3",
        "aiohttp>=3.8.4",
        "beautifulsoup4>=4.12.0",
        "pandas>=2.0.0",
        "numpy>=1.24.0",
        "tenacity>=8.2.0",
    ],
    entry_points={
        "console_scripts": [
            "china-auto-sales-api=src.api.main:run_server",
        ],
    },
)
