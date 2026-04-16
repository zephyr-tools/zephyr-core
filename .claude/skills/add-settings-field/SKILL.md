---
name: add-settings-field
description: Add a new user-configurable setting (API key, toggle, etc.) end-to-end through types, defaults, UI, and consumption. Use when adding a new configuration option.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# Add Settings Field: $ARGUMENTS

Add a new setting called `$ARGUMENTS` across all layers.

## Steps — implement in order:

### 1. Add to `AppSettings` in `src/shared/types.ts`
```ts
export interface AppSettings {
  // ... existing fields
  $ARGUMENTS: string | null;  // or boolean, number — adjust type as needed
}
```

### 2. Set default in `src/main/settings.ts`
```ts
const DEFAULTS: AppSettings = {
  // ... existing
  $ARGUMENTS: process.env.ENV_VAR_NAME ?? null,  // env fallback if applicable, otherwise just null
};
```
Note: the merge logic in `SettingsStore` skips stored `null` values, so env defaults always work as fallback.

### 3. Add UI in `src/renderer/components/SettingsDialog.tsx`

Add to the `save.mutate()` call in the form `onSubmit`:
```ts
$ARGUMENTS: draft.$ARGUMENTS?.trim() || null,
```

Add a `<Field>` block (before the "Image cache" field):
```tsx
<Field
  icon={<IconName className="h-4 w-4 text-zinc-500" />}
  label="Human-readable label"
  hint="What this setting does and where to get it."
>
  <input
    type="password"  // or "text" for non-secrets
    value={draft.$ARGUMENTS ?? ''}
    onChange={(e) => setDraft({ ...draft, $ARGUMENTS: e.target.value })}
    placeholder="Placeholder..."
    className={inputClass}
  />
</Field>
```

Import the icon from `lucide-react` if not already imported. Common choices: `Key`, `Cloud`, `Shield`, `Globe`, `Lock`.

### 4. Consume in main process
Access via getter callback pattern:
```ts
const myService = new MyService(() => settings.snapshot().$ARGUMENTS);
```
Or inline: `const value = settings.snapshot().$ARGUMENTS;`

### 5. Verify
Run `npm run typecheck`.
