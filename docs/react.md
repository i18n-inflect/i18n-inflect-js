# React recipe

i18n-inflect ships no React dependency — this pattern is all you need.

The idea: render the synchronous answer immediately (rules are ~93%+ correct on
unseen words, 100% on known vocabulary), then let the async pass upgrade the string
if the neural fallback knows better. Because answers are cached in a shared oracle,
each word is asked **once per session** — after that, the sync path is already
correct.

```tsx
import { useEffect, useState } from "react";
import { format, formatAsync, type TemplateArgs } from "i18n-inflect";

export function useInflect(locale: string, template: string, args?: TemplateArgs): string {
  // Sync render: rules + lexicon + previously cached fallback answers.
  const sync = format(locale, template, args);
  const [text, setText] = useState(sync);

  useEffect(() => {
    let alive = true;
    setText(sync);
    // Async upgrade: only re-renders when the fallback actually changed something.
    formatAsync(locale, template, args).then((upgraded) => {
      if (alive && upgraded !== sync) setText(upgraded);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- args compared by content
  }, [locale, template, JSON.stringify(args)]);

  return text;
}
```

```tsx
function WinBanner({ card }: { card: string }) {
  const text = useInflect("hu", "Nyertél ^[a {card}](case: instrumental)!", { card });
  return <p>{text}</p>;
}
```

Tips:

- Call `preload("hu")` once at app boot (e.g. in your i18n init) so the first async
  upgrade doesn't pay session-creation latency.
- Words answered by rules with high confidence never trigger the fallback at all —
  `formatAsync` resolves synchronously-fast in the common case.
- SSR: use plain `format()` on the server; hydrate with the same string; the client
  effect upgrades after mount if needed.
