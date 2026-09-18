# CLAUDE.md

## Project Structure

Codenora is a **monorepo** comprising the Codenora visual learning application and the underlying editable canvas engine:

- **`codenora-app/`** - Full-featured Codenora web application with Cognora AI visual teaching engine
- **`packages/excalidraw/`** - Core editable canvas library
- **`packages/`** - Core packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`

## Development Workflow

1. **Package Development**: Work in `packages/*` for canvas editor features
2. **App Development**: Work in `codenora-app/` for Codenora features and AI teaching system
3. **Testing**: Always run `yarn test` before committing
4. **Type Safety**: Use `yarn test:typecheck` to verify TypeScript

## Development Commands

```bash
yarn test:typecheck  # TypeScript type checking
yarn test            # Run test suites
yarn test:code       # ESLint validation
yarn test:other      # Prettier formatting verification
yarn build           # Production bundle build
yarn start           # Development server
```

## Architecture Notes

### Package System

- Uses Yarn workspaces for monorepo management (`codenora-app`, `packages/*`)
- Internal packages use path aliases (see `vitest.config.mts` and `tsconfig.json`)
- Build system uses Vite for `codenora-app`
- TypeScript throughout with strict configuration
