  );
}

function PrivacyBanner() {
  // Only promise a GitHub push when the server can actually reach the remote
  // with credentials. Otherwise state the honest local-only behavior.
  const { data: sync } = useAsync<RepoSyncStatus>(() => api.repoSync());
