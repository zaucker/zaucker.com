<script lang="ts">
  interface Item { hero: string; full: string; alt: string; w: number; h: number; }
  let { items, label = 'Alle Fotos' }: { items: Item[]; label?: string } = $props();

  let open = $state(false);
  let index = $state(0);

  function openAt(i: number) { index = i; open = true; }
  function close() { open = false; }
  function next() { index = (index + 1) % items.length; }
  function prev() { index = (index - 1 + items.length) % items.length; }

  function onKey(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
  }

  // Move the fullscreen overlay to <body> so an ancestor `transform`
  // (e.g. the hero's `.reveal` animation) can't trap `position: fixed`.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }
</script>

<svelte:window on:keydown={onKey} />

<div class="relative">
  <button type="button" class="block w-full" onclick={() => openAt(0)} aria-label={label}>
    <img src={items[0].hero} width={items[0].w} height={items[0].h} alt={items[0].alt}
         class="rounded-3xl ring-1 ring-black/5 w-full aspect-[4/3] object-cover" />
  </button>
  {#if items.length > 1}
    <button type="button" onclick={() => openAt(0)}
      class="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur text-sm font-medium text-stone-700 hover:text-lake shadow-sm transition-colors">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      {label} ({items.length})
    </button>
  {/if}
</div>

{#if open}
  <div use:portal class="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onclick={close} role="presentation">
    <button class="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none" onclick={close} aria-label="Close">×</button>
    <button class="absolute left-4 text-white/80 hover:text-white text-4xl px-3" onclick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous">‹</button>
    <img src={items[index].full} alt={items[index].alt} class="max-h-[90vh] max-w-[90vw] object-contain" onclick={(e) => e.stopPropagation()} />
    <button class="absolute right-4 text-white/80 hover:text-white text-4xl px-3" onclick={(e) => { e.stopPropagation(); next(); }} aria-label="Next">›</button>
  </div>
{/if}
