/// <reference types="node" />
import fs from "node:fs";
import path from "node:path";
import type { RequireContext } from "expo-router/build/types";
// Deep-imports expo-router's own route-generation internals rather than the
// package's public "expo-router" entry point, so this keeps working even in
// test files that `jest.mock("expo-router", ...)` to stub `<Tabs>` — that
// mock only intercepts the "expo-router" module specifier, not this one.
import { getRoutes } from "expo-router/build/getRoutes";

/**
 * Walks a route group's directory (e.g. `app/(client)/`) and returns the
 * screen names expo-router's own `getRoutes()` would register on that
 * group's own `_layout` — the same hoisting/naming rules the real app uses
 * at runtime (routes in a subdirectory with no `_layout.tsx` of its own are
 * hoisted into the nearest ancestor `_layout`, named by their path relative
 * to it; a subdirectory that DOES have one registers as a single entry named
 * after the directory, and owns its children itself).
 *
 * This exists so a layout's tests can assert against expo-router's actual
 * behavior instead of against a hand-typed list of expected route names —
 * a hand-typed list agrees with itself by construction and can't catch a
 * renamed file or a wrong hidden-route name silently turning `href: null`
 * into a no-op.
 */
export function registeredRouteNames(groupDir: string): string[] {
  const files = collectRouteFiles(groupDir);
  const contextModule = makeSyntheticContext(files);
  const root = getRoutes(contextModule, { ignoreRequireErrors: true });
  if (!root) return [];

  // Only the group `_layout`'s DIRECT children — those are exactly the names
  // it must declare a `<Tabs.Screen>`/`<Stack.Screen>` for. A route in a
  // subdirectory that has its own `_layout.tsx` is NOT one of them: it
  // belongs to that nested layout and shows up here only as the single
  // subtree entry (e.g. `fis`, `mukellef`), which is the whole point of
  // nesting it. Descending into nested layouts would instead report their
  // children under names this layout never registers.
  //
  // Expo-router's generated `_sitemap` / `+not-found` routes are marked
  // `internal: true`; neither is a route this app's own files declare.
  return root.children.filter((child) => !child.internal).map((child) => child.route);
}

/** Recursively lists a route group's own route files as "./relative/path" context keys, skipping `__tests__`. */
function collectRouteFiles(dir: string, base = ""): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "__tests__") continue;
    const relativePath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...collectRouteFiles(path.join(dir, entry.name), relativePath));
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(`./${relativePath}`);
    }
  }
  return files;
}

/** A minimal `RequireContext` whose modules are never actually loaded — `getRoutes()` only needs the file list and each file's meta (derived from its name), not its contents. */
function makeSyntheticContext(files: string[]): RequireContext {
  const contextModule = ((_id: string) => ({ default: () => null })) as RequireContext;
  contextModule.keys = () => files;
  contextModule.resolve = (id: string) => id;
  contextModule.id = "synthetic-route-context";
  return contextModule;
}
