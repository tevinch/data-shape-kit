<script>
  import { flushSync } from 'svelte';
  let x = $state(0);
  $effect(() => {
    window.checks.effects += 1;
    window.checks.observed.push(x);
    if (x === 0) {
      x = 1;
      window.checks.flushes += 1;
      flushSync();
    }
  });
</script>
<p data-value>x = {x}</p>
<button data-increment onclick={() => x++}>Increment</button>
<button data-reset onclick={() => (x = 0)}>Reset</button>
