<script lang="ts">
  import { onMount } from 'svelte';
  import { buildMonths, isBooked, type Availability } from '@/lib/availability';

  interface Labels { free: string; booked: string; loading: string; error: string; updated: string; }
  let { apartmentId, locale, labels }:
    { apartmentId: string; locale: string; labels: Labels } = $props();

  let state = $state<'loading' | 'ok' | 'error'>('loading');
  let data = $state<Availability | null>(null);

  const months = buildMonths(new Date(), 12);
  const monthName = (y: number, m: number) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(y, m, 1));
  // Monday-first weekday initials. 2024-01-01 is a Monday, so this yields Mon…Sun.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)),
  );
  // Leading blank cells before day 1 (Monday-first).
  const leadBlanks = (y: number, m: number) => (new Date(y, m, 1).getDay() + 6) % 7;

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

  const busy = $derived(data?.busy ?? []);
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
      <span class="ml-auto text-stone-400">
        {labels.updated}: {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data.updatedAt))}
      </span>
    {/if}
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {#each months as mo}
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
            <div
              class={`py-1 rounded-sm ${isBooked(day, busy)
                ? 'bg-stone-300 text-stone-500 line-through'
                : 'bg-white ring-1 ring-stone-200 text-stone-700'}`}>
              {Number(day.slice(8))}
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}
