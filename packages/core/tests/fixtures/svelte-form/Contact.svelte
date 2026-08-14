<script>
  export let email = '';
</script>
<form>
  <input name="email" type="email" bind:value={email} />
  <button type="submit">Send</button>
</form>
