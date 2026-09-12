/*
  ============================================================
  CLOUDFLARE WORKER - SPIDER SOLITAIRE GÉOCACHING
  ============================================================

  Bindings nécessaires :
  - D1 : DB
  - Secret Worker : SECRET_WORD

  Optionnel :
  - Variable : ALLOWED_ORIGIN
    Exemple :
    https://teddy1902-r.github.io

  Routes :
  POST /api/start
  POST /api/finish
  GET  /api/leaderboard
*/

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin":
      env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type",
    "Cache-Control":
      "no-store"
  };
}

function jsonResponse(env, data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=UTF-8",
        ...corsHeaders(env)
      }
    }
  );
}

function cleanPlayerName(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "");
}

function calculateScore(seconds, moves) {
  return Math.max(
    0,
    100000 - seconds * 5 - moves * 20
  );
}

function createGameId() {
  return crypto.randomUUID();
}

function clampInteger(value, min, max) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number < min ||
    number > max
  ) {
    return null;
  }

  return number;
}

async function handleStart(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      env,
      { error: "Requête invalide." },
      400
    );
  }

  const player =
    cleanPlayerName(body.player);

  if (
    player.length < 2 ||
    player.length > 30
  ) {
    return jsonResponse(
      env,
      {
        error:
          "Le pseudo doit contenir entre 2 et 30 caractères."
      },
      400
    );
  }

  const gameId = createGameId();

  await env.DB.prepare(`
    INSERT INTO games (
      id,
      player,
      started_at,
      finished_at
    )
    VALUES (?, ?, datetime('now'), NULL)
  `)
    .bind(gameId, player)
    .run();

  return jsonResponse(env, {
    ok: true,
    gameId
  });
}

async function handleFinish(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      env,
      { error: "Requête invalide." },
      400
    );
  }

  const gameId =
    typeof body.gameId === "string"
      ? body.gameId.trim()
      : "";

  const moves =
    clampInteger(body.moves, 1, 10000);

  const seconds =
    clampInteger(body.seconds, 1, 86400);

  if (!gameId || moves === null || seconds === null) {
    return jsonResponse(
      env,
      { error: "Données de partie invalides." },
      400
    );
  }

  const game = await env.DB.prepare(`
    SELECT
      id,
      player,
      started_at,
      finished_at
    FROM games
    WHERE id = ?
    LIMIT 1
  `)
    .bind(gameId)
    .first();

  if (!game) {
    return jsonResponse(
      env,
      { error: "Partie inconnue." },
      404
    );
  }

  if (game.finished_at) {
    return jsonResponse(
      env,
      {
        error:
          "Cette partie a déjà été enregistrée."
      },
      409
    );
  }

  const startedAt =
    new Date(game.started_at + "Z").getTime();

  const now = Date.now();

  const serverElapsedSeconds =
    Math.floor(
      (now - startedAt) / 1000
    );

  if (
    Number.isFinite(serverElapsedSeconds) &&
    serverElapsedSeconds > 0
  ) {
    const difference =
      Math.abs(
        serverElapsedSeconds - seconds
      );

    if (difference > 180) {
      return jsonResponse(
        env,
        {
          error:
            "Le temps de la partie ne correspond pas au temps serveur."
        },
        400
      );
    }
  }

  const score =
    calculateScore(seconds, moves);

  const updateResult = await env.DB.prepare(`
    UPDATE games
    SET finished_at = datetime('now')
    WHERE id = ?
      AND finished_at IS NULL
  `)
    .bind(gameId)
    .run();

  if (
    !updateResult.meta ||
    updateResult.meta.changes !== 1
  ) {
    return jsonResponse(
      env,
      {
        error:
          "Cette partie a déjà été enregistrée."
      },
      409
    );
  }

  await env.DB.prepare(`
    INSERT INTO scores (
      game_id,
      player,
      score,
      seconds,
      moves,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `)
    .bind(
      gameId,
      game.player,
      score,
      seconds,
      moves
    )
    .run();

  if (!env.SECRET_WORD) {
    return jsonResponse(
      env,
      {
        error:
          "Le mot secret n'est pas configuré dans le Worker."
      },
      500
    );
  }

  return jsonResponse(env, {
    ok: true,
    player: game.player,
    score,
    seconds,
    moves,
    secretWord: env.SECRET_WORD
  });
}

async function handleLeaderboard(request, env) {
  const url =
    new URL(request.url);

  let limit =
    Number(
      url.searchParams.get("limit") || 10
    );

  if (
    !Number.isInteger(limit) ||
    limit < 1
  ) {
    limit = 10;
  }

  limit =
    Math.min(limit, 10);

  const result =
    await env.DB.prepare(`
      SELECT
        player,
        score,
        seconds,
        moves,
        created_at
      FROM scores
      ORDER BY
        score DESC,
        seconds ASC,
        moves ASC,
        created_at ASC
      LIMIT ?
    `)
      .bind(limit)
      .all();

  const scores =
    (result.results || []).map(row => ({
      player: row.player,
      score: row.score,
      seconds: row.seconds,
      moves: row.moves,
      createdAt:
        row.created_at
          ? row.created_at.replace(
              " ",
              "T"
            ) + "Z"
          : null
    }));

  return jsonResponse(env, {
    ok: true,
    scores
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env)
      });
    }

    const url =
      new URL(request.url);

    try {
      if (
        request.method === "POST" &&
        url.pathname === "/api/start"
      ) {
        return await handleStart(
          request,
          env
        );
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/finish"
      ) {
        return await handleFinish(
          request,
          env
        );
      }

      if (
        request.method === "GET" &&
        url.pathname === "/api/leaderboard"
      ) {
        return await handleLeaderboard(
          request,
          env
        );
      }

      if (
        request.method === "GET" &&
        url.pathname === "/"
      ) {
        return jsonResponse(env, {
          ok: true,
          name:
            "Spider Solitaire Géocaching API"
        });
      }

      return jsonResponse(
        env,
        { error: "Route introuvable." },
        404
      );
    } catch (error) {
      console.error(error);

      return jsonResponse(
        env,
        {
          error:
            "Erreur interne du serveur."
        },
        500
      );
    }
  }
};
