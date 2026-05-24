# Security Policy

## Security model

QueryForge MCP is an **analysis-only** MCP server. It is designed to inspect .NET project files and query snippets without executing application logic or touching production systems.

### What QueryForge does NOT do

- Does **not** execute SQL
- Does **not** connect to databases
- Does **not** modify project files
- Does **not** run arbitrary shell commands
- Does **not** write to the filesystem (except normal Node/npm runtime behavior)

### What QueryForge reads

- Files under the user-provided `projectPath` only
- Common .NET artifacts: `.csproj`, `Directory.Build.props`, `packages.config`, optional `.cs` snippets passed as tool input
- Ignores `bin/`, `obj/`, `node_modules/`, `.git`, and similar directories

### Protections

- Path traversal checks via `resolveSafePath`
- File size limits (512 KB per file)
- Directory depth limits
- Connection strings and secrets are masked in outputs when detected

## Supported versions

Security fixes are provided for the latest release on the `main` branch and the latest GitHub release tag.

## Reporting a vulnerability

If you believe you found a security issue, please **do not** open a public GitHub issue with exploit details.

Instead:

1. Email or open a private security advisory on GitHub (preferred when available)
2. Include:
   - Description of the issue
   - Steps to reproduce
   - Impact assessment
   - Suggested fix (if any)

We aim to acknowledge reports within 7 days.

## Out of scope

The following are generally **out of scope** for QueryForge security reports:

- Performance issues in analyzed queries (use normal issue tracker)
- Incorrect optimization suggestions without a security impact
- Issues in third-party MCP clients (Cursor, Claude Desktop, VS Code extensions)
- Social engineering or physical access scenarios

## User responsibilities

- Provide `projectPath` only to directories you trust
- Review all suggested query changes manually before applying them
- Validate index and SQL suggestions with execution plans in your environment
- Keep MCP client configurations private if they contain local paths or secrets

## License

QueryForge MCP is released under the MIT License. See [LICENSE](LICENSE).
