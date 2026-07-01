export async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    console.error(`API request failed: ${await res.text()}`);
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
