"""Invoke the installed official MCP via stdio, for sessions before tool refresh.

Usage: .tools/blender-mcp-venv/Scripts/python scripts/blender-mcp-call.py --list
       ... scripts/blender-mcp-call.py TOOL --arguments path/to/arguments.json
       ... scripts/blender-mcp-call.py --script path/to/blender-code.py
The supplied script runs in Blender; only use code you intend to execute.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parent.parent

async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('tool', nargs='?')
    parser.add_argument('--list', action='store_true')
    parser.add_argument('--arguments', type=Path)
    parser.add_argument('--script', type=Path)
    args = parser.parse_args()
    if not args.list and not args.tool and not args.script:
        parser.error('Choose --list, TOOL, or --script.')
    environment = dict(os.environ, BLENDER_MCP_HOST='127.0.0.1', BLENDER_MCP_PORT='9877',
                       BLENDER_PATH=str(ROOT / '.tools/blender-5.1.2-windows-x64/blender.exe'))
    server = StdioServerParameters(command=str(ROOT / '.tools/blender-mcp-venv/Scripts/blender-mcp.exe'), env=environment)
    async with stdio_client(server) as (reader, writer):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            if args.list:
                result = await session.list_tools()
                print(json.dumps([{'name': tool.name, 'inputSchema': tool.inputSchema} for tool in result.tools], indent=2))
                return
            if args.script:
                code = '__file__ = ' + repr(str(args.script.resolve())) + '\n' + args.script.read_text(encoding='utf-8')
                tool, arguments = 'execute_blender_code', {'code': code}
            else:
                tool = args.tool
                arguments = json.loads(args.arguments.read_text(encoding='utf-8')) if args.arguments else {}
            result = await session.call_tool(tool, arguments)
            print(result.model_dump_json(indent=2))
            failed = bool(result.isError)
            # The bridge also reports Python errors inside the tool's result.
            for block in result.content:
                if getattr(block, 'type', None) == 'text':
                    try:
                        value = json.loads(block.text)
                    except (ValueError, TypeError):
                        continue
                    if isinstance(value, dict) and value.get('status') == 'error':
                        failed = True
    return 1 if failed else 0

if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
