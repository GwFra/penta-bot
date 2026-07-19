function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface AvatarUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

// https://discord.com/developers/docs/reference#image-formatting
export function avatarUrl(user: AvatarUser): string {
  if (user.avatar) {
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
  }
  const index = Number((BigInt(user.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

interface PageContent {
  avatarHtml: string;
  badgeColor: string;
  badgePath: string;
  heading: string;
  tag: string;
}

function page({
  avatarHtml,
  badgeColor,
  badgePath,
  heading,
  tag,
}: PageContent): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>penta-bot — Account linked</title>
  <style>
    * { margin: 0; box-sizing: border-box; }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      display: grid;
      place-items: center;
      color: #fff;
      background: url('/assets/bg.svg') center / cover no-repeat, linear-gradient(135deg, #404eed, #2b2fbf);
    }

    .card {
      text-align: center;
      padding: 3rem 4rem;
      border-radius: 16px;
      background: #1e1f22;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
    }

    .avatar-wrap {
      position: relative;
      width: 88px;
      margin: 0 auto 1.25rem;
    }

    .avatar {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      background: linear-gradient(135deg, #5865f2, #8b5cf6);
      display: grid;
      place-items: center;
      font-size: 2.2rem;
      font-weight: 700;
      object-fit: cover;
    }

    .badge {
      position: absolute;
      bottom: -4px;
      right: -4px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: ${badgeColor};
      border: 4px solid #1e1f22;
      display: grid;
      place-items: center;
    }

    .badge svg { width: 14px; }

    h1 { font-size: 1.5rem; }

    .tag {
      color: #b5bac1;
      font-size: 0.95rem;
      margin-top: 0.35rem;
    }

    .hint {
      color: #80848e;
      font-size: 0.85rem;
      margin-top: 1.25rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="avatar-wrap">
      ${avatarHtml}
      <div class="badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="${badgePath}"/>
        </svg>
      </div>
    </div>
    <h1>${heading}</h1>
    <div class="tag">${tag}</div>
    <div class="hint">You can close this tab and return to Discord.</div>
  </div>
</body>
</html>
`;
}

export function successPage(user: AvatarUser): string {
  const displayName = user.global_name ?? user.username;
  return page({
    avatarHtml: `<img class="avatar" src="${escapeHtml(avatarUrl(user))}" alt="">`,
    badgeColor: "#23a559",
    badgePath: "M20 6L9 17l-5-5",
    heading: "Account linked",
    tag: `${escapeHtml(displayName)} (@${escapeHtml(user.username)})`,
  });
}

export function errorPage(message: string): string {
  return page({
    avatarHtml: `<div class="avatar">!</div>`,
    badgeColor: "#da373c",
    badgePath: "M18 6L6 18M6 6l12 12",
    heading: "Something went wrong",
    tag: escapeHtml(message),
  });
}
