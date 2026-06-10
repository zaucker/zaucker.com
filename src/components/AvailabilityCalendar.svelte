<script lang="ts">
  import { onMount } from 'svelte';
  import { buildMonths, dayState, type Availability, type DayState } from '@/lib/availability';
  import { pager } from '@/lib/calendarPager.svelte';

  interface Labels { free: string; booked: string; loading: string; error: string; updated: string; refresh: string; }
  let { apartmentId, locale, labels }:
    { apartmentId: string; locale: string; labels: Labels } = $props();

  let state = $state<'loading' | 'ok' | 'error'>('loading');
  let data = $state<Availability | null>(null);
  let refreshing = $state(false);

  const months = buildMonths(new Date(), 12);

  // Show 3 months at a time, advancing one month per step (the full year is too tall).
  // `pager` is shared across all calendar islands so they page together.
  const PAGE = 3;
  const STEP = 1;
  const maxStart = months.length - PAGE;
  const visibleMonths = $derived(months.slice(pager.start, pager.start + PAGE));
  function pagePrev() { pager.start = Math.max(0, pager.start - STEP); }
  function pageNext() { pager.start = Math.min(maxStart, pager.start + STEP); }
  const monthName = (y: number, m: number) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(y, m, 1));
  // Monday-first weekday initials. 2024-01-01 is a Monday, so this yields Mon…Sun.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)),
  );
  // Leading blank cells before day 1 (Monday-first).
  const leadBlanks = (y: number, m: number) => (new Date(y, m, 1).getDay() + 6) % 7;

  // Booked fill (stone-300). Half-days are drawn with a diagonal gradient split
  // along the anti-diagonal: morning = upper-left, afternoon = lower-right. The
  // booked triangles stop a little short of the centre so a same-day turnover
  // shows two distinct triangles (two guests) with a thin free sliver between.
  const BOOKED = '#c8bca7';
  function cellStyle(s: DayState): string {
    switch (s) {
      case 'full':     return `background-image:linear-gradient(${BOOKED},${BOOKED})`;
      case 'checkout': return `background-image:linear-gradient(to bottom right,${BOOKED} 0 47%,transparent 47%)`;
      case 'checkin':  return `background-image:linear-gradient(to bottom right,transparent 0 53%,${BOOKED} 53%)`;
      case 'turnover': return `background-image:linear-gradient(to bottom right,${BOOKED} 0 46%,transparent 46% 54%,${BOOKED} 54%)`;
      default:         return '';
    }
  }

  onMount(async () => {
    try {
      const res = await fetch(`/api/availability/${apartmentId}`);
      if (!res.ok) throw new Error();
      data = await res.json();
      state = 'ok';
    } catch {
      state = 'error';
    }
  });

  const bookings = $derived(data?.bookings ?? []);

  // Force the service to re-poll the feeds, then show the fresh result.
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const res = await fetch(`/api/availability/${apartmentId}/refresh`, { method: 'POST' });
      if (res.ok) data = await res.json();
    } catch {
      /* keep showing the current data */
    }
    refreshing = false;
  }
</script>

{#if state === 'loading'}
  <p class="text-stone-500 text-sm">{labels.loading}</p>
{:else if state === 'error'}
  <p class="text-stone-500 text-sm">{labels.error}</p>
{:else}
  <div class="flex items-center gap-4 text-sm text-stone-600 mb-4">
    <span class="inline-flex items-center gap-1.5">
      <span class="w-3.5 h-3.5 rounded-sm bg-white ring-1 ring-stone-300"></span>{labels.free}
    </span>
    <span class="inline-flex items-center gap-1.5">
      <span class="w-3.5 h-3.5 rounded-sm bg-stone-300"></span>{labels.booked}
    </span>
    {#if data}
      <span class={`ml-auto inline-flex items-center gap-1.5 ${data.stale ? 'text-sun-dark' : 'text-stone-400'}`}>
        {labels.updated}: {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data.updatedAt))}{data.stale ? ' ⚠' : ''}
        <button type="button" onclick={refresh} disabled={refreshing} title={labels.refresh} aria-label={labels.refresh}
          class="p-0.5 rounded hover:text-lake disabled:opacity-50 transition-colors">
          <svg class={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </span>
    {/if}
  </div>

  <div class="flex items-center justify-between mb-3">
    <button type="button" onclick={pagePrev} disabled={pager.start === 0} aria-label="Previous months"
      class="px-3 py-1.5 rounded-md border border-stone-200 text-stone-600 text-lg leading-none hover:border-lake hover:text-lake disabled:opacity-40 disabled:hover:border-stone-200 disabled:hover:text-stone-600 transition-colors">‹</button>
    <button type="button" onclick={pageNext} disabled={pager.start >= maxStart} aria-label="Next months"
      class="px-3 py-1.5 rounded-md border border-stone-200 text-stone-600 text-lg leading-none hover:border-lake hover:text-lake disabled:opacity-40 disabled:hover:border-stone-200 disabled:hover:text-stone-600 transition-colors">›</button>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {#each visibleMonths as mo}
      <div>
        <div class="font-display font-semibold text-ink mb-2 capitalize">{monthName(mo.year, mo.month)}</div>
        <div class="grid grid-cols-7 gap-1 text-center text-xs">
          {#each weekdays as wd}
            <div class="text-stone-400 font-medium py-1">{wd}</div>
          {/each}
          {#each Array.from({ length: leadBlanks(mo.year, mo.month) }) as _}
            <div></div>
          {/each}
          {#each mo.days as day}
            {@const s = dayState(day, bookings)}
            <div
              aria-label={`${day} — ${s === 'free' ? labels.free : labels.booked}`}
              class="py-1 rounded-sm ring-1 ring-stone-200 bg-white text-stone-700"
              style={cellStyle(s)}>
              {Number(day.slice(8))}
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}
