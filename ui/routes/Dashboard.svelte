<script>
  import { onMount } from 'svelte'
  import { NotificationDisplay, notifier } from '@beyonk/svelte-notifications'
  import Redirect from '../components/Redirect.svelte'
  import { session } from '../store.js'

  const sizeResults = 10
  let pageSize = 1
  let pageTotal = 1
  let fromResults = 0
  let redirects = []
  let count = 0
  let source = ''
  let destination = ''
  let canBeSuggested = true
  let isCreating = false

  async function onCreate () {
    let s = source.trim()
    let d = destination.trim()
    let p = !canBeSuggested

    if (s.length === 0  || d.length === 0) {
      notifier.warning('Both the source and the destination must be defined', 5000)
      return
    }

    isCreating = true
    const response = await fetch('/_app/redirect', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': $session.csrf
      },
      body: JSON.stringify({
        source: s,
        destination: d,
        isPrivate: p
      })
    })
    isCreating = false

    if (response.status === 201) {
      notifier.success('Short url created successfully', 5000)
      await loadRedirects()
    } else if (response.status === 401 || response.status === 403) {
      $session = null
    } else {
      const body = await response.json()
      notifier.danger(body.message, 5000)
    }
  }

  async function onChange () {
    await loadRedirects()
  }

  async function loadRedirects (from = 0) {
    if (from < 0) return
    if (from >= pageTotal) return
    fromResults = from
    const response = await fetch(`/_app/redirects?from=${from}&size=${sizeResults}`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'X-Csrf-Token': $session.csrf }
    })

    if (response.status === 200) {
      const body = await response.json()
      redirects = body.redirects
      count = body.count
      pageSize = Math.ceil(sizeResults / count)
      pageTotal = Math.floor(count / pageSize)
    } else if (response.status === 401 || response.status === 403) {
      $session = null
    } else {
      const body = await response.json()
      notifier.danger(body.message, 5000)
    }
  }

  onMount(loadRedirects)
</script>

<main class="gradient-background">
  <NotificationDisplay />
  <div class="dashboard-box">
    <h1 class="gradient-text title is-1 is-uppercase has-text-weight-bold has-text-centered">Fastify URL shortener</h1>

    <h4 class="title is-4 has-text-left	fullwidth">Add a new shorturl</h4>
    <div class="columns fullwidth">
      <div class="column">
        <input
          class="input"
          type="text"
          placeholder="Source"
          bind:value={source}
        >
      </div>
      <div class="column">
        <input
          class="input"
          type="text"
          placeholder="Destination"
          bind:value={destination}
        >
      </div>
      <div class="column">
        <label class="checkbox">
          <input type="checkbox" bind:checked={canBeSuggested}>
          Can be suggested?
        </label>
      </div>
      <div class="column">
        <button
          class="button gradient-button is-fullwidth"
          class:is-loading="{isCreating}"
          on:click={onCreate}
        ><ion-icon name="flash"></ion-icon> Create</button>
      </div>
    </div>

    <div class="columns fullwidth mt-6 mb-0">
      <div class="column">
        <h4 class="title is-4 has-text-left	fullwidth">Current redirects ({count})</h4>
      </div>
      <div class="column has-text-right">
        <button class="pagination-button" on:click={() => loadRedirects(fromResults - pageSize)}><ion-icon name="chevron-back"></ion-icon></button>
        {fromResults + 1}/{pageTotal}
        <button class="pagination-button" on:click={() => loadRedirects(fromResults + pageSize)}><ion-icon name="chevron-forward"></ion-icon></button>
      </div>
    </div>
    {#each redirects as redirect}
      <Redirect
        source={redirect.source}
        destination={redirect.destination}
        canBeSuggested={!redirect.isPrivate}
        count={redirect.count}
        created={redirect.created}
        on:change={onChange}
      />
    {/each}
  </div>
</main>

<style>
  main {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 30px;
  }

  .fullwidth {
    width: 100%;
  }

  .dashboard-box {
    background-color: #fff;
    border-radius: 10px;
    padding: 50px;
    width: 100%;
    height: 100%;
    overflow-y: scroll;
    margin: 0 auto;
  }

  ion-icon {
    position: relative;
    top: 1px;
    margin-right: 10px;
  }

  .pagination-button {
    border: none;
    background: #fff;
  }
</style>
