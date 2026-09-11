function getCorsHeaders(request, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || 'https://teddy1902-r.github.io';
  const requestOrigin = request.headers.get('Origin');

  return {
    'Access-Control-Allow-Origin': requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store',
      ...getCorsHeaders(request, env)
    }
  });
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = env.ALLOWED_ORIGIN || 'https://teddy1902-r.github.io';

  // Les requêtes sans Origin (tests directs / curl) sont acceptées.
  return !origin || origin === allowedOrigin;
}

function normalizePseudo(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

async function getLeaderboard(env) {
  const { results } = await env.DB.prepare(`
    SELECT pseudo, score, seconds, moves, created_at
    FROM scores
    ORDER BY score DESC, seconds ASC, moves ASC, created_at ASC
    LIMIT 10
  `).all();

  return results || [];
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request, env)
      });
    }

    if (!isAllowedOrigin(request, env)) {
      return jsonResponse(request, env, { error: 'Origin non autorisée.' }, 403);
    }

    if (!env.DB) {
      return jsonResponse(
        request,
        env,
        { error: 'La base D1 n’est pas encore liée au Worker.' },
        503
      );
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse(request, env, { ok: true });
    }

    if (request.method === 'GET' && url.pathname === '/leaderboard') {
      try {
        const leaderboard = await getLeaderboard(env);
        return jsonResponse(request, env, { ok: true, leaderboard });
      } catch (error) {
        return jsonResponse(
          request,
          env,
          { error: 'Impossible de charger le classement.' },
          500
        );
      }
    }

    if (request.method === 'POST' && url.pathname === '/score') {
      let body;

      try {
        body = await request.json();
      } catch (error) {
        return jsonResponse(request, env, { error: 'JSON invalide.' }, 400);
      }

      const pseudo = normalizePseudo(body.pseudo);
      const score = Number(body.score);
      const seconds = Number(body.seconds);
      const moves = Number(body.moves);

      if (pseudo.length < 1 || pseudo.length > 40) {
        return jsonResponse(
          request,
          env,
          { error: 'Identifiant Geocaching invalide.' },
          400
        );
      }

      if (!isIntegerInRange(score, 0, 50000)) {
        return jsonResponse(request, env, { error: 'Score invalide.' }, 400);
      }

      if (!isIntegerInRange(seconds, 0, 172800)) {
        return jsonResponse(request, env, { error: 'Temps invalide.' }, 400);
      }

      if (!isIntegerInRange(moves, 0, 10000)) {
        return jsonResponse(request, env, { error: 'Nombre de coups invalide.' }, 400);
      }

      const createdAt = new Date().toISOString();

      try {
        await env.DB.prepare(`
          INSERT INTO scores (pseudo, score, seconds, moves, created_at)
          VALUES (?, ?, ?, ?, ?)
        `)
          .bind(pseudo, score, seconds, moves, createdAt)
          .run();

        const leaderboard = await getLeaderboard(env);

        return jsonResponse(request, env, {
          ok: true,
          entry: {
            pseudo,
            score,
            seconds,
            moves,
            created_at: createdAt
          },
          leaderboard,
          certitude_word: env.CERTITUDE_WORD || null
        });
      } catch (error) {
        return jsonResponse(
          request,
          env,
          { error: 'Impossible d’enregistrer le résultat.' },
          500
        );
      }
    }

    return jsonResponse(request, env, { error: 'Route introuvable.' }, 404);
  }
};
