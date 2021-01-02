<script>
  import { onMount } from 'svelte'
  import Router, { replace } from 'svelte-spa-router'
  import Login from './routes/Login.svelte'
  import Dashboard from './routes/Dashboard.svelte'
  import NotFound from './routes/404.svelte'
  import Loader from './components/Loader.svelte'
  import { session } from './store.js'

  let loading = true

  session.subscribe(value => {
    if (value == null) {
      replace('/login')
    } else {
      replace('/dashboard')
    }
  })

  const routes = {
    '/login': Login,
    '/dashboard': Dashboard,
    '*': NotFound
  }

  onMount(async () => {
    const response = await fetch('/_app/refresh', { method: 'GET', credentials: 'include' })
    if (response.status === 200) {
      const body = await response.json()
      $session = { csrf: body.csrfToken }
    } else {
      $session = null
    }
    loading = false
  })

  function routeLoading (event) {
    if (!$session && event.detail.route !== '/login') {
      return replace('/login')
    }
  }
</script>

<svelte:head>
  <title>Fastify URL shortener</title>
</svelte:head>

{#if loading}
  <Loader />
{:else}
  <Router
    {routes}
    on:routeLoading={routeLoading}
  />
{/if}

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

  :global(.gradient-text) {
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

  :global(.gradient-background) {
    background: #d53369;
    background: linear-gradient(90deg, #d53369 0%, #daae51 100%);
  }

  :global(.gradient-button),
  :global(.gradient-button:hover),
  :global(.gradient-button:active) {
    background: #d53369;
    background: linear-gradient(90deg, #d53369 0%, #daae51 100%);
    color: #fff;
  }

  :global(input) {
    border: 2px #d53369 solid !important;
  }
</style>
