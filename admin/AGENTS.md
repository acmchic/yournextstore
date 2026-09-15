# Admin UI component rules

These rules apply to all frontend work under `admin/`.

## Reuse the shared UI system

- Before creating UI, inspect `resources/js/components/ui/` and reuse the existing component whenever the primitive exists.
- Use shared `Button`, `Input`, `Label`, `Select`, `Checkbox`, `Card`, `Badge`, `Dialog`, and `Spinner` components instead of native controls or one-off Tailwind implementations.
- All loading indicators must use `@/components/ui/spinner`. Do not add a second spinner, `LoaderCircle`, inline SVG, or ad-hoc `animate-spin` implementation.
- If a required primitive does not exist, add a shadcn-compatible component under `resources/js/components/ui/`, then use that component everywhere the same primitive is needed.
- Repeated page patterns such as master-detail lists, resource pickers, filters, and empty states must become shared components instead of being duplicated in individual pages.
- Keep visual states consistent: selected, hover, focus-visible, disabled, loading, empty, and error states must be styled through the shared component or its variants.
- Do not use raw `<select>`, `<textarea>`, checkbox inputs, or submit/action buttons in pages when a shared component is available. Native controls are allowed only inside the implementation of a shared primitive or when a third-party integration explicitly requires them.
- Do not add a new UI library when an existing primitive or shadcn-compatible component can solve the problem.

## Before finishing

- Search the changed admin UI for duplicate native controls and one-off loading indicators.
- Run `npm run types:check`, `npm run build`, and the relevant formatter/lint check.
- Check the changed page in light and dark mode and verify keyboard focus for interactive controls.
