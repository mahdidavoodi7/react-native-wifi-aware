/**
 * Ownership handle for a registered listener.
 *
 * Every `addOn…Listener` method returns one. Hold it for as long as you want the callback to fire,
 * and call {@linkcode ListenerSubscription.remove} to stop it — from a `useEffect` cleanup, a
 * component unmount, or wherever the owning scope ends. Listeners left registered keep native
 * resources alive.
 *
 * @example
 * ```ts
 * useEffect(() => {
 *   const sub = connection.addOnMessageListener(handleMessage)
 *   return () => sub.remove()
 * }, [connection])
 * ```
 */
export interface ListenerSubscription {
  /**
   * Stops the listener from receiving further events.
   *
   * Safe to call more than once; subsequent calls do nothing. An event already in flight when
   * `remove()` runs may still be delivered.
   */
  remove(): void;
}
