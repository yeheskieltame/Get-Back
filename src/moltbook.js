import config from './config.js';

const API_BASE = 'https://www.moltbook.com/api/v1';
const API_KEY = process.env.MOLTBOOK_API_KEY || '';

// Track last post time (max 1 per 30 min)
let lastPostTs = 0;
let lastCommentCheckTs = 0;
let knownCommentIds = new Set();

function headers() {
  return {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function apiGet(path) {
  if (!API_KEY) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: headers() });
    return await res.json();
  } catch (err) {
    console.error('[Moltbook] GET error:', err.message);
    return null;
  }
}

async function apiPost(path, body) {
  if (!API_KEY) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });
    const data = await res.json();

    // Handle verification challenge
    if (data.verification_required) {
      return await solveVerification(data, path, body);
    }

    if (!data.success && data.error) {
      console.error('[Moltbook] API error:', data.error);
    }
    return data;
  } catch (err) {
    console.error('[Moltbook] POST error:', err.message);
    return null;
  }
}

async function solveVerification(challenge, originalPath, originalBody) {
  try {
    // Parse math problem
    const problem = challenge.challenge || challenge.verification_challenge;
    if (!problem) return null;

    const match = problem.match(/([\d.]+)\s*([+\-*/])\s*([\d.]+)/);
    if (!match) return null;

    const [, a, op, b] = match;
    let answer;
    switch (op) {
      case '+': answer = parseFloat(a) + parseFloat(b); break;
      case '-': answer = parseFloat(a) - parseFloat(b); break;
      case '*': answer = parseFloat(a) * parseFloat(b); break;
      case '/': answer = parseFloat(a) / parseFloat(b); break;
    }

    const verifyRes = await fetch(`${API_BASE}/verify`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        verification_code: challenge.verification_code,
        answer: answer.toFixed(2),
      }),
    });
    const verifyData = await verifyRes.json();

    if (verifyData.success) {
      // Retry original request
      return await apiPost(originalPath, originalBody);
    }
    return verifyData;
  } catch (err) {
    console.error('[Moltbook] Verification error:', err.message);
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Post a status update about the mission.
 * Only posts if enough time has passed (30 min rate limit).
 */
export async function postUpdate(title, content) {
  if (!API_KEY) return;

  const now = Date.now();
  if (now - lastPostTs < 30 * 60 * 1000) {
    console.log('[Moltbook] Rate limited, skipping post');
    return;
  }

  const result = await apiPost('/posts', {
    submolt_name: 'general',
    title,
    content,
    type: 'text',
  });

  if (result?.success) {
    lastPostTs = now;
    console.log(`[Moltbook] Posted: ${title}`);
  }
  return result;
}

/**
 * Check for new comments on our posts and reply.
 * Uses Claude to generate contextual replies.
 */
export async function checkAndReplyComments(generateReplyFn) {
  if (!API_KEY) return;

  const now = Date.now();
  if (now - lastCommentCheckTs < 5 * 60 * 1000) return; // Check every 5 min
  lastCommentCheckTs = now;

  try {
    // Get our profile to find our posts
    const me = await apiGet('/agents/me');
    if (!me?.agent?.name) return;

    // Get our recent posts
    const feed = await apiGet(`/agents/${me.agent.name}/posts?limit=5`);
    if (!feed?.posts) return;

    for (const post of feed.posts) {
      const comments = await apiGet(`/posts/${post.id}/comments?sort=new&limit=10`);
      if (!comments?.comments) continue;

      for (const comment of comments.comments) {
        if (knownCommentIds.has(comment.id)) continue;
        knownCommentIds.add(comment.id);

        // Skip our own comments
        if (comment.author === me.agent.name) continue;

        // Generate reply using Claude
        if (generateReplyFn) {
          const reply = await generateReplyFn(comment.content, comment.author);
          if (reply) {
            await apiPost(`/posts/${post.id}/comments`, {
              content: reply,
              parent_id: comment.id,
            });
            console.log(`[Moltbook] Replied to ${comment.author}: ${reply.slice(0, 50)}`);

            // Rate limit: 1 comment per 20s
            await new Promise(r => setTimeout(r, 20000));
          }
        }
      }
    }
  } catch (err) {
    console.error('[Moltbook] Comment check error:', err.message);
  }
}

/**
 * Post a mission update based on event type.
 */
export async function missionUpdate(eventType, details) {
  if (!API_KEY) return;

  const titles = {
    funny: `Get-Back Agent: ${details.slice(0, 60)}`,
    progress: `Mission Update: ${details.slice(0, 60)}`,
    setback: `Plot Twist: ${details.slice(0, 60)}`,
    milestone: `Milestone: ${details.slice(0, 60)}`,
    sentiment: `Mood Check: ${details.slice(0, 60)}`,
  };

  const title = titles[eventType] || `Get-Back: ${details.slice(0, 60)}`;
  await postUpdate(title, details);
}

export async function getProfile() {
  return await apiGet('/agents/me');
}
