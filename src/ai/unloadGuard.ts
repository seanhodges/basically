import { useAiStore, type DisplayMessage } from './aiStore';

/**
 * Make the browser confirm before leaving while an answer is still arriving.
 *
 * A stream cannot be resumed, so a reload part-way through costs the user the
 * answer. That case is handled once it happens - the part that arrived is kept,
 * marked as cut short, and offered to be asked again - but the cheapest thing is
 * for the reload nobody meant not to happen at all.
 *
 * What this cannot do is worth being clear about: `beforeunload` fires for a page
 * the browser is unloading while it is still alive. A tab the OS discards, a
 * crash, or a browser that ignores it entirely all still reach the interrupted
 * path. This makes that path rarer, it does not remove it.
 *
 * The condition is an answer actually arriving, not the assistant being busy.
 * The assistant is also busy while it runs an answer on the machine and while it
 * looks at the screen, and by then the answer itself is complete and stored -
 * only the verdict would be lost, which is not worth stopping the user for.
 */
function answerArriving(messages: readonly DisplayMessage[]): boolean {
  // `streaming` is set on every kind of arriving answer - the one the user asked
  // for, a reformat retry, an unrequested correction - so none has to be named.
  return messages.some((m) => m.streaming === true);
}

/** What the guard needs of the window, so a test can pass something smaller. */
type UnloadTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

/**
 * Arm the guard for the life of the app, returning the undo. Called from the IDE
 * shell rather than the entry module: the entry deliberately loads neither the
 * editor nor the assistant, so that the standalone player pays for neither.
 *
 * The target is a parameter rather than a reach for the global so the tests can
 * watch a plain object. They run under node, where declaring a global `window`
 * is not free - the machine cores read it to decide they are in a browser.
 */
export function installUnloadGuard(
  target: UnloadTarget | null = typeof window === 'undefined' ? null : window,
): () => void {
  if (!target) return () => {};

  let armed = false;

  const warn = (event: BeforeUnloadEvent) => {
    // Both triggers, because browsers disagree on which one raises the prompt.
    // Neither shows words of ours - the browser supplies its own - so there is
    // no message here to write.
    event.preventDefault();
    event.returnValue = '';
  };

  const sync = (messages: readonly DisplayMessage[]) => {
    const wanted = answerArriving(messages);
    if (wanted === armed) return;
    armed = wanted;
    if (wanted) target.addEventListener('beforeunload', warn);
    else target.removeEventListener('beforeunload', warn);
  };

  sync(useAiStore.getState().messages);
  const unsubscribe = useAiStore.subscribe((s) => sync(s.messages));

  return () => {
    unsubscribe();
    sync([]);
  };
}
