"""MCP Document Fetcher Server

Provides tools for fetching and cleaning web documentation.
"""

__version__ = "0.1.0"

from .server import app, main

__all__ = ["app", "main", "__version__"]
