<script>
  export let suggestions = []
  let text = suggestions.length > 1 ? 'one of the' : 'the'
</script>

<main class="gradient-background is-flex is-justify-content-center is-align-items-center">
  <div class="suggestions-box is-flex is-flex-direction-column is-justify-content-space-around is-align-items-center">
    <h1 class="gradient-text title is-1">App</h1>
    {#if suggestions.length}
      <p class="is-size-5 mb-5">
        It looks like that the short url you asked for does not exists.<br/>
        Did you mean {text} following?
      </p>
      {#each suggestions as suggestion }
        <a class="is-size-5"href="{suggestion.destination}">{suggestion.source}</a>
      {/each}
    {:else}
      <h4 class="title is-4">404</h4>
      <h3 class="title is-3">Short url not found 😱</h3>
    {/if}
  </div>
</main>

<style>
  :global(html), :global(body) {
    font-size: 16px;
    width: 100%;
    height: 100%;
    min-height:100%;
    margin: 0;
    padding: 0;
    font-family: 'Montserrat', sans-serif;
  }

  main {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
  }

  .suggestions-box {
    background-color: #fff;
    border-radius: 10px;
    padding: 30px;
    width: 90%;
    margin: 50px;
  }

  .gradient-text {
    background: linear-gradient(90deg, #d53369 0%, #daae51 100%);
   -webkit-background-clip: text;
     -moz-background-clip: text;
    background-clip: text;
   -webkit-text-fill-color: transparent;
    -moz-text-fill-color: transparent;
    text-fill-color: transparent;
    color: #d53369;
    font-weight: 700;
  }

  .gradient-background {
    background: #d53369;
    background: linear-gradient(90deg, #d53369 0%, #daae51 100%);
  }

</style>
