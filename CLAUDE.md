# Oceancide

Juego 3D roguelite (Three.js + TypeScript + Vite) sobre una tortuga que limpia el océano. Gestor de paquetes: **Bun**.

## Reglas de trabajo

- **Nunca hagas commits** (ni `git commit` ni amend). Deja los cambios sin commitear en el working tree; el usuario commitea.
- **Nunca te añadas como coautor**: ningún `Co-Authored-By`, ni "Generated with Claude Code" en commits, PRs o código.
- No hagas push ni abras PRs salvo que se pida explícitamente.
- Responde en español.

## Textos del juego

- **Español de México** en todo texto visible (#113): popote, llanta, unicel, chapopote, tambo, pila, hule; «control» (no «mando»), «Configuración» (no «Ajustes»), «presiona» (no «pulsa»). Trato de tú y pretérito simple para lo ya terminado («presionaste», no «has pulsado»).
- Números con `LOCALE` de `@core/locale` (`"es-MX"`): coma de miles y punto decimal («20,000», «1.5»). Porcentajes sin espacio («60%»).

## Comandos

- `bun install` · `bun run dev` · `bun run build`
- `bun run typecheck` · `bun run lint` · `bun run format:check`
- `bun run test:run` (vitest)

Antes de dar una tarea por terminada: typecheck, lint, prettier y tests deben pasar.

## Estructura (`src/`)

- `core/` Game, InputController, MetaState (guardado en localStorage), rng
- `cards/` mazo, rarezas y `CardManager` (pity)
- `entities/`, `world/` (biomas, transición), `events/`, `tycoon/` (mejoras), `ui/`

Alias de imports: `@core`, `@cards`, `@entities`, `@world`, `@tycoon`, etc.

## Issues

Los issues están en GitHub (`gh issue list`). Un issue = una rama (`fix/<n>-...` o `feat/<n>-...`) desde `main`.
