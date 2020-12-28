<script>
  export let destination
</script>

<main>
  <h2>404</h2>
  {#if destination}
    <h1>Redirect not found 😱</h1>
    <h3>{destination}</h3>
  {:else}
    <h1>Page not found 😱</h1>
  {/if}
</main>

<style>
  main {
    text-align: center;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: calc(10px + 2vmin);
    justify-content: center;
    font-family: Verdana, sans-serif;
  }
</style>
