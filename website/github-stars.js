(() => {
  const repository = "kiruxich/legitAgent";
  const count = document.getElementById("github-stars-count");
  const link = document.querySelector(".github-stars");

  if (!count || !link) return;

  const formatCount = (value) => new Intl.NumberFormat("ru-RU", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);

  async function updateStars() {
    try {
      const response = await fetch(`https://api.github.com/repos/${repository}`, {
        headers: { Accept: "application/vnd.github+json" }
      });
      if (!response.ok) throw new Error("GitHub API request failed");

      const { stargazers_count: stars } = await response.json();
      count.textContent = formatCount(stars);
      link.setAttribute("aria-label", `GitHub: ${stars} звёзд`);
    } catch {
      count.textContent = "";
      link.setAttribute("aria-label", "Открыть репозиторий на GitHub");
    }
  }

  updateStars();
  window.setInterval(updateStars, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateStars();
  });
})();
