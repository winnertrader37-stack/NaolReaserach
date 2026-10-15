"use strict";

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

app.disable("x-powered-by");
app.use(helmet());

app.use(express.json({
    limit: "20kb"
}));

const PORT = process.env.PORT || 3000;

const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false
});

app.use("/api/", limiter);

// Check whether the backend is online.
app.get("/api/health", (req, res) => {
    res.json({
        status: "online",
        service: "Face Research AI",
        version: "1.0.0"
    });
});

// Search publicly accessible web pages by name or username.
app.post("/api/search", async (req, res) => {
    try {
        const query = String(req.body?.query || "").trim();

        if (!query) {
            return res.status(400).json({
                error: "Please provide a search query."
            });
        }

        if (query.length > 150) {
            return res.status(400).json({
                error: "The search query is too long."
            });
        }

        const apiKey = process.env.BRAVE_SEARCH_API_KEY;

        if (!apiKey) {
            return res.status(503).json({
                error: "Search API is not configured yet.",
                message:
                    "Add BRAVE_SEARCH_API_KEY to your hosting environment."
            });
        }

        const url = new URL(
            "https://api.search.brave.com/res/v1/web/search"
        );

        url.searchParams.set("q", query);
        url.searchParams.set("count", "10");

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "X-Subscription-Token": apiKey
            },
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            console.error(
                "Search provider returned HTTP",
                response.status
            );

            return res.status(502).json({
                error: "The search provider could not complete the request."
            });
        }

        const data = await response.json();

        const results = (data.web?.results || []).map(item => ({
            title: item.title || "Untitled page",
            url: item.url || "",
            description: item.description || "",
            source: "Brave Search"
        })).filter(item => {
            try {
                const parsed = new URL(item.url);
                return ["http:", "https:"].includes(parsed.protocol);
            } catch {
                return false;
            }
        });

        return res.json({
            query,
            total: results.length,
            results
        });

    } catch (error) {
        console.error("Search request failed:", error.message);

        return res.status(500).json({
            error: "An unexpected search error occurred."
        });
    }
});

// Do not expose internal error details to visitors.
app.use((err, req, res, next) => {
    console.error("Server error:", err.message);

    res.status(500).json({
        error: "Internal server error."
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(
        `Face Research AI backend listening on port ${PORT}`
    );
});
