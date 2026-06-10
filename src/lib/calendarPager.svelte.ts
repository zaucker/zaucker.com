// Shared pager state so all AvailabilityCalendar islands page together.
// A module-level rune is a singleton in the browser, so every calendar instance
// reads/writes the same `start` and stays in sync.
export const pager = $state({ start: 0 });
