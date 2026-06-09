<script lang="ts">
  interface Item { thumb: string; full: string; alt: string; w: number; h: number; }
  let { items, columns = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4', moreLabel = 'Show all photos', lessLabel = 'Show fewer' }:
    { items: Item[]; columns?: string; moreLabel?: string; lessLabel?: string } = $props();

  let open = $state(false);
  let index = $state(0);
  let collapsed = $state(true);
  let cols = $state(4);

  // Track how many thumbnails make up one row at the current breakpoint.
  $effect(() => {
    const lg = window.matchMedia('(min-width: 1024px)');
    const sm = window.matchMedia('(min-width: 640px)');
    const update = () => { cols = lg.matches ? 4 : sm.matches ? 3 : 2; };
    update();
    lg.addEventListener('change', update);
    sm.addEventListener('change', update);
    return () => { lg.removeEventListener('change', update); sm.removeEventListener('change', update); };
  });

  let visible = $derived(collapsed ? items.slice(0, cols) : items);
  let hasMore = $derived(items.length > cols);

  function show(i: number) { index = i; open = true; }
  function close() { open = false; }
  function next() { index = (index + 1) % items.length; }
  function prev() { index = (index - 1 + items.length) % items.length; }

  function onKey(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
  }
</script>

<svelte:window on:keydown={onKey} />

<div class={`gallery-grid grid ${columns} gap-2`}>
  {#each visible as item, i}
    <button type="button" class="block overflow-hidden rounded-lg group aspect-[4/3]" onclick={() => show(i)} aria-label={item.alt}>
      <img src={item.thumb} width={item.w} height={item.h} alt={item.alt} loading="lazy"
           class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
    </button>
  {/each}
</div>

{#if hasMore}
  <div class="mt-3 text-center">
    <button type="button" onclick={() => collapsed = !collapsed}
      class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-stone-300 text-sm font-medium text-stone-700 hover:border-lake hover:text-lake transition-colors">
      {collapsed ? `${moreLabel} (${items.length})` : lessLabel}
    </button>
  </div>
{/if}

{#if open}
  <div class="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onclick={close} role="presentation">
    <button class="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none" onclick={close} aria-label="Close">×</button>
    <button class="absolute left-4 text-white/80 hover:text-white text-4xl px-3" onclick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous">‹</button>
    <img src={items[index].full} alt={items[index].alt} class="max-h-[90vh] max-w-[90vw] object-contain" onclick={(e) => e.stopPropagation()} />
    <button class="absolute right-4 text-white/80 hover:text-white text-4xl px-3" onclick={(e) => { e.stopPropagation(); next(); }} aria-label="Next">›</button>
  </div>
{/if}
