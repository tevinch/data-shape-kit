<script>
  import Child from './Child.svelte';
  let show = $state(false);
</script>
<button data-toggle onclick={() => (show = !show)}>{show ? 'Unmount' : 'Mount'}</button>
{#if show}<Child />{/if}
