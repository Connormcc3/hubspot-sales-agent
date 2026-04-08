# Contributing to HubSpot Email Agent

Thanks for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a branch: `git checkout -b feature/your-feature`

## Development

### Project Structure

- **`program.md`** — The agent's instruction set (loop logic, constraints, error handling)
- **`CLAUDE.md`** — Email generation rules (tone, examples, quality standards)
- **`prompts/run-followup.md`** — Execution mode prompts
- **`src/tracker.js`** — TSV tracking utility

### Making Changes

- Edit `program.md` to change agent behavior
- Edit `CLAUDE.md` to change email generation rules
- Edit `src/tracker.js` to modify tracking logic

## Submitting Changes

1. Test your changes with a real HubSpot workspace (use Preview mode for safe testing)
2. Ensure no personal data or API credentials are included
3. Commit with a clear message
4. Push to your fork and open a Pull Request

## Reporting Issues

- Use the [Bug Report](https://github.com/Dominien/hubspot-email-agent/issues/new?template=bug_report.md) template for bugs
- Use the [Feature Request](https://github.com/Dominien/hubspot-email-agent/issues/new?template=feature_request.md) template for ideas

## Questions?

Open a [Discussion](https://github.com/Dominien/hubspot-email-agent/discussions).
