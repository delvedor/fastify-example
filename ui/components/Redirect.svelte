<script>
  import { createEventDispatcher } from 'svelte'
  import { notifier } from '@beyonk/svelte-notifications'
  import { session } from '../store.js'

  export let source
  export let destination
  export let canBeSuggested
  export let count
  export let created

  let isEditing = false
  let isUpdating = false
  let isDeleting = false

  const dispatch = createEventDispatcher()

  async function onEdit () {
    if (isDeleting) return
    let s = source.trim()
    let d = destination.trim()
    let p = !canBeSuggested

    if (s.length === 0  || d.length === 0) {
      notifier.warning('Both the source and the destination must be defined', 5000)
      return
    }

    isUpdating = true
    const response = await fetch('/_app/redirect', {
      method: 'POST',
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
    isUpdating = false

    if (response.status === 200) {
      notifier.success('Short url updated successfully', 5000)
      dispatch('change')
      isEditing = false
    } else if (response.status === 401 || response.status === 403) {
      $session = null
    } else {
      const body = await response.json()
      notifier.danger(body.message, 5000)
    }
  }

  async function onDelete () {
    if (isUpdating) return
    let s = source.trim()

    if (s.length === 0) {
      notifier.warning('The source must be defined', 5000)
      return
    }

    isDeleting = true
    const response = await fetch('/_app/redirect', {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': $session.csrf
      },
      body: JSON.stringify({ source: s })
    })
    isDeleting = false

    if (response.status === 200) {
      notifier.success('Short url deleted successfully', 5000)
      dispatch('change')
      isEditing = false
    } else if (response.status === 401 || response.status === 403) {
      $session = null
    } else {
      const body = await response.json()
      notifier.danger(body.message, 5000)
    }
  }
</script>

<main>
  {#if isEditing}
    <div class="columns fullwidth">
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
          class:is-loading="{isUpdating}"
          on:click={onEdit}
        ><ion-icon name="flash"></ion-icon> Update</button>
      </div>
      <div class="column">
        <button
          class="button gradient-button is-fullwidth"
          class:is-loading="{isDeleting}"
          on:click={onDelete}
        ><ion-icon name="trash"></ion-icon> Delete</button>
      </div>
      <div class="column">
        <button
          class="button gradient-button is-fullwidth"
          on:click={() => isEditing = !isEditing}
        ><ion-icon name="arrow-back-circle"></ion-icon> Back</button>
      </div>
    </div>
  {:else}
    <div class="columns fullwidth">
      <div class="column">
        <input
          class="input"
          type="text"
          readonly
          bind:value={source}
        >
      </div>
      <div class="column">
        <p class="is-size-5 has-text-centered">{count} clicks</p>
      </div>
      <div class="column">
        <p class="is-size-5 has-text-centered">{new Date(created).toLocaleDateString()}</p>
      </div>
      <div class="column">
        <button
          class="button gradient-button is-fullwidth"
          on:click={() => isEditing = !isEditing}
        ><ion-icon name="build"></ion-icon> Edit</button>
      </div>
    </div>
  {/if}
</main>

<style>
  main {
    width: 100%;
    margin: 0;
    padding: 0;
  }

  .fullwidth {
    width: 100%;
  }

  ion-icon {
    position: relative;
    top: 1px;
  }
</style>
