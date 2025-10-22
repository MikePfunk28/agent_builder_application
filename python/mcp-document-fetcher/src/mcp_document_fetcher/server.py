"""
MCP Document Fetcher Server

Provides tools for fetching and cleaning web documentation:
- fetch_url: Fetch and clean a single web page
- parse_llms_txt: Parse an llms.txt file and extract links
- fetch_documentation: Fetch multiple pages from llms.txt
"""

import html
import re
import urllib.request
from dataclasses import dataclass
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent


# Example: "[Quickstart](https://strandsagents.com/.../index.md)"
_MD_LINK = re.compile(r"\[([^\]]+)\]\((https?://[^\)]+)\)")
_HTML_BLOCK = re.compile(r"(?is)<(script|style|noscript).*?>.*?</\1>")
_TAG = re.compile(r"(?s)<[^>]+>")
_TITLE_TAG = re.compile(r"(?is)<title[^>]*>(.*?)</title>")
_H1_TAG = re.compile(r"(?is)<h1[^>]*>(.*?)</h1>")
_META_OG = re.compile(r'(?is)<meta[^>]+property=["\']og:title["\'][^>]+content=["\'](.*?)["\']')

# Configuration
USER_AGENT = "Mozilla/5.0 (compatible; MCP-DocumentFetcher/1.0)"
TIMEOUT = 30


@dataclass
class Page:
    """Represents a fetched and cleaned documentation page.

    Attributes:
        url: The source URL of the page
        title: Extracted or derived title of the page
        content: Cleaned text content of the page
    """

    url: str  # Source URL of the page
    title: str  # Page title (extracted or derived)
    content: str  # Cleaned text content


def _get(url: str) -> str:
    """Fetch content from a URL with proper headers and timeout.

    Args:
        url: The URL to fetch

    Returns:
        The decoded text content of the response

    Raises:
        urllib.error.URLError: If the request fails
    """
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read().decode("utf-8", errors="ignore")


def parse_llms_txt(url: str) -> list[tuple[str, str]]:
    """Parse an llms.txt file and extract document links.

    Args:
        url: URL of the llms.txt file to parse

    Returns:
        List of (title, url) tuples extracted from markdown links

    """
    txt = _get(url)
    return [
        (match.group(1).strip() or match.group(2).strip(), match.group(2).strip())
        for match in _MD_LINK.finditer(txt)
    ]


def _html_to_text(raw_html: str) -> str:
    """Convert HTML to plain text using stdlib only.

    Args:
        raw_html: Raw HTML content to convert

    Returns:
        Plain text with HTML tags removed and entities unescaped

    """
    stripped = _HTML_BLOCK.sub("", raw_html)  # remove script/style
    stripped = _TAG.sub(" ", stripped)  # drop tags
    stripped = html.unescape(stripped)
    # normalize whitespace, remove empty lines
    lines = [ln.strip() for ln in stripped.splitlines()]
    return "\n".join(ln for ln in lines if ln)


def _extract_html_title(raw_html: str) -> str | None:
    """Extract title from HTML content using multiple strategies.

    Args:
        raw_html: Raw HTML content to extract title from

    Returns:
        Extracted title string, or None if no title found

    """
    match = _TITLE_TAG.search(raw_html)
    if match:
        return html.unescape(match.group(1)).strip()
    match = _META_OG.search(raw_html)
    if match:
        return html.unescape(match.group(1)).strip()
    match = _H1_TAG.search(raw_html)
    if match:
        inner = _TAG.sub(" ", match.group(1))
        return html.unescape(inner).strip()
    return None


def fetch_and_clean(page_url: str) -> Page:
    """Fetch a web page and return cleaned content.

    Args:
        page_url: URL of the page to fetch

    Returns:
        Page object with URL, title, and cleaned content

    """
    raw = _get(page_url)
    lower = raw.lower()
    if "<html" in lower or "<head" in lower or "<body" in lower:
        extracted_title = _extract_html_title(raw)
        content = _html_to_text(raw)
        title = extracted_title or page_url.rsplit("/", 1)[-1] or page_url
        return Page(url=page_url, title=title, content=content)
    else:
        title = page_url.rsplit("/", 1)[-1] or page_url
        return Page(url=page_url, title=title, content=raw)


# MCP Server Implementation
app = Server("document-fetcher")


@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available tools."""
    return [
        Tool(
            name="fetch_url",
            description="Fetch and clean a web page, converting HTML to plain text",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The URL of the page to fetch",
                    }
                },
                "required": ["url"],
            },
        ),
        Tool(
            name="parse_llms_txt",
            description="Parse an llms.txt file and extract documentation links",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The URL of the llms.txt file to parse",
                    }
                },
                "required": ["url"],
            },
        ),
        Tool(
            name="fetch_documentation",
            description="Fetch multiple documentation pages from an llms.txt file",
            inputSchema={
                "type": "object",
                "properties": {
                    "llms_txt_url": {
                        "type": "string",
                        "description": "The URL of the llms.txt file",
                    },
                    "max_pages": {
                        "type": "number",
                        "description": "Maximum number of pages to fetch (default: 10)",
                        "default": 10,
                    },
                },
                "required": ["llms_txt_url"],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Handle tool calls."""

    if name == "fetch_url":
        url = arguments["url"]
        try:
            page = fetch_and_clean(url)
            result = f"# {page.title}\n\nURL: {page.url}\n\n{page.content}"
            return [TextContent(type="text", text=result)]
        except Exception as e:
            return [TextContent(type="text", text=f"Error fetching URL: {str(e)}")]

    elif name == "parse_llms_txt":
        url = arguments["url"]
        try:
            links = parse_llms_txt(url)
            result = "# Documentation Links\n\n"
            for title, link_url in links:
                result += f"- [{title}]({link_url})\n"
            return [TextContent(type="text", text=result)]
        except Exception as e:
            return [TextContent(type="text", text=f"Error parsing llms.txt: {str(e)}")]

    elif name == "fetch_documentation":
        llms_txt_url = arguments["llms_txt_url"]
        max_pages = arguments.get("max_pages", 10)

        try:
            # Parse llms.txt to get links
            links = parse_llms_txt(llms_txt_url)

            # Fetch pages (up to max_pages)
            pages = []
            for title, url in links[:max_pages]:
                try:
                    page = fetch_and_clean(url)
                    pages.append(page)
                except Exception as e:
                    # Skip failed pages
                    pages.append(Page(url=url, title=title, content=f"Error: {str(e)}"))

            # Format results
            result = f"# Documentation (fetched {len(pages)} pages)\n\n"
            for page in pages:
                result += f"## {page.title}\n\n"
                result += f"URL: {page.url}\n\n"
                result += f"{page.content[:500]}...\n\n"
                result += "---\n\n"

            return [TextContent(type="text", text=result)]
        except Exception as e:
            return [TextContent(type="text", text=f"Error fetching documentation: {str(e)}")]

    else:
        return [TextContent(type="text", text=f"Unknown tool: {name}")]


def main():
    """Run the MCP server."""
    import asyncio
    asyncio.run(stdio_server(app))


if __name__ == "__main__":
    main()
