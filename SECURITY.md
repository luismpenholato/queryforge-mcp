# Security Policy

## Security model

QueryForge MCP is an **analysis-only** MCP server. It reviews C# query snippets passed as tool input. It does not execute application code, SQL, or shell commands.

### What QueryForge does NOT do

- Does **not** execute SQL
- Does **not** connect to databases
- Does **not** modify project files
- Does **not** read arbitrary filesystem paths from tool input
- Does **not** run shell commands

### What QueryForge processes

- C# query code and optional context strings provided through MCP tools
- Local Node.js runtime files required to start the MCP server

## Supported versions

Security fixes are provided for the latest release on the `main` branch and the latest GitHub release tag.

## Reporting a vulnerability

If you believe you found a security issue, please **do not** open a public GitHub issue with exploit details.

Instead, open a private security advisory on GitHub when available, or contact the maintainer through the repository issue tracker without publishing exploit details.

Include:

- Description of the issue
- Steps to reproduce
- Impact assessment
- Suggested fix (if any)

## Out of scope

The following are generally **out of scope** for QueryForge security reports:

- Performance issues in analyzed queries (use the normal issue tracker)
- Incorrect optimization suggestions without a security impact
- Issues in third-party MCP clients (Cursor, Claude Desktop, VS Code extensions)

## User responsibilities

- Review all suggested query changes manually before applying them
- Validate SQL and behavior with tests and execution plans in your environment
- Keep MCP client configurations private if they contain local paths or secrets

## License

QueryForge MCP is released under the MIT License. See [LICENSE](LICENSE).
