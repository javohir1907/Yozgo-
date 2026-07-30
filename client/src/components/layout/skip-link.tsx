/**
 * Keyboard users' first Tab lands here and jumps past the nav to the main
 * content. Visually hidden until focused. Must be the first focusable element
 * in the tree, so it is rendered before NavHeader in App.tsx.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[300] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
    >
      Asosiy kontentga o'tish
    </a>
  );
}
